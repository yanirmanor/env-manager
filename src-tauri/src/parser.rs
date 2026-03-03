use crate::service_map;
use crate::types::{EnvEntry, ServiceMap, ValueCategory};
use crate::url_detector;
use std::fs;

#[tauri::command]
pub fn get_env_entries(project: &str) -> Vec<EnvEntry> {
    let project_path = std::path::Path::new(project);
    if !project_path.exists() {
        return vec![];
    }

    let smap = service_map::load_service_map();
    let mut all_entries = Vec::new();
    if let Ok(entries) = std::fs::read_dir(project) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().to_string();
            if name.starts_with(".env") {
                let path = entry.path().to_string_lossy().to_string();
                all_entries.extend(parse_env_file_with_map(&path, &smap));
            }
        }
    }
    all_entries
}

pub fn parse_env_file(path: &str) -> Vec<EnvEntry> {
    let smap = service_map::load_service_map();
    parse_env_file_with_map(path, &smap)
}

fn parse_env_file_with_map(path: &str, service_map: &ServiceMap) -> Vec<EnvEntry> {
    let content = match fs::read_to_string(path) {
        Ok(c) => c,
        Err(_) => return vec![],
    };

    parse_env_content(&content, path, service_map)
}

pub fn parse_env_content(content: &str, file_path: &str, service_map: &ServiceMap) -> Vec<EnvEntry> {
    let mut entries = Vec::new();

    for (line_idx, line) in content.lines().enumerate() {
        let trimmed = line.trim();

        if trimmed.is_empty() {
            continue;
        }

        if trimmed.starts_with('#') {
            entries.push(EnvEntry {
                key: String::new(),
                value: trimmed.to_string(),
                file: file_path.to_string(),
                line_number: line_idx + 1,
                category: ValueCategory::Config,
                is_comment: true,
                raw_line: line.to_string(),
                is_url: false,
                url_direction: None,
            });
            continue;
        }

        let (key, value) = match parse_key_value(trimmed) {
            Some(kv) => kv,
            None => continue,
        };

        let category = categorize_value(&key, &value);
        let (is_url, url_direction) = url_detector::classify_value(&value, service_map);

        entries.push(EnvEntry {
            key,
            value,
            file: file_path.to_string(),
            line_number: line_idx + 1,
            category,
            is_comment: false,
            raw_line: line.to_string(),
            is_url,
            url_direction,
        });
    }

    entries
}

fn parse_key_value(line: &str) -> Option<(String, String)> {
    let eq_pos = line.find('=')?;
    let key = line[..eq_pos].trim().to_string();
    if key.is_empty() {
        return None;
    }

    // Strip export prefix
    let key = key.strip_prefix("export ").unwrap_or(&key).trim().to_string();

    let raw_value = line[eq_pos + 1..].trim();

    // Handle quoted values
    let value = if (raw_value.starts_with('"') && raw_value.ends_with('"'))
        || (raw_value.starts_with('\'') && raw_value.ends_with('\''))
    {
        raw_value[1..raw_value.len() - 1].to_string()
    } else {
        // Strip inline comments (but not in URLs or values with #)
        let value = if let Some(hash_pos) = raw_value.find(" #") {
            raw_value[..hash_pos].trim().to_string()
        } else {
            raw_value.to_string()
        };
        // Strip trailing semicolons
        value.trim_end_matches(';').trim().to_string()
    };

    Some((key, value))
}

fn categorize_value(key: &str, value: &str) -> ValueCategory {
    let key_upper = key.to_uppercase();
    let value_lower = value.to_lowercase();

    if key_upper.contains("SECRET")
        || key_upper.contains("TOKEN")
        || key_upper.contains("PASSWORD")
        || key_upper.contains("KEY")
        || key_upper.contains("PRIVATE")
        || key_upper.contains("CREDENTIAL")
    {
        return ValueCategory::Credential;
    }

    if value_lower.starts_with("http://")
        || value_lower.starts_with("https://")
        || value_lower.starts_with("mysql://")
        || value_lower.starts_with("postgres://")
        || value_lower.starts_with("redis://")
        || value_lower.starts_with("amqp://")
    {
        return ValueCategory::Url;
    }

    if key_upper.contains("PORT") || value.parse::<u16>().is_ok() && value.len() <= 5 {
        if let Ok(n) = value.parse::<u16>() {
            if (1024..=65535).contains(&n) {
                return ValueCategory::Port;
            }
        }
    }

    if key_upper.contains("HOST") || key_upper.contains("HOSTNAME") {
        return ValueCategory::Host;
    }

    if value_lower == "true" || value_lower == "false" || value == "0" || value == "1" {
        return ValueCategory::Flag;
    }

    ValueCategory::Config
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ServiceMap;

    fn empty_map() -> ServiceMap {
        ServiceMap {
            services: vec![],
            ignore_domains: vec![],
        }
    }

    #[test]
    fn test_parse_simple() {
        let entries = parse_env_content("FOO=bar\nBAZ=qux", "test.env", &empty_map());
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].key, "FOO");
        assert_eq!(entries[0].value, "bar");
    }

    #[test]
    fn test_parse_quoted() {
        let entries = parse_env_content("FOO=\"hello world\"", "test.env", &empty_map());
        assert_eq!(entries[0].value, "hello world");
    }

    #[test]
    fn test_parse_comment() {
        let entries = parse_env_content("# This is a comment\nFOO=bar", "test.env", &empty_map());
        assert_eq!(entries.len(), 2);
        assert!(entries[0].is_comment);
        assert!(!entries[1].is_comment);
    }

    #[test]
    fn test_parse_export() {
        let entries = parse_env_content("export FOO=bar", "test.env", &empty_map());
        assert_eq!(entries[0].key, "FOO");
    }

    #[test]
    fn test_credential_detection() {
        let entries = parse_env_content("API_SECRET=abc123", "test.env", &empty_map());
        assert_eq!(entries[0].category, ValueCategory::Credential);
    }
}
