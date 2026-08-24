//! Replaces `src/editor/Editor.tsx` + `src-tauri/src/pty.rs`. There is no
//! terminal to emulate any more: suspend the TUI and hand the real one over.

use std::io::Write;
use std::path::PathBuf;
use std::process::Command;
use std::time::{SystemTime, UNIX_EPOCH};

/// Open `initial_content` in the configured editor and return what was saved.
pub fn edit(editor: &str, initial_content: &str, extension: &str) -> anyhow::Result<String> {
    let path = temp_path(extension);

    {
        let mut file = std::fs::File::create(&path)?;
        file.write_all(initial_content.as_bytes())?;
    }

    // The editor inherits stdin/stdout, so it drives the terminal directly.
    let status = Command::new(editor).arg(&path).status();

    let result = match status {
        Ok(status) if status.success() => std::fs::read_to_string(&path).map_err(Into::into),
        Ok(status) => Err(anyhow::anyhow!("{editor} exited with {status}")),
        Err(error) => Err(anyhow::anyhow!("could not run {editor}: {error}")),
    };

    let _ = std::fs::remove_file(&path);
    result
}

fn temp_path(extension: &str) -> PathBuf {
    let nanos = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.subsec_nanos())
        .unwrap_or_default();

    std::env::temp_dir().join(format!(
        "tablezz-edit-{}-{nanos}{extension}",
        std::process::id()
    ))
}
