use crate::config::{app_data_dir, load_config};
use crate::scanner;
use crate::types::{Snapshot, SnapshotFile, SnapshotInfo};
use chrono::Utc;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

fn snapshots_dir() -> PathBuf {
    let dir = app_data_dir().join("snapshots");
    fs::create_dir_all(&dir).ok();
    dir
}

#[tauri::command]
pub fn list_snapshots() -> Vec<SnapshotInfo> {
    let dir = snapshots_dir();
    let mut snapshots: Vec<SnapshotInfo> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .ends_with(".json")
        })
        .filter_map(|e| {
            let content = fs::read_to_string(e.path()).ok()?;
            let snapshot: Snapshot = serde_json::from_str(&content).ok()?;
            Some(snapshot.info)
        })
        .collect();

    snapshots.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    snapshots
}

#[tauri::command]
pub fn save_snapshot(name: &str) -> Result<(), String> {
    let config = load_config();
    let mut files = Vec::new();

    for folder in &config.scan_folders {
        let projects = scanner::scan_projects(&folder.path);
        for project in &projects {
            for env_file in &project.env_files {
                let content = fs::read_to_string(env_file).unwrap_or_default();
                files.push(SnapshotFile {
                    path: env_file.clone(),
                    content,
                });
            }
        }
    }

    let snapshot = Snapshot {
        info: SnapshotInfo {
            id: Uuid::new_v4().to_string(),
            name: name.to_string(),
            created_at: Utc::now(),
            file_count: files.len(),
        },
        files,
    };

    let json = serde_json::to_string_pretty(&snapshot).map_err(|e| e.to_string())?;
    let path = snapshots_dir().join(format!("{}.json", snapshot.info.id));
    fs::write(&path, json).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn restore_snapshot(name: &str) -> Result<(), String> {
    let dir = snapshots_dir();

    // Find snapshot by name
    let snapshot_file = fs::read_dir(&dir)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .find(|e| {
            let content = fs::read_to_string(e.path()).unwrap_or_default();
            if let Ok(snap) = serde_json::from_str::<Snapshot>(&content) {
                snap.info.name == name
            } else {
                false
            }
        })
        .ok_or_else(|| format!("Snapshot '{}' not found", name))?;

    let content = fs::read_to_string(snapshot_file.path()).map_err(|e| e.to_string())?;
    let snapshot: Snapshot = serde_json::from_str(&content).map_err(|e| e.to_string())?;

    // Create backups of all files before restoring
    for file in &snapshot.files {
        if PathBuf::from(&file.path).exists() {
            crate::backup::create_backup(&file.path).ok();
        }
    }

    // Restore all files
    for file in &snapshot.files {
        fs::write(&file.path, &file.content)
            .map_err(|e| format!("Failed to restore {}: {}", file.path, e))?;
    }

    Ok(())
}
