use serde::Serialize;
use serde_json::Value;
use std::collections::HashSet;
use std::io::ErrorKind;
use std::process::{Command, Output};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppUpdate {
    id: String,
    name: String,
    installed_version: String,
    available_version: String,
    source: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateResult {
    id: String,
    success: bool,
    exit_code: Option<i32>,
    message: String,
}

#[tauri::command]
pub fn get_updates() -> Result<Vec<AppUpdate>, String> {
    let json_output = execute_winget(&["upgrade", "--output", "json", "--disable-interactivity"])?;

    let json_stdout = String::from_utf8_lossy(&json_output.stdout);
    let json_stderr = String::from_utf8_lossy(&json_output.stderr);

    let mut updates = if json_output.status.success() && !json_stdout.trim().is_empty() {
        parse_json_updates(&json_stdout)?
    } else if output_flag_not_supported(&json_stdout, &json_stderr) {
        let table_output = execute_winget(&[
            "upgrade",
            "--disable-interactivity",
            "--accept-source-agreements",
        ])?;

        let table_stdout = String::from_utf8_lossy(&table_output.stdout);
        let table_stderr = String::from_utf8_lossy(&table_output.stderr);

        if !table_output.status.success() {
            return Err(build_winget_error(
                table_output.status.code(),
                &table_stderr,
                &table_stdout,
            ));
        }

        if looks_like_no_updates_message(&table_stdout) {
            Vec::new()
        } else {
            parse_table_updates(&table_stdout)
        }
    } else if json_output.status.success() && looks_like_no_updates_message(&json_stdout) {
        Vec::new()
    } else {
        return Err(build_winget_error(
            json_output.status.code(),
            &json_stderr,
            &json_stdout,
        ));
    };

    // Avoid duplicated items that can come from multiple sources.
    let mut seen = HashSet::new();
    updates.retain(|item| seen.insert(item.id.clone()));

    updates.sort_by_key(|item| item.name.to_lowercase());
    Ok(updates)
}

#[tauri::command]
pub fn update_app(id: String) -> Result<UpdateResult, String> {
    let normalized_id = id.trim().to_string();
    if normalized_id.is_empty() {
        return Err("invalid package id".to_string());
    }

    let output = execute_winget(&[
        "upgrade",
        "--id",
        &normalized_id,
        "--exact",
        "--silent",
        "--disable-interactivity",
        "--accept-package-agreements",
        "--accept-source-agreements",
    ])?;

    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let success = output.status.success();

    let message = if success {
        if stdout.is_empty() {
            "Update executed successfully.".to_string()
        } else {
            stdout
        }
    } else if !stderr.is_empty() {
        stderr
    } else if !stdout.is_empty() {
        stdout
    } else {
        "winget returned an unknown error.".to_string()
    };

    Ok(UpdateResult {
        id: normalized_id,
        success,
        exit_code: output.status.code(),
        message,
    })
}

fn execute_winget(args: &[&str]) -> Result<Output, String> {
    Command::new("winget").args(args).output().map_err(|error| {
        if error.kind() == ErrorKind::NotFound {
            return "winget is not installed or not available in PATH.".to_string();
        }
        format!("failed to execute winget: {error}")
    })
}

fn parse_packages(parsed: &Value) -> Vec<&Value> {
    if let Some(arr) = parsed.as_array() {
        return arr.iter().collect();
    }

    let mut packages = Vec::new();

    if let Some(sources) = parsed.get("Sources").and_then(Value::as_array) {
        for source in sources {
            if let Some(source_packages) = source.get("Packages").and_then(Value::as_array) {
                packages.extend(source_packages.iter());
            }
        }
    }

    if let Some(arr) = parsed.get("Packages").and_then(Value::as_array) {
        packages.extend(arr.iter());
    }

    if let Some(arr) = parsed.get("Data").and_then(Value::as_array) {
        packages.extend(arr.iter());
    }

    packages
}

fn to_app_update(item: &Value) -> Option<AppUpdate> {
    let id = read_first_string(item, &["Id", "PackageIdentifier", "PackageId"]);
    let name = read_first_string(item, &["Name", "PackageName"]);

    // `update_app` depends on a stable package id. Entries without id are unusable.
    if id.is_empty() {
        return None;
    }

    Some(AppUpdate {
        id,
        name,
        installed_version: read_first_string(item, &["InstalledVersion", "Installed"]),
        available_version: read_first_string(item, &["AvailableVersion", "Available", "Version"]),
        source: read_first_string(item, &["Source", "SourceName", "Repository"]),
    })
}

fn parse_json_updates(stdout: &str) -> Result<Vec<AppUpdate>, String> {
    let parsed: Value = serde_json::from_str(stdout)
        .map_err(|e| format!("failed to parse winget json output: {e}"))?;

    Ok(parse_packages(&parsed)
        .into_iter()
        .filter_map(to_app_update)
        .collect::<Vec<_>>())
}

fn parse_table_updates(stdout: &str) -> Vec<AppUpdate> {
    let mut updates = Vec::new();
    let normalized = stdout.replace('\r', "\n");
    let mut is_data_section = false;

    for line in normalized.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() {
            continue;
        }

        if !is_data_section {
            if is_separator_line(trimmed) {
                is_data_section = true;
            }
            continue;
        }

        if looks_like_summary_line(trimmed) {
            break;
        }

        let columns = split_columns(trimmed);
        if columns.len() < 4 {
            continue;
        }

        let source = if columns.len() >= 5 {
            columns[4].clone()
        } else {
            String::new()
        };

        let id = columns[1].clone();
        if id.is_empty() {
            continue;
        }

        updates.push(AppUpdate {
            name: columns[0].clone(),
            id,
            installed_version: columns[2].clone(),
            available_version: columns[3].clone(),
            source,
        });
    }

    updates
}

fn split_columns(line: &str) -> Vec<String> {
    let mut columns = Vec::new();
    let mut current = String::new();
    let mut space_count = 0u8;

    for ch in line.chars() {
        if ch == ' ' {
            space_count = space_count.saturating_add(1);
            if space_count < 2 {
                current.push(ch);
            } else if !current.trim().is_empty() {
                columns.push(current.trim().to_string());
                current.clear();
            }
            continue;
        }

        if space_count >= 2 {
            space_count = 0;
        } else {
            space_count = 0;
        }
        current.push(ch);
    }

    if !current.trim().is_empty() {
        columns.push(current.trim().to_string());
    }

    columns
}

fn looks_like_no_updates_message(output: &str) -> bool {
    let normalized = output.to_lowercase();
    normalized.contains("no applicable update found")
        || normalized.contains("no installed package found matching")
        || normalized.contains("no package found")
        || normalized.contains("nenhuma atualização aplicável encontrada")
        || normalized.contains("nenhuma atualizacao aplicavel encontrada")
        || normalized.contains("nenhum pacote instalado correspondente foi encontrado")
        || normalized.contains("0 upgrades available")
}

fn output_flag_not_supported(stdout: &str, stderr: &str) -> bool {
    let all = format!("{stdout}\n{stderr}").to_lowercase();
    all.contains("--output")
        && (all.contains("argument name was not recognized")
            || all.contains("não foi reconhecido")
            || all.contains("nao foi reconhecido"))
}

fn looks_like_summary_line(line: &str) -> bool {
    let normalized = line.to_lowercase();
    normalized.contains("upgrades available")
        || normalized.contains("atualizações disponíveis")
        || normalized.contains("atualizacoes disponiveis")
}

fn is_separator_line(line: &str) -> bool {
    let no_spaces = line.replace(' ', "");
    no_spaces.len() >= 10 && no_spaces.chars().all(|ch| ch == '-')
}

fn truncate_text(value: &str, max_len: usize) -> String {
    let trimmed = value.trim();
    if trimmed.chars().count() <= max_len {
        return trimmed.to_string();
    }
    let truncated = trimmed.chars().take(max_len).collect::<String>();
    format!("{truncated}...")
}

fn build_winget_error(exit_code: Option<i32>, stderr: &str, stdout: &str) -> String {
    if !stderr.trim().is_empty() {
        return format!(
            "winget returned error (code: {:?}): {}",
            exit_code,
            stderr.trim()
        );
    }
    format!(
        "winget returned error (code: {:?}): {}",
        exit_code,
        truncate_text(stdout, 300)
    )
}

#[cfg(test)]
mod tests {
    use super::{parse_table_updates, split_columns};

    #[test]
    fn split_columns_handles_name_with_spaces() {
        let line =
            "7-Zip 25.01 (x64)                          7zip.7zip      25.01   26.00   winget";
        let columns = split_columns(line);
        assert_eq!(columns[0], "7-Zip 25.01 (x64)");
        assert_eq!(columns[1], "7zip.7zip");
        assert_eq!(columns[2], "25.01");
        assert_eq!(columns[3], "26.00");
        assert_eq!(columns[4], "winget");
    }

    #[test]
    fn parse_table_updates_extracts_rows() {
        let output = r#"
Name                                       Id                                    Version         Available      Source
-----------------------------------------------------------------------------------------------------------------------
TreeSize Free V4.7.1 (64 bit)              JAMSoftware.TreeSize.Free             < 4.8.1.610     4.8.1.610      winget
Google Chrome                              Google.Chrome.EXE                     145.0.7632.109  145.0.7632.110 winget
2 upgrades available.
"#;

        let updates = parse_table_updates(output);
        assert_eq!(updates.len(), 2);
        assert_eq!(updates[0].id, "JAMSoftware.TreeSize.Free");
        assert_eq!(updates[0].installed_version, "< 4.8.1.610");
        assert_eq!(updates[1].id, "Google.Chrome.EXE");
    }
}

fn read_first_string(item: &Value, keys: &[&str]) -> String {
    for key in keys {
        if let Some(value) = item.get(*key).and_then(Value::as_str) {
            return value.to_string();
        }
    }
    String::new()
}
