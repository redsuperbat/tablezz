use portable_pty::{CommandBuilder, MasterPty, NativePtySystem, PtySize, PtySystem};
use std::io::{Read, Write};
use std::sync::{Arc, Mutex};
use tauri::{Emitter, State};

pub struct PtyState {
    pub writer: Arc<Mutex<Box<dyn Write + Send>>>,
    pub master: Arc<Mutex<Box<dyn MasterPty + Send>>>,
}

#[tauri::command]
pub fn create_pty(
    window: tauri::Window,
    cols: u16,
    rows: u16,
    state: State<Arc<Mutex<Option<PtyState>>>>,
) -> Result<(), String> {
    let pty_system = NativePtySystem::default();

    let pair = pty_system
        .openpty(PtySize {
            rows,
            cols,
            pixel_width: 0,
            pixel_height: 0,
        })
        .map_err(|e| e.to_string())?;

    let cmd = CommandBuilder::new("nvim");
    let mut child = pair.slave.spawn_command(cmd).map_err(|e| e.to_string())?;

    let mut reader = pair.master.try_clone_reader().map_err(|e| e.to_string())?;
    let writer = pair.master.take_writer().map_err(|e| e.to_string())?;

    // Spawn thread to read PTY output
    let window_clone = window.clone();
    let window_clone_exit = window.clone();

    std::thread::spawn(move || {
        let mut buf = [0u8; 8192];
        loop {
            match reader.read(&mut buf) {
                Ok(0) => break,
                Ok(n) => {
                    let output = String::from_utf8_lossy(&buf[..n]).to_string();
                    if window_clone.emit("pty-output", output).is_err() {
                        break;
                    }
                }
                Err(_) => break,
            }
        }

        match child.wait() {
            Ok(status) => {
                let exit_code = status.exit_code();
                let _ = window_clone_exit.emit("pty-exit", exit_code);
            }
            Err(_) => {
                let _ = window_clone_exit.emit("pty-exit", -1);
            }
        }
    });

    // Store the writer and child in state
    *state.lock().map_err(|_| "Failed to lock PTY state")? = Some(PtyState {
        writer: Arc::new(Mutex::new(writer)),
        master: Arc::new(Mutex::new(pair.master)),
    });

    Ok(())
}

#[tauri::command]
pub fn resize_pty(
    cols: u16,
    rows: u16,
    state: State<Arc<Mutex<Option<PtyState>>>>,
) -> Result<(), String> {
    let guard = state.lock().map_err(|_| "Failed to lock PTY state")?;
    let size = PtySize {
        rows,
        cols,
        pixel_width: 0,
        pixel_height: 0,
    };
    if let Some(pty_state) = guard.as_ref() {
        let mut master = pty_state
            .master
            .lock()
            .map_err(|_| "Failed to lock PTY master")?;
        master.resize(size).map_err(|_| "Failed to resize pty")?;
    }
    Ok(())
}

#[tauri::command]
pub fn write_to_pty(
    data: String,
    state: State<Arc<Mutex<Option<PtyState>>>>,
) -> Result<(), String> {
    let guard = state.lock().map_err(|_| "Failed to lock PTY state")?;
    if let Some(pty_state) = guard.as_ref() {
        let mut writer = pty_state
            .writer
            .lock()
            .map_err(|_| "Failed to lock PTY writer")?;
        writer
            .write_all(data.as_bytes())
            .map_err(|e| e.to_string())?;
        writer.flush().map_err(|e| e.to_string())?;
    }
    Ok(())
}
