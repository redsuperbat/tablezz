# Tablezz

Tablezz is a keyboard-centric PostgreSQL table viewer built with Tauri.

## Configuration

Configuration is stored in a JSON format at:

```
~/tablezz/config.json
```

The configuration file is watched for changes and automatically reloaded.

### Example Configuration

```json
{
  "leaderKey": "Space",
  "keybinds": {
    "Space > n": "DatabaseUrlAdd",
    "Control + h": {
      "command": "CommandLineClose",
      "description": "Close the command line."
    }
  },
  "editor": "nvim"
}
```
