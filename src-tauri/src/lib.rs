mod backup;
mod config;
mod parser;
mod port_scanner;
mod scanner;
mod service_map;
mod snapshot;
mod types;
mod url_detector;
mod writer;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            config::get_scan_folders,
            config::add_scan_folder,
            config::remove_scan_folder,
            scanner::scan_projects,
            parser::get_env_entries,
            writer::update_entry,
            writer::toggle_url,
            writer::toggle_bulk,
            writer::get_diff,
            port_scanner::scan_ports,
            service_map::get_service_map,
            service_map::update_service_map,
            service_map::star_service,
            service_map::unstar_service,
            snapshot::list_snapshots,
            snapshot::save_snapshot,
            snapshot::restore_snapshot,
            backup::list_backups,
            backup::restore_backup,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
