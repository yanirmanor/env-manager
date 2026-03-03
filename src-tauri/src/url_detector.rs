use crate::types::{ServiceMap, UrlDirection};
use regex::Regex;
use std::sync::LazyLock;

static URL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)^(https?://|mysql://|postgres://|redis://|amqp://)").unwrap()
});

static LOCAL_RE: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r"(?i)(localhost|127\.0\.0\.1|0\.0\.0\.0)(:\d+)?").unwrap()
});

pub fn classify_value(value: &str, service_map: &ServiceMap) -> (bool, Option<UrlDirection>) {
    if value.is_empty() {
        return (false, None);
    }

    let is_url_protocol = URL_RE.is_match(value);
    let matches_starred = service_map
        .services
        .iter()
        .any(|s| value.contains(&s.remote_url));
    let looks_like_host = !is_url_protocol
        && (value.contains("localhost")
            || value.contains("127.0.0.1")
            || value.contains("0.0.0.0")
            || matches_starred);

    if !is_url_protocol && !looks_like_host {
        return (false, None);
    }

    // Check ignore list from service map
    for domain in &service_map.ignore_domains {
        if value.contains(domain.as_str()) {
            return (false, None);
        }
    }

    // Local URLs
    if LOCAL_RE.is_match(value) {
        return (true, Some(UrlDirection::Local));
    }

    // Database protocols
    if value.starts_with("mysql://")
        || value.starts_with("postgres://")
        || value.starts_with("redis://")
    {
        return (true, Some(UrlDirection::Database));
    }

    // Check against starred service remote URLs
    for service in &service_map.services {
        if value.contains(&service.remote_url) {
            let direction = if service.remote_url.contains(".internal.") {
                UrlDirection::InternalStaging
            } else {
                UrlDirection::Staging
            };
            return (true, Some(direction));
        }
    }

    // Any other http/https URL is a remote URL
    if is_url_protocol {
        return (true, Some(UrlDirection::Staging));
    }

    (false, None)
}

pub fn toggle_url(value: &str, direction: &str, service_map: &[(String, String)]) -> Option<String> {
    let target_local = direction == "local";

    // Try to match against service map
    for (remote, local) in service_map {
        if target_local && value.contains(remote.as_str()) {
            return Some(value.replace(remote.as_str(), local.as_str()));
        }
        if !target_local && value.contains(local.as_str()) {
            return Some(value.replace(local.as_str(), remote.as_str()));
        }
    }

    // Fallback: generic localhost toggle
    if target_local {
        if let Some(host) = extract_host(value) {
            let local = format!("http://localhost:{}", guess_port(&host));
            return Some(local);
        }
    }

    None
}

fn extract_host(url: &str) -> Option<String> {
    let stripped = url
        .strip_prefix("https://")
        .or_else(|| url.strip_prefix("http://"))?;
    let host = stripped.split('/').next()?;
    Some(host.to_string())
}

fn guess_port(host: &str) -> u16 {
    let hash: u32 = host.bytes().map(|b| b as u32).sum();
    3000 + (hash % 1000) as u16
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::types::ServiceMapping;

    fn test_service_map() -> ServiceMap {
        ServiceMap {
            services: vec![
                ServiceMapping {
                    name: "api-server".into(),
                    remote_url: "api.staging.example.com".into(),
                    local_url: "localhost:3001".into(),
                    env_keys: vec![],
                },
                ServiceMapping {
                    name: "internal-api".into(),
                    remote_url: "api.internal.staging.example.com".into(),
                    local_url: "localhost:3002".into(),
                    env_keys: vec![],
                },
            ],
            ignore_domains: vec!["sentry.io".into(), "auth0.com".into()],
        }
    }

    #[test]
    fn test_staging_url() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("https://api.staging.example.com", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Staging));
    }

    #[test]
    fn test_internal_staging() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("https://api.internal.staging.example.com", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::InternalStaging));
    }

    #[test]
    fn test_localhost() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("http://localhost:3001", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Local));
    }

    #[test]
    fn test_ignored_domain() {
        let map = test_service_map();
        let (is_url, _) = classify_value("https://my-app.auth0.com", &map);
        assert!(!is_url);
    }

    #[test]
    fn test_bare_host() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("api.staging.example.com", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Staging));
    }

    #[test]
    fn test_unknown_url() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("https://some-random-site.com", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Staging));
    }

    #[test]
    fn test_database_url() {
        let map = test_service_map();
        let (is_url, dir) = classify_value("postgres://user:pass@db.example.com/mydb", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Database));
    }

    #[test]
    fn test_empty_service_map() {
        let map = ServiceMap {
            services: vec![],
            ignore_domains: vec![],
        };
        let (is_url, dir) = classify_value("http://localhost:3000", &map);
        assert!(is_url);
        assert_eq!(dir, Some(UrlDirection::Local));
    }
}
