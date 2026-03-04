export interface ScanFolder {
  path: string;
  name: string;
}

export interface Project {
  name: string;
  path: string;
  env_files: string[];
  folder: string;
  status: "AllLocal" | "AllRemote" | "Mixed" | "NoUrls";
}

export interface EnvEntry {
  key: string;
  value: string;
  file: string;
  line_number: number;
  category: "Url" | "Port" | "Host" | "Credential" | "Flag" | "Config";
  is_comment: boolean;
  raw_line: string;
  is_url: boolean;
  url_direction:
    | "Local"
    | "Staging"
    | "InternalStaging"
    | "K8sInternal"
    | "Production"
    | "Database"
    | null;
}

export interface PortStatus {
  port: number;
  process_name: string;
  pid: number;
  service_name: string | null;
}

export interface ServiceMapping {
  name: string;
  remote_url: string;
  local_url: string;
  env_keys: string[];
}

export interface ServiceMap {
  services: ServiceMapping[];
  ignore_domains: string[];
}

export interface SnapshotInfo {
  id: string;
  name: string;
  created_at: string;
  file_count: number;
}

export interface BackupInfo {
  id: string;
  file_path: string;
  created_at: string;
  backup_path: string;
}

export interface Change {
  file: string;
  key: string;
  old_value: string;
  new_value: string;
}

export interface DiffLine {
  file: string;
  key: string;
  old_value: string;
  new_value: string;
  line_number: number;
}

export interface PendingChange {
  original: string;
  current: string;
}

export interface Toast {
  id: number;
  message: string;
  type: "success" | "error";
}
