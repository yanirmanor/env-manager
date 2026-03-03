use crate::backup;
use crate::parser;
use crate::service_map;
use crate::types::Change;
use crate::url_detector;
use std::fs;
use std::path::Path;

#[tauri::command]
pub fn update_entry(file: &str, key: &str, value: &str) -> Result<(), String> {
    backup::create_backup(file)?;
    write_entry(file, key, value)
}

fn write_entry(file: &str, key: &str, value: &str) -> Result<(), String> {
    let content = fs::read_to_string(file).map_err(|e| e.to_string())?;
    let mut new_lines = Vec::new();
    let mut found = false;

    for line in content.lines() {
        let trimmed = line.trim();
        if !trimmed.starts_with('#') && !trimmed.is_empty() {
            if let Some(eq_pos) = trimmed.find('=') {
                let line_key = trimmed[..eq_pos].trim();
                let line_key = line_key.strip_prefix("export ").unwrap_or(line_key).trim();
                if line_key == key {
                    // Preserve any prefix (export, indentation) and reconstruct
                    let prefix = &line[..line.find('=').unwrap()];
                    new_lines.push(format!("{}={}", prefix, value));
                    found = true;
                    continue;
                }
            }
        }
        new_lines.push(line.to_string());
    }

    if !found {
        return Err(format!("Key '{}' not found in {}", key, file));
    }

    atomic_write(file, &new_lines.join("\n"))
}

fn atomic_write(file: &str, content: &str) -> Result<(), String> {
    let tmp_path = format!("{}.tmp", file);

    // Preserve trailing newline if original had one
    let original = fs::read_to_string(file).unwrap_or_default();
    let write_content = if original.ends_with('\n') && !content.ends_with('\n') {
        format!("{}\n", content)
    } else {
        content.to_string()
    };

    fs::write(&tmp_path, &write_content).map_err(|e| format!("Failed to write tmp: {}", e))?;
    fs::rename(&tmp_path, file).map_err(|e| format!("Failed to rename: {}", e))?;
    Ok(())
}

#[tauri::command]
pub fn toggle_url(file: &str, key: &str, direction: &str) -> Result<String, String> {
    let entries = parser::parse_env_file(file);
    let entry = entries
        .iter()
        .find(|e| e.key == key)
        .ok_or_else(|| format!("Key '{}' not found", key))?;

    let smap = service_map::load_service_map();
    let pairs = service_map::get_toggle_pairs(&smap);

    let new_value = url_detector::toggle_url(&entry.value, direction, &pairs)
        .ok_or_else(|| format!("Cannot toggle '{}' to {}", entry.value, direction))?;

    backup::create_backup(file)?;
    write_entry(file, key, &new_value)?;
    Ok(new_value)
}

#[tauri::command]
pub fn toggle_bulk(project: &str, direction: &str) -> Result<Vec<Change>, String> {
    let project_path = Path::new(project);
    if !project_path.exists() {
        return Err("Project path does not exist".to_string());
    }

    let smap = service_map::load_service_map();
    let pairs = service_map::get_toggle_pairs(&smap);
    let mut changes = Vec::new();

    // Find all env files in the project
    let env_files: Vec<String> = fs::read_dir(project)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.file_name()
                .to_string_lossy()
                .starts_with(".env")
        })
        .map(|e| e.path().to_string_lossy().to_string())
        .collect();

    for file in &env_files {
        let entries = parser::parse_env_file(file);
        for entry in &entries {
            if !entry.is_url || entry.url_direction.is_none() {
                continue;
            }
            if let Some(new_value) = url_detector::toggle_url(&entry.value, direction, &pairs) {
                if new_value != entry.value {
                    backup::create_backup(file)?;
                    write_entry(file, &entry.key, &new_value)?;
                    changes.push(Change {
                        file: file.clone(),
                        key: entry.key.clone(),
                        old_value: entry.value.clone(),
                        new_value,
                    });
                }
            }
        }
    }

    Ok(changes)
}

#[tauri::command]
pub fn get_diff(_project: &str) -> Vec<crate::types::DiffLine> {
    // This returns current state for now - in the full implementation,
    // this would compare in-memory staged changes against disk state
    vec![]
}
