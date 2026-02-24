// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod winget;

use serde::Serialize;
use std::sync::{
    atomic::{AtomicBool, Ordering},
    Arc,
};
use std::thread;
use std::time::Duration;
use tauri::{
    menu::{Menu, MenuItem},
    tray::{TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, WebviewWindow,
};
use tauri_plugin_positioner::{Position, WindowExt};

const TRAY_OPEN_ID: &str = "tray_open_dashboard";
const TRAY_CHECK_ID: &str = "tray_check_updates";
const TRAY_EXIT_ID: &str = "tray_exit";

struct AppState {
    is_exiting: Arc<AtomicBool>,
    tray_position_initialized: Arc<AtomicBool>,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct UpdatesCheckedEvent {
    success: bool,
    count: usize,
    message: Option<String>,
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_positioner::init())
        .setup(|app| {
            let is_exiting = Arc::new(AtomicBool::new(false));
            let tray_position_initialized = Arc::new(AtomicBool::new(false));
            let suppress_focus_hide = Arc::new(AtomicBool::new(false));
            app.manage(AppState {
                is_exiting: is_exiting.clone(),
                tray_position_initialized: tray_position_initialized.clone(),
            });
            register_close_to_tray(
                app.get_webview_window("main"),
                is_exiting,
                suppress_focus_hide.clone(),
            );
            build_tray(app, tray_position_initialized, suppress_focus_hide)?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            winget::get_updates,
            winget::update_app
        ])
        .run(tauri::generate_context!())
        .expect("error running app");
}

fn register_close_to_tray(
    window: Option<WebviewWindow>,
    is_exiting: Arc<AtomicBool>,
    suppress_focus_hide: Arc<AtomicBool>,
) {
    if let Some(main_window) = window {
        let window_for_close = main_window.clone();
        main_window.on_window_event(move |event| match event {
            tauri::WindowEvent::CloseRequested { api, .. } => {
                if !is_exiting.load(Ordering::Relaxed) {
                    api.prevent_close();
                    let _ = window_for_close.hide();
                }
            }
            tauri::WindowEvent::Focused(false) => {
                if !is_exiting.load(Ordering::Relaxed)
                    && !suppress_focus_hide.load(Ordering::Relaxed)
                {
                    let _ = window_for_close.hide();
                }
            }
            _ => {}
        });
    }
}

fn build_tray(
    app: &mut tauri::App,
    tray_position_initialized: Arc<AtomicBool>,
    suppress_focus_hide: Arc<AtomicBool>,
) -> tauri::Result<()> {
    let open = MenuItem::with_id(app, TRAY_OPEN_ID, "Open Dashboard", true, None::<&str>)?;
    let check = MenuItem::with_id(app, TRAY_CHECK_ID, "Check Updates", true, None::<&str>)?;
    let exit = MenuItem::with_id(app, TRAY_EXIT_ID, "Exit", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &check, &exit])?;

    let mut tray = TrayIconBuilder::with_id("radiance-tray")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_tray_icon_event(move |app_handle, event| {
            tauri_plugin_positioner::on_tray_event(app_handle.app_handle(), &event);
            match event {
                TrayIconEvent::Click { .. }
                | TrayIconEvent::Move { .. }
                | TrayIconEvent::Enter { .. }
                | TrayIconEvent::Leave { .. } => {
                    tray_position_initialized.store(true, Ordering::Relaxed);
                }
                _ => {}
            }

            if let TrayIconEvent::Click {
                button,
                button_state,
                ..
            } = event
            {
                if button == tauri::tray::MouseButton::Left
                    && button_state == tauri::tray::MouseButtonState::Up
                {
                    suppress_focus_hide.store(true, Ordering::Relaxed);
                    let suppress_focus_hide_for_reset = suppress_focus_hide.clone();
                    thread::spawn(move || {
                        thread::sleep(Duration::from_millis(220));
                        suppress_focus_hide_for_reset.store(false, Ordering::Relaxed);
                    });
                    toggle_dashboard(app_handle.app_handle());
                }
            }
        })
        .on_menu_event(move |app_handle, event: tauri::menu::MenuEvent| {
            match event.id().as_ref() {
                TRAY_OPEN_ID => {
                    show_dashboard(app_handle);
                }
                TRAY_CHECK_ID => {
                    check_updates_from_tray(app_handle.clone());
                }
                TRAY_EXIT_ID => {
                    exit_application(app_handle);
                }
                _ => {}
            }
        });

    if let Some(icon) = app.default_window_icon() {
        tray = tray.icon(icon.clone());
    }

    tray.build(app)?;
    Ok(())
}

fn toggle_dashboard(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
            return;
        }
    }
    show_dashboard(app_handle);
}

fn show_dashboard(app_handle: &AppHandle) {
    if let Some(window) = app_handle.get_webview_window("main") {
        let state = app_handle.state::<AppState>();
        let use_tray_position = state.tray_position_initialized.load(Ordering::Relaxed);

        let _ = window.unminimize();
        if use_tray_position {
            let _ = window.move_window_constrained(Position::TrayCenter);
        } else {
            let _ = window.move_window(Position::TopRight);
        }
        let _ = window.show();
        let _ = window.set_focus();
    }
}

fn check_updates_from_tray(app_handle: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let task = tauri::async_runtime::spawn_blocking(winget::get_updates).await;

        let payload = match task {
            Ok(Ok(updates)) => UpdatesCheckedEvent {
                success: true,
                count: updates.len(),
                message: None,
            },
            Ok(Err(error)) => UpdatesCheckedEvent {
                success: false,
                count: 0,
                message: Some(error),
            },
            Err(error) => UpdatesCheckedEvent {
                success: false,
                count: 0,
                message: Some(format!("failed to check updates in tray: {error}")),
            },
        };

        let _ = app_handle.emit("updates:checked", payload);
    });
}

fn exit_application(app_handle: &AppHandle) {
    let state = app_handle.state::<AppState>();
    state.is_exiting.store(true, Ordering::Relaxed);
    app_handle.exit(0);
}

// // Learn more about Tauri commands at https://tauri.app/v1/guides/features/command
// #[tauri::command]
// fn greet(name: &str) -> String {
//     format!("Hello, {}! You've been greeted from Rust!", name)
// }

// fn main() {
//     tauri::Builder::default()
//         .plugin(tauri_plugin_shell::init())
//         .plugin(tauri_plugin_process::init())
//         .invoke_handler(tauri::generate_handler![greet])
//         .run(tauri::generate_context!())
//         .expect("error while running tauri application");
// }
