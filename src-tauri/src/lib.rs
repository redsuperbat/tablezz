mod postgres;
mod pty;

use std::sync::{Arc, Mutex};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(postgres::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .manage(Arc::new(Mutex::new(None::<pty::PtyState>)))
        .invoke_handler(tauri::generate_handler![
            pty::create_pty,
            pty::write_to_pty,
            pty::resize_pty,
            postgres::table_structure,
            postgres::batch_execute,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
