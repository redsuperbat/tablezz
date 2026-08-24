//! Port of `src/table/VisualSelection.tsx`. Cell references become
//! `(row, column)` indices; the cursor is passed in rather than held.

use super::Table;

pub type CellRef = (usize, usize);

#[derive(Debug, Clone, Copy, Default)]
pub struct VisualSelection {
    /// Where visual mode was entered, if it is active.
    pub start: Option<CellRef>,
}

impl VisualSelection {
    pub fn is_selecting(&self) -> bool {
        self.start.is_some()
    }

    pub fn exit(&mut self) {
        self.start = None;
    }

    fn bounds(&self, current: CellRef) -> Option<(CellRef, CellRef)> {
        let start = self.start?;
        Some((
            (start.0.min(current.0), start.1.min(current.1)),
            (start.0.max(current.0), start.1.max(current.1)),
        ))
    }

    pub fn contains_cell(&self, current: CellRef, cell: CellRef) -> bool {
        let Some((min, max)) = self.bounds(current) else {
            return false;
        };
        (min.0..=max.0).contains(&cell.0) && (min.1..=max.1).contains(&cell.1)
    }

    /// Every selected cell, or just the cursor when visual mode is off.
    pub fn cells(&self, current: CellRef, table: &Table) -> Vec<CellRef> {
        let Some((min, max)) = self.bounds(current) else {
            return vec![current];
        };

        (min.0..=max.0)
            .filter(|row| *row < table.rows().len())
            .flat_map(|row| {
                (min.1..=max.1)
                    .filter(|column| *column < table.columns().len())
                    .map(move |column| (row, column))
            })
            .collect()
    }

    /// Every selected row, or just the cursor's row when visual mode is off.
    pub fn rows(&self, current: CellRef, table: &Table) -> Vec<usize> {
        let Some((min, max)) = self.bounds(current) else {
            return vec![current.0];
        };

        (min.0..=max.0)
            .filter(|row| *row < table.rows().len())
            .collect()
    }

    pub fn to_delimited(
        &self,
        current: CellRef,
        table: &Table,
        column_delimiter: &str,
        row_delimiter: &str,
    ) -> String {
        let cells = self.cells(current, table);
        let Some(first_row) = cells.first().map(|c| c.0) else {
            return String::new();
        };

        let mut rows: Vec<String> = Vec::new();
        let mut line: Vec<String> = Vec::new();
        let mut row_index = first_row;

        for (row, column) in cells {
            if row != row_index {
                rows.push(line.join(column_delimiter));
                line = Vec::new();
                row_index = row;
            }
            line.push(table.cell_display(row, column));
        }
        rows.push(line.join(column_delimiter));

        rows.join(row_delimiter)
    }

    /// Write a delimited block back into the table, anchored at the top left of
    /// the selection.
    ///
    /// The block has to have exactly the shape of the selection. Anything else
    /// is refused: the offsets are positional, so a row gained or lost in the
    /// editor would otherwise shift every value after it and write into cells
    /// that were never selected.
    pub fn update_cells(
        &self,
        current: CellRef,
        table: &mut Table,
        text: &str,
        column_delimiter: &str,
        row_delimiter: &str,
    ) -> Result<Vec<CellRef>, String> {
        let (start, end) = self.bounds(current).unwrap_or((current, current));
        let expected_rows = end.0 - start.0 + 1;
        let expected_columns = end.1 - start.1 + 1;

        let lines: Vec<&str> = text.split(row_delimiter).collect();
        if lines.len() != expected_rows {
            return Err(format!(
                "expected {expected_rows} row(s) back, got {}; nothing was changed",
                lines.len()
            ));
        }

        // Validate the whole block before touching anything, so a rejected
        // edit leaves the table exactly as it was.
        let mut block: Vec<Vec<&str>> = Vec::with_capacity(expected_rows);
        for (offset, line) in lines.iter().enumerate() {
            let values: Vec<&str> = line.split(column_delimiter).collect();
            if values.len() != expected_columns {
                return Err(format!(
                    "expected {expected_columns} column(s) in row {}, got {}; nothing was changed",
                    offset + 1,
                    values.len()
                ));
            }
            block.push(values);
        }

        let mut updated = Vec::new();
        for (row_offset, values) in block.into_iter().enumerate() {
            for (column_offset, value) in values.into_iter().enumerate() {
                let cell = (start.0 + row_offset, start.1 + column_offset);

                if table.cell(cell.0, cell.1).is_none() {
                    continue;
                }

                table.update_cell(cell.0, cell.1, value)?;
                updated.push(cell);
            }
        }

        Ok(updated)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{ColumnInfo, JsonRow};
    use serde_json::json;

    fn table() -> Table {
        let structure: Vec<ColumnInfo> = ["a", "b", "c"]
            .iter()
            .map(|name| ColumnInfo {
                column_name: name.to_string(),
                data_type: "text".to_string(),
                is_primary: false,
                is_nullable: false,
                foreign_key: None,
            })
            .collect();

        let rows: Vec<JsonRow> = (0..3)
            .map(|r| {
                ["a", "b", "c"]
                    .iter()
                    .enumerate()
                    .map(|(c, name)| (name.to_string(), json!(format!("r{r}c{c}"))))
                    .collect()
            })
            .collect();

        Table::new("t".into(), &structure, &rows)
    }

    #[test]
    fn without_a_start_only_the_cursor_is_in_play() {
        let selection = VisualSelection::default();
        let table = table();

        assert_eq!(selection.cells((1, 1), &table), vec![(1, 1)]);
        assert_eq!(selection.rows((1, 1), &table), vec![1]);
        assert!(!selection.contains_cell((1, 1), (1, 1)));
    }

    #[test]
    fn a_rectangle_is_selected_in_either_direction() {
        let selection = VisualSelection {
            start: Some((2, 2)),
        };
        let table = table();

        assert_eq!(
            selection.cells((1, 1), &table),
            vec![(1, 1), (1, 2), (2, 1), (2, 2)]
        );
        assert!(selection.contains_cell((1, 1), (2, 1)));
        assert!(!selection.contains_cell((1, 1), (0, 1)));
        assert_eq!(selection.rows((1, 1), &table), vec![1, 2]);
    }

    #[test]
    fn selection_round_trips_through_delimited_text() {
        let selection = VisualSelection {
            start: Some((0, 0)),
        };
        let mut table = table();

        let text = selection.to_delimited((1, 1), &table, "\t", "\n");
        assert_eq!(text, "r0c0\tr0c1\nr1c0\tr1c1");

        let updated = selection
            .update_cells((1, 1), &mut table, "x\ty\nz\tw", "\t", "\n")
            .unwrap();

        assert_eq!(updated.len(), 4);
        assert_eq!(table.cell_display(0, 0), "x");
        assert_eq!(table.cell_display(1, 1), "w");
        assert_eq!(table.cell_display(0, 2), "r0c2", "outside the selection");
    }

    #[test]
    fn a_block_of_the_wrong_shape_is_refused() {
        let selection = VisualSelection {
            start: Some((0, 0)),
        };
        let mut table = table();

        // the editor came back with one row instead of two
        let error = selection
            .update_cells((1, 1), &mut table, "x\ty", "\t", "\n")
            .unwrap_err();
        assert!(error.contains("expected 2 row(s)"), "{error}");

        // ...and with an extra column
        let error = selection
            .update_cells((1, 1), &mut table, "x\ty\tz\nq\tw", "\t", "\n")
            .unwrap_err();
        assert!(error.contains("expected 2 column(s) in row 1"), "{error}");

        assert_eq!(
            table.cell_display(0, 0),
            "r0c0",
            "a refused block changes nothing"
        );
        assert_eq!(table.cell_display(0, 2), "r0c2", "least of all outside it");
        assert!(table.dirty_cells().is_empty());
    }

    #[test]
    fn a_single_cell_can_hold_newlines() {
        let selection = VisualSelection::default();
        let mut table = table();

        let updated = selection
            .update_cells(
                (0, 0),
                &mut table,
                "line one\nline two",
                "\u{1f}",
                "\u{1f}\n",
            )
            .unwrap();

        assert_eq!(updated, vec![(0, 0)]);
        assert_eq!(table.cell_display(0, 0), "line one\nline two");
    }
}
