use portable_pty::{CommandBuilder, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

pub struct PtyState {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub reader: Arc<Mutex<Box<dyn Read + Send>>>,
}

#[tauri::command]
pub fn create_pty(
    window: tauri::Window,
    state: State<Arc<Mutex<Option<PtyState>>>>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows: 24,
            cols: 80,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let mut cmd = CommandBuilder::new("fish"); // or "powershell" on Windows
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Spawn thread to read PTY output
    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    window.emit_str("pty-output", output).ok();
                }
                Err(_) => break,
            }
        }
    });

    *state.lock().unwrap() = Some(PtyState {
        writer: Arc::new(Mutex::new(writer)),
        reader: Arc::new(Mutex::new(Box::new(std::io::empty()))),
    });

    Ok(())
}

#[tauri::command]
pub fn write_to_pty(
    data: String,
    state: State<Arc<Mutex<Option<PtyState>>>>,
) -> Result<(), String> {
    if let Some(pty_state) = state.lock().unwrap().as_ref() {
        let mut writer = pty_state.writer.lock().unwrap();
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}
