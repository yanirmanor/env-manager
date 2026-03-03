use crate::types::{ServiceMap, ServiceMapping};
use std::fs;
use std::path::PathBuf;

fn starred_services_path() -> PathBuf {
    crate::config::app_data_dir().join("starred-services.json")
}

pub fn load_service_map() -> ServiceMap {
    let path = starred_services_path();
    if path.exists() {
        let content = fs::read_to_string(&path).unwrap_or_default();
        serde_json::from_str(&content).unwrap_or_else(|_| default_service_map())
    } else {
        default_service_map()
    }
}

fn save_service_map(map: &ServiceMap) -> Result<(), String> {
    let path = starred_services_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(&path, json).map_err(|e| e.to_string())
}

pub fn get_toggle_pairs(map: &ServiceMap) -> Vec<(String, String)> {
    map.services
        .iter()
        .map(|s| (s.remote_url.clone(), s.local_url.clone()))
        .collect()
}

fn default_service_map() -> ServiceMap {
    ServiceMap {
        services: vec![],
        ignore_domains: vec![],
    }
}

#[tauri::command]
pub fn get_service_map() -> ServiceMap {
    load_service_map()
}

#[tauri::command]
pub fn update_service_map(map: ServiceMap) -> Result<(), String> {
    save_service_map(&map)
}

#[tauri::command]
pub fn star_service(name: String, remote_url: String, port: u16) -> Result<(), String> {
    let mut map = load_service_map();

    // Remove existing mapping for this port if any
    map.services
        .retain(|s| !s.local_url.contains(&format!(":{}", port)));

    map.services.push(ServiceMapping {
        name,
        remote_url,
        local_url: format!("localhost:{}", port),
        env_keys: vec![],
    });

    save_service_map(&map)
}

#[tauri::command]
pub fn unstar_service(port: u16) -> Result<(), String> {
    let mut map = load_service_map();
    map.services
        .retain(|s| !s.local_url.contains(&format!(":{}", port)));
    save_service_map(&map)
}
