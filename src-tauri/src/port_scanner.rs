use crate::service_map;
use crate::types::PortStatus;
use std::net::TcpStream;
use std::process::Command;
use std::time::Duration;

#[tauri::command]
pub fn scan_ports() -> Vec<PortStatus> {
    let mut ports = scan_lsof();
    let service_map = service_map::load_service_map();

    // Also probe known service ports
    let known_ports: Vec<u16> = service_map
        .services
        .iter()
        .filter_map(|s| extract_port(&s.local_url))
        .collect();

    for port in known_ports {
        if !ports.iter().any(|p| p.port == port) {
            if probe_port(port) {
                ports.push(PortStatus {
                    port,
                    process_name: "unknown".to_string(),
                    pid: 0,
                    service_name: service_map
                        .services
                        .iter()
                        .find(|s| extract_port(&s.local_url) == Some(port))
                        .map(|s| s.name.clone()),
                });
            }
        }
    }

    // Enrich with service names
    for port in &mut ports {
        if port.service_name.is_none() {
            port.service_name = service_map
                .services
                .iter()
                .find(|s| extract_port(&s.local_url) == Some(port.port))
                .map(|s| s.name.clone());
        }
    }

    ports.sort_by_key(|p| p.port);
    ports
}

fn scan_lsof() -> Vec<PortStatus> {
    let output = Command::new("lsof")
        .args(["-iTCP", "-sTCP:LISTEN", "-n", "-P"])
        .output();

    let output = match output {
        Ok(o) => o,
        Err(_) => return vec![],
    };

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut ports = Vec::new();

    for line in stdout.lines().skip(1) {
        let parts: Vec<&str> = line.split_whitespace().collect();
        if parts.len() < 9 {
            continue;
        }

        let process_name = parts[0].to_string();
        let pid: u32 = parts[1].parse().unwrap_or(0);

        // Parse the name field (e.g., "*:3001" or "localhost:3001")
        let name_field = parts[8];
        if let Some(port_str) = name_field.rsplit(':').next() {
            if let Ok(port) = port_str.parse::<u16>() {
                if !ports.iter().any(|p: &PortStatus| p.port == port) {
                    ports.push(PortStatus {
                        port,
                        process_name: process_name.clone(),
                        pid,
                        service_name: None,
                    });
                }
            }
        }
    }

    ports
}

fn probe_port(port: u16) -> bool {
    TcpStream::connect_timeout(
        &format!("127.0.0.1:{}", port).parse().unwrap(),
        Duration::from_millis(100),
    )
    .is_ok()
}

fn extract_port(url: &str) -> Option<u16> {
    let s = url.strip_prefix(':').unwrap_or(url);
    // Handle "localhost:PORT" or just ":PORT"
    if let Some(port_str) = s.rsplit(':').next() {
        port_str.split('/').next()?.parse().ok()
    } else {
        s.parse().ok()
    }
}
