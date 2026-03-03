import { invoke } from "@tauri-apps/api/core";
import type {
  ScanFolder,
  Project,
  EnvEntry,
  PortStatus,
  ServiceMap,
  SnapshotInfo,
  BackupInfo,
  Change,
  DiffLine,
} from "../types";

export const getScanFolders = () => invoke<ScanFolder[]>("get_scan_folders");

export const addScanFolder = (path: string) =>
  invoke<ScanFolder>("add_scan_folder", { path });

export const removeScanFolder = (path: string) =>
  invoke<void>("remove_scan_folder", { path });

export const scanProjects = (root: string) =>
  invoke<Project[]>("scan_projects", { root });

export const getEnvEntries = (project: string) =>
  invoke<EnvEntry[]>("get_env_entries", { project });

export const updateEntry = (file: string, key: string, value: string) =>
  invoke<void>("update_entry", { file, key, value });

export const toggleUrl = (file: string, key: string, direction: string) =>
  invoke<string>("toggle_url", { file, key, direction });

export const toggleBulk = (project: string, direction: string) =>
  invoke<Change[]>("toggle_bulk", { project, direction });

export const scanPorts = () => invoke<PortStatus[]>("scan_ports");

export const getServiceMap = () => invoke<ServiceMap>("get_service_map");

export const updateServiceMap = (map: ServiceMap) =>
  invoke<void>("update_service_map", { map });

export const starService = (name: string, remoteUrl: string, port: number) =>
  invoke<void>("star_service", { name, remoteUrl, port });

export const unstarService = (port: number) =>
  invoke<void>("unstar_service", { port });

export const listSnapshots = () => invoke<SnapshotInfo[]>("list_snapshots");

export const saveSnapshot = (name: string) =>
  invoke<void>("save_snapshot", { name });

export const restoreSnapshot = (name: string) =>
  invoke<void>("restore_snapshot", { name });

export const listBackups = (project: string) =>
  invoke<BackupInfo[]>("list_backups", { project });

export const restoreBackup = (id: string) =>
  invoke<void>("restore_backup", { id });

export const getDiff = (project: string) =>
  invoke<DiffLine[]>("get_diff", { project });
