use crate::types::{AppConfig, ScanFolder};
use std::fs;
use std::path::PathBuf;

fn config_dir() -> PathBuf {
    let base = dirs::data_dir()
        .unwrap_or_else(|| PathBuf::from("~"))
        .join("com.env-manager.app");
    fs::create_dir_all(&base).ok();
    base
}

fn config_path() -> PathBuf {
    config_dir().join("config.json")
}

pub fn load_config() -> AppConfig {
    let path = config_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        AppConfig::default()
    }
}

pub fn save_config(config: &AppConfig) -> Result<(), String> {
    let path = config_path();
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn app_data_dir() -> PathBuf {
    config_dir()
}

#[tauri::command]
pub fn get_scan_folders() -> Vec<ScanFolder> {
    load_config().scan_folders
}

#[tauri::command]
pub fn add_scan_folder(path: &str) -> Result<ScanFolder, String> {
    let abs_path = PathBuf::from(path);
    if !abs_path.exists() {
        return Err(format!("Path does not exist: {}", path));
    }
    if !abs_path.is_dir() {
        return Err(format!("Path is not a directory: {}", path));
    }

    let name = abs_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| path.to_string());

    let folder = ScanFolder {
        path: abs_path.to_string_lossy().to_string(),
        name,
    };

    let mut config = load_config();
    if config.scan_folders.iter().any(|f| f.path == folder.path) {
        return Err("Folder already added".to_string());
    }
    config.scan_folders.push(folder.clone());
    save_config(&config)?;
    Ok(folder)
}

#[tauri::command]
pub fn remove_scan_folder(path: &str) -> Result<(), String> {
    let mut config = load_config();
    let initial_len = config.scan_folders.len();
    config.scan_folders.retain(|f| f.path != path);
    if config.scan_folders.len() == initial_len {
        return Err("Folder not found".to_string());
    }
    save_config(&config)
}
