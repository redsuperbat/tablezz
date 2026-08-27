//! Markdown table encoding for editing a block of cells in `$EDITOR`.
//!
//! A real format rather than an invented one: nvim highlights it, and
//! `tabular.vim` / `vim-table-mode` already know how to realign it. Rows carry
//! their row number in a leading `#` column and are matched back by it, the way
//! `vidir` matches renamed files, so reordering or deleting lines in the editor
//! is safe.

use unicode_width::UnicodeWidthStr;

use super::selection::CellRef;
use super::Table;

/// U+2400, so a real `NULL` is distinguishable from the string `"null"`.
const NULL: &str = "␀";
const ROW_NUMBER_HEADER: &str = "#";

/// The block of cells being edited, as table indices.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct GridSelection {
    pub rows: Vec<usize>,
    pub columns: Vec<usize>,
}

impl GridSelection {
    pub fn from_cells(cells: &[CellRef]) -> Self {
        let mut rows: Vec<usize> = cells.iter().map(|(row, _)| *row).collect();
        let mut columns: Vec<usize> = cells.iter().map(|(_, column)| *column).collect();

        rows.sort_unstable();
        rows.dedup();
        columns.sort_unstable();
        columns.dedup();

        Self { rows, columns }
    }
}

pub fn encode(table: &Table, selection: &GridSelection) -> String {
    let mut header: Vec<String> = vec![ROW_NUMBER_HEADER.to_string()];
    header.extend(selection.columns.iter().map(|index| {
        table
            .column(*index)
            .map(|column| escape(&column.name))
            .unwrap_or_default()
    }));

    let rows: Vec<Vec<String>> = selection
        .rows
        .iter()
        .map(|row| {
            let mut cells = vec![(row + 1).to_string()];
            cells.extend(
                selection
                    .columns
                    .iter()
                    .map(|column| encode_cell(table, *row, *column)),
            );
            cells
        })
        .collect();

    // Pad to the widest entry so the grid lines up on arrival; the editor is
    // free to realign it afterwards, since padding is trimmed on the way back.
    let widths: Vec<usize> = (0..header.len())
        .map(|index| {
            rows.iter()
                .map(|row| row.get(index).map(|cell| cell.width()).unwrap_or(0))
                .chain(std::iter::once(header[index].width()))
                .max()
                .unwrap_or(1)
                .max(1)
        })
        .collect();

    let mut out = String::new();
    out.push_str(&render_row(&header, &widths));
    out.push('\n');
    out.push_str(&render_rule(&widths));

    for row in &rows {
        out.push('\n');
        out.push_str(&render_row(row, &widths));
    }

    out
}

fn encode_cell(table: &Table, row: usize, column: usize) -> String {
    match (table.cell(row, column), table.column(column)) {
        (Some(cell), Some(_)) if cell.is_null() => NULL.to_string(),
        (Some(cell), Some(column)) => escape(&cell.to_display(column)),
        _ => String::new(),
    }
}

fn render_row(cells: &[String], widths: &[usize]) -> String {
    let mut out = String::from("|");
    for (index, cell) in cells.iter().enumerate() {
        let pad = widths
            .get(index)
            .copied()
            .unwrap_or(0)
            .saturating_sub(cell.width());
        out.push(' ');
        out.push_str(cell);
        out.push_str(&" ".repeat(pad));
        out.push_str(" |");
    }
    out
}

fn render_rule(widths: &[usize]) -> String {
    let mut out = String::from("|");
    for width in widths {
        out.push_str(&"-".repeat(width + 2));
        out.push('|');
    }
    out
}

/// Apply an edited grid. Rows may be reordered or dropped; a dropped row is
/// simply left alone. Anything structurally wrong is refused outright, so a
/// mangled grid can never half-apply.
pub fn decode(
    table: &mut Table,
    selection: &GridSelection,
    text: &str,
) -> Result<Vec<CellRef>, String> {
    let expected_columns = selection.columns.len() + 1;

    let mut lines = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty() && !is_rule(line));

    let header = lines
        .next()
        .ok_or("the grid is empty; nothing was changed")?;
    let header_cells = split_row(header);

    if header_cells.len() != expected_columns {
        return Err(format!(
            "expected {expected_columns} columns in the header, got {}; nothing was changed",
            header_cells.len()
        ));
    }

    for (index, name) in header_cells.iter().skip(1).enumerate() {
        let expected = selection
            .columns
            .get(index)
            .and_then(|column| table.column(*column))
            .map(|column| column.name.clone())
            .unwrap_or_default();

        if unescape(name) != expected {
            return Err(format!(
                "column {} is \"{}\" in the grid but \"{expected}\" in the table; nothing was changed",
                index + 1,
                unescape(name)
            ));
        }
    }

    // Validate every row before writing any of it.
    let mut edits: Vec<(usize, Vec<String>)> = Vec::new();
    let mut seen: Vec<usize> = Vec::new();

    for (index, line) in lines.enumerate() {
        let cells = split_row(line);

        if cells.len() != expected_columns {
            return Err(format!(
                "expected {expected_columns} columns in row {}, got {}; nothing was changed",
                index + 1,
                cells.len()
            ));
        }

        let number: usize = unescape(&cells[0])
            .parse()
            .map_err(|_| format!("\"{}\" is not a row number; nothing was changed", cells[0]))?;

        let row = number
            .checked_sub(1)
            .filter(|row| selection.rows.contains(row))
            .ok_or_else(|| format!("row {number} was not part of the selection"))?;

        if seen.contains(&row) {
            return Err(format!("row {number} appears twice; nothing was changed"));
        }
        seen.push(row);

        edits.push((
            row,
            cells.into_iter().skip(1).map(|c| unescape(&c)).collect(),
        ));
    }

    let mut updated = Vec::new();
    for (row, values) in edits {
        for (index, value) in values.into_iter().enumerate() {
            let Some(column) = selection.columns.get(index).copied() else {
                continue;
            };

            // The cell turns "NULL" into a database NULL for nullable columns
            let value = if value == NULL { "NULL" } else { &value };

            let before = table.cell(row, column).map(|cell| cell.is_dirty());
            table.update_cell(row, column, value)?;

            if before != table.cell(row, column).map(|cell| cell.is_dirty()) {
                updated.push((row, column));
            }
        }
    }

    Ok(updated)
}

fn is_rule(line: &str) -> bool {
    line.starts_with('|')
        && line
            .chars()
            .all(|c| matches!(c, '|' | '-' | ':' | ' ' | '\t'))
        && line.contains('-')
}

/// Split a `| a | b |` row on unescaped pipes.
fn split_row(line: &str) -> Vec<String> {
    let mut cells = Vec::new();
    let mut current = String::new();
    let mut escaped = false;

    let line = line.strip_prefix('|').unwrap_or(line);

    for char in line.chars() {
        if escaped {
            current.push(char);
            escaped = false;
        } else if char == '\\' {
            current.push(char);
            escaped = true;
        } else if char == '|' {
            cells.push(current.trim().to_string());
            current = String::new();
        } else {
            current.push(char);
        }
    }

    let trailing = current.trim();
    if !trailing.is_empty() {
        cells.push(trailing.to_string());
    }

    cells
}

fn escape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());

    for char in value.chars() {
        match char {
            '\\' => out.push_str("\\\\"),
            '|' => out.push_str("\\|"),
            '\n' => out.push_str("\\n"),
            '\r' => out.push_str("\\r"),
            '\t' => out.push_str("\\t"),
            _ => out.push(char),
        }
    }

    if value == NULL {
        return format!("\\{NULL}");
    }

    // Padding is trimmed on the way back, so significant edge whitespace has to
    // survive as an escape that trimming cannot eat — hence `\s` rather than a
    // backslash followed by the space itself.
    if out.starts_with(' ') {
        out.replace_range(0..1, "\\s");
    }
    if out.ends_with(' ') {
        let last = out.len() - 1;
        out.replace_range(last.., "\\s");
    }

    out
}

fn unescape(value: &str) -> String {
    let mut out = String::with_capacity(value.len());
    let mut chars = value.chars();

    while let Some(char) = chars.next() {
        if char != '\\' {
            out.push(char);
            continue;
        }

        match chars.next() {
            Some('\\') => out.push('\\'),
            Some('|') => out.push('|'),
            Some('n') => out.push('\n'),
            Some('r') => out.push('\r'),
            Some('t') => out.push('\t'),
            Some('s') => out.push(' '),
            // An unknown escape is left as the user wrote it
            Some(other) => {
                out.push('\\');
                out.push(other);
            }
            None => out.push('\\'),
        }
    }

    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{ColumnInfo, JsonRow};
    use serde_json::{json, Value as JsonValue};

    fn table_with(values: &[[JsonValue; 2]]) -> Table {
        let structure: Vec<ColumnInfo> = ["name", "note"]
            .iter()
            .map(|name| ColumnInfo {
                column_name: name.to_string(),
                data_type: "text".to_string(),
                is_primary: false,
                is_nullable: true,
                foreign_key: None,
            })
            .collect();

        let rows: Vec<JsonRow> = values
            .iter()
            .map(|[name, note]| {
                [
                    ("name".to_string(), name.clone()),
                    ("note".to_string(), note.clone()),
                ]
                .into_iter()
                .collect()
            })
            .collect();

        Table::new("t".into(), &structure, rows)
    }

    fn selection() -> GridSelection {
        GridSelection {
            rows: vec![0, 1],
            columns: vec![0, 1],
        }
    }

    #[test]
    fn renders_an_aligned_grid() {
        let table = table_with(&[
            [json!("ada"), json!("first")],
            [json!("grace"), JsonValue::Null],
        ]);

        assert_eq!(
            encode(&table, &selection()),
            "\
| # | name  | note  |
|---|-------|-------|
| 1 | ada   | first |
| 2 | grace | ␀     |"
        );
    }

    #[test]
    fn round_trips_awkward_values() {
        let table = table_with(&[
            [json!("a|b"), json!("line\nbreak")],
            [json!("back\\slash"), json!(" padded ")],
        ]);

        let grid = encode(&table, &selection());
        assert!(grid.contains("a\\|b"), "{grid}");
        assert!(grid.contains("line\\nbreak"), "{grid}");
        assert!(grid.contains("back\\\\slash"), "{grid}");

        let mut applied = table_with(&[[json!("x"), json!("x")], [json!("x"), json!("x")]]);
        decode(&mut applied, &selection(), &grid).unwrap();

        assert_eq!(applied.cell_display(0, 0), "a|b");
        assert_eq!(applied.cell_display(0, 1), "line\nbreak");
        assert_eq!(applied.cell_display(1, 0), "back\\slash");
        assert_eq!(applied.cell_display(1, 1), " padded ");
    }

    #[test]
    fn null_survives_and_is_not_the_string_null() {
        let table = table_with(&[
            [JsonValue::Null, json!("null")],
            [json!("x"), JsonValue::Null],
        ]);

        let grid = encode(&table, &selection());
        assert!(grid.contains("| ␀ "), "{grid}");
        assert!(grid.contains("null"), "{grid}");

        let mut applied = table_with(&[[json!("a"), json!("b")], [json!("c"), json!("d")]]);
        decode(&mut applied, &selection(), &grid).unwrap();

        assert!(applied.cell(0, 0).unwrap().is_null());
        assert_eq!(applied.cell_display(0, 1), "null");
        assert!(applied.cell(1, 1).unwrap().is_null());
    }

    #[test]
    fn rows_are_matched_by_number_not_position() {
        let mut table = table_with(&[[json!("ada"), json!("a")], [json!("grace"), json!("b")]]);

        // reordered, and realigned the way table-mode would leave it
        let edited = "\
|  # | name    | note |
|----|---------|------|
|  2 | GRACE   | b    |
|  1 | ada     | a    |";

        let updated = decode(&mut table, &selection(), edited).unwrap();

        assert_eq!(updated, vec![(1, 0)]);
        assert_eq!(table.cell_display(1, 0), "GRACE");
        assert_eq!(table.cell_display(0, 0), "ada", "untouched");
    }

    #[test]
    fn a_dropped_row_is_left_alone() {
        let mut table = table_with(&[[json!("ada"), json!("a")], [json!("grace"), json!("b")]]);

        let edited = "\
| # | name | note |
|---|------|------|
| 1 | ADA  | a    |";

        decode(&mut table, &selection(), edited).unwrap();

        assert_eq!(table.cell_display(0, 0), "ADA");
        assert_eq!(
            table.cell_display(1, 0),
            "grace",
            "not deleted, just skipped"
        );
    }

    #[test]
    fn structural_damage_is_refused_whole() {
        let mut table = table_with(&[[json!("ada"), json!("a")], [json!("grace"), json!("b")]]);

        let cases = [
            // a column went missing
            "| # | name |\n|---|------|\n| 1 | ADA |",
            // the header was edited
            "| # | nmae | note |\n|---|------|------|\n| 1 | ADA | a |",
            // a row number that was not in the selection
            "| # | name | note |\n|---|------|------|\n| 9 | ADA | a |",
            // the same row twice
            "| # | name | note |\n|---|------|------|\n| 1 | ADA | a |\n| 1 | X | a |",
            // a row number that is not a number
            "| # | name | note |\n|---|------|------|\n| x | ADA | a |",
        ];

        for case in cases {
            assert!(decode(&mut table, &selection(), case).is_err(), "{case}");
            assert_eq!(table.cell_display(0, 0), "ada", "unchanged after {case}");
            assert!(table.dirty_cells().is_empty());
        }
    }

    #[test]
    fn only_changed_cells_are_reported_dirty() {
        let mut table = table_with(&[[json!("ada"), json!("a")], [json!("grace"), json!("b")]]);
        let grid = encode(&table, &selection());

        let updated = decode(&mut table, &selection(), &grid).unwrap();

        assert!(
            updated.is_empty(),
            "a round trip with no edits changes nothing"
        );
        assert!(table.dirty_cells().is_empty());
    }
}
