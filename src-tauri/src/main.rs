// Prevents an extra console window on Windows in release builds.
#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use std::process::Command;
use std::sync::Mutex;
use tauri::{Manager, State};

struct PythonProcess(Mutex<Option<std::process::Child>>);

/// Returns the status of the background Python analyzer process.
#[tauri::command]
fn analyzer_status(state: State<PythonProcess>) -> String {
    match &*state.0.lock().unwrap() {
        Some(_) => "running".to_string(),
        None    => "stopped".to_string(),
    }
}

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            // Resolve path to the Python analyzer script bundled with the app.
            let script = app
                .path_resolver()
                .resolve_resource("../scripts/analyze.py")
                .unwrap_or_else(|| std::path::PathBuf::from("scripts/analyze.py"));

            let child = Command::new("python3")
                .arg(&script)
                .spawn();

            match child {
                Ok(proc) => {
                    println!("[Moodify] Python analyzer started (PID {})", proc.id());
                    app.manage(PythonProcess(Mutex::new(Some(proc))));
                }
                Err(e) => {
                    eprintln!("[Moodify] Could not start Python analyzer: {e}");
                    app.manage(PythonProcess(Mutex::new(None)));
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![analyzer_status])
        .run(tauri::generate_context!())
        .expect("error while running Moodify");
}
