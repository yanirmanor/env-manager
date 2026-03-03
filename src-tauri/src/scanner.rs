use crate::parser;
use crate::types::{Project, ProjectStatus};
use std::collections::HashMap;
use std::path::Path;
use walkdir::WalkDir;

const IGNORED_DIRS: &[&str] = &[
    "node_modules",
    ".git",
    "dist",
    "build",
    "target",
    ".next",
    ".turbo",
    "coverage",
    "__pycache__",
    ".venv",
];

fn is_env_file(name: &str) -> bool {
    name == ".env"
        || name.starts_with(".env.")
        || name == ".env.local"
        || name == ".env.development"
        || name == ".env.production"
        || name == ".env.staging"
        || name == ".env.test"
}

fn should_skip_dir(name: &str) -> bool {
    IGNORED_DIRS.contains(&name) || name.starts_with('.')
}

#[tauri::command]
pub fn scan_projects(root: &str) -> Vec<Project> {
    let root_path = Path::new(root);
    if !root_path.exists() {
        return vec![];
    }

    let mut project_map: HashMap<String, Vec<String>> = HashMap::new();

    for entry in WalkDir::new(root)
        .min_depth(1)
        .max_depth(5)
        .into_iter()
        .filter_entry(|e| {
            if e.file_type().is_dir() {
                let name = e.file_name().to_string_lossy();
                !should_skip_dir(&name)
            } else {
                true
            }
        })
    {
        let entry = match entry {
            Ok(e) => e,
            Err(_) => continue,
        };

        if !entry.file_type().is_file() {
            continue;
        }

        let file_name = entry.file_name().to_string_lossy().to_string();
        if !is_env_file(&file_name) {
            continue;
        }

        let file_path = entry.path().to_string_lossy().to_string();
        let parent = entry
            .path()
            .parent()
            .unwrap_or(root_path)
            .to_string_lossy()
            .to_string();

        project_map
            .entry(parent)
            .or_default()
            .push(file_path);
    }

    let folder_name = root_path
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_else(|| root.to_string());

    let mut projects: Vec<Project> = project_map
        .into_iter()
        .map(|(path, env_files)| {
            let name = Path::new(&path)
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_else(|| path.clone());

            let status = compute_project_status(&env_files);

            Project {
                name,
                path,
                env_files,
                folder: folder_name.clone(),
                status,
            }
        })
        .collect();

    projects.sort_by(|a, b| a.name.cmp(&b.name));
    projects
}

fn compute_project_status(env_files: &[String]) -> ProjectStatus {
    let mut has_local = false;
    let mut has_remote = false;
    let mut has_urls = false;

    for file in env_files {
        let entries = parser::parse_env_file(file);
        for entry in &entries {
            if entry.is_url {
                has_urls = true;
                match &entry.url_direction {
                    Some(dir) => match dir {
                        crate::types::UrlDirection::Local => has_local = true,
                        _ => has_remote = true,
                    },
                    None => {}
                }
            }
        }
    }

    if !has_urls {
        ProjectStatus::NoUrls
    } else if has_local && has_remote {
        ProjectStatus::Mixed
    } else if has_local {
        ProjectStatus::AllLocal
    } else {
        ProjectStatus::AllRemote
    }
}
