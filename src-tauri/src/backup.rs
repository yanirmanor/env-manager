use crate::config::app_data_dir;
use crate::types::BackupInfo;
use chrono::Utc;
use std::fs;
use std::path::PathBuf;

const MAX_BACKUPS_PER_FILE: usize = 20;

fn backup_dir() -> PathBuf {
    let dir = app_data_dir().join("backups");
    fs::create_dir_all(&dir).ok();
    dir
}

fn safe_filename(path: &str) -> String {
    path.replace('/', "_").replace('\\', "_").replace(':', "_")
}

pub fn create_backup(file_path: &str) -> Result<String, String> {
    let content = fs::read_to_string(file_path).map_err(|e| e.to_string())?;
    let timestamp = Utc::now().format("%Y%m%d_%H%M%S").to_string();
    let safe_name = safe_filename(file_path);
    let backup_name = format!("{}_{}.bak", safe_name, timestamp);
    let backup_path = backup_dir().join(&backup_name);

    fs::write(&backup_path, content).map_err(|e| e.to_string())?;

    // Save metadata
    let meta = BackupInfo {
        id: backup_name.clone(),
        file_path: file_path.to_string(),
        created_at: Utc::now(),
        backup_path: backup_path.to_string_lossy().to_string(),
    };
    let meta_path = backup_path.with_extension("json");
    let meta_json = serde_json::to_string_pretty(&meta).map_err(|e| e.to_string())?;
    fs::write(&meta_path, meta_json).map_err(|e| e.to_string())?;

    // Prune old backups
    prune_backups(file_path);

    Ok(backup_name)
}

fn prune_backups(file_path: &str) {
    let safe_name = safe_filename(file_path);
    let dir = backup_dir();

    let mut backups: Vec<(String, std::time::SystemTime)> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.starts_with(&safe_name) && name.ends_with(".bak")
        })
        .filter_map(|e| {
            let time = e.metadata().ok()?.modified().ok()?;
            Some((e.path().to_string_lossy().to_string(), time))
        })
        .collect();

    backups.sort_by(|a, b| b.1.cmp(&a.1));

    for (path, _) in backups.iter().skip(MAX_BACKUPS_PER_FILE) {
        fs::remove_file(path).ok();
        fs::remove_file(format!("{}.json", path.strip_suffix(".bak").unwrap_or(path))).ok();
    }
}

#[tauri::command]
pub fn list_backups(project: &str) -> Vec<BackupInfo> {
    let dir = backup_dir();
    let safe_prefix = safe_filename(project);

    let mut backups: Vec<BackupInfo> = fs::read_dir(&dir)
        .into_iter()
        .flatten()
        .filter_map(|e| e.ok())
        .filter(|e| {
            let name = e.file_name().to_string_lossy().to_string();
            name.ends_with(".json") && name.contains(&safe_prefix)
        })
        .filter_map(|e| {
            let content = fs::read_to_string(e.path()).ok()?;
            serde_json::from_str(&content).ok()
        })
        .collect();

    backups.sort_by(|a: &BackupInfo, b: &BackupInfo| b.created_at.cmp(&a.created_at));
    backups
}

#[tauri::command]
pub fn restore_backup(id: &str) -> Result<(), String> {
    let backup_path = backup_dir().join(id);
    if !backup_path.exists() {
        return Err("Backup not found".to_string());
    }

    let meta_path = backup_path.with_extension("json");
    let meta_content = fs::read_to_string(&meta_path).map_err(|e| e.to_string())?;
    let meta: BackupInfo = serde_json::from_str(&meta_content).map_err(|e| e.to_string())?;

    let backup_content = fs::read_to_string(&backup_path).map_err(|e| e.to_string())?;

    // Create a backup of current state before restoring
    create_backup(&meta.file_path)?;

    fs::write(&meta.file_path, backup_content).map_err(|e| e.to_string())
}
