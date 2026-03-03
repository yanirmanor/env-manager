use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScanFolder {
    pub path: String,
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AppConfig {
    pub scan_folders: Vec<ScanFolder>,
}

impl Default for AppConfig {
    fn default() -> Self {
        Self {
            scan_folders: vec![],
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Project {
    pub name: String,
    pub path: String,
    pub env_files: Vec<String>,
    pub folder: String,
    pub status: ProjectStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProjectStatus {
    AllLocal,
    AllRemote,
    Mixed,
    NoUrls,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EnvEntry {
    pub key: String,
    pub value: String,
    pub file: String,
    pub line_number: usize,
    pub category: ValueCategory,
    pub is_comment: bool,
    pub raw_line: String,
    pub is_url: bool,
    pub url_direction: Option<UrlDirection>,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum ValueCategory {
    Url,
    Port,
    Host,
    Credential,
    Flag,
    Config,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub enum UrlDirection {
    Local,
    Staging,
    InternalStaging,
    K8sInternal,
    Production,
    Database,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PortStatus {
    pub port: u16,
    pub process_name: String,
    pub pid: u32,
    pub service_name: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMapping {
    pub name: String,
    pub remote_url: String,
    pub local_url: String,
    pub env_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ServiceMap {
    pub services: Vec<ServiceMapping>,
    pub ignore_domains: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotInfo {
    pub id: String,
    pub name: String,
    pub created_at: DateTime<Utc>,
    pub file_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Snapshot {
    pub info: SnapshotInfo,
    pub files: Vec<SnapshotFile>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SnapshotFile {
    pub path: String,
    pub content: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupInfo {
    pub id: String,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
    pub backup_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Change {
    pub file: String,
    pub key: String,
    pub old_value: String,
    pub new_value: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffLine {
    pub file: String,
    pub key: String,
    pub old_value: String,
    pub new_value: String,
    pub line_number: usize,
}

