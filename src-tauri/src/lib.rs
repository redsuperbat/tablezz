mod postgres;
mod pty;

use std::sync::{Arc, Mutex};
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .setup(|app| {
            postgres::init(app);
            Ok(())
        })
        .manage(Arc::new(Mutex::new(None::<pty::PtyState>)))
        .invoke_handler(tauri::generate_handler![
            pty::create_pty,
            pty::write_to_pty,
            pty::resize_pty,
            postgres::load,
            postgres::select,
            postgres::table_structure,
            postgres::batch_execute,
            postgres::raw_execute,
            postgres::get_table_references,
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                let db_instances = app.state::<postgres::DbInstances>();
                tauri::async_runtime::block_on(async {
                    postgres::cleanup(&db_instances).await;
                });
            }
        });
}
