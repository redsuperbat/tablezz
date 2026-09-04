//! cell -> row -> table back references become index lookups; everything a cell
//! needs from its column is passed in.

pub mod datatype;
pub mod grid;
pub mod layout;
pub mod render;
pub mod selection;
pub mod sql;
pub mod undo;

use serde_json::Value as JsonValue;

use crate::db::{ColumnInfo, ForeignKey, JsonRow};
use datatype::{create_data_type, DataType};

pub struct Column {
    pub index: usize,
    pub name: String,
    pub is_primary: bool,
    pub is_nullable: bool,
    pub foreign_key: Option<ForeignKey>,
    data_type: Box<dyn DataType>,
}

impl Column {
    pub fn data_type(&self) -> &dyn DataType {
        self.data_type.as_ref()
    }
}

/// A cell's value, keeping database NULL apart from every JSON value — a json
/// column can hold a JSON null without it meaning NULL. In the editor the two
/// spell differently: `NULL` is the database null, `null` a json one.
#[derive(Debug, Clone, PartialEq)]
pub enum CellValue {
    Null,
    Value(JsonValue),
}

impl From<JsonValue> for CellValue {
    fn from(data: JsonValue) -> Self {
        match data {
            // The decoder hands both SQL NULL and a stored json null back as
            // JsonValue::Null; a bare Null from the database means SQL NULL.
            JsonValue::Null => CellValue::Null,
            data => CellValue::Value(data),
        }
    }
}

impl CellValue {
    fn to_display(&self, column: &Column) -> String {
        match self {
            CellValue::Null => "NULL".to_string(),
            CellValue::Value(data) => column.data_type().to_display(data),
        }
    }

    fn to_sql_value(&self, column: &Column) -> Result<String, String> {
        match self {
            CellValue::Null => Ok("NULL".to_string()),
            CellValue::Value(data) => column.data_type().to_sql_value(data),
        }
    }
}

pub struct Cell {
    /// Every version of the value; the first is what the database returned.
    data: Vec<CellValue>,
    dirty: bool,
}

impl Cell {
    fn new(data: JsonValue) -> Self {
        Self {
            data: vec![data.into()],
            dirty: false,
        }
    }

    /// The current (potentially modified) value of the cell.
    pub fn data(&self) -> &CellValue {
        self.data.last().expect("cell always has a value")
    }

    /// The original unmodified value of the cell.
    pub fn original_data(&self) -> &CellValue {
        self.data.first().expect("cell always has a value")
    }

    /// Database NULL — not to be confused with a json column holding null.
    pub fn is_null(&self) -> bool {
        matches!(self.data(), CellValue::Null)
    }

    pub fn is_dirty(&self) -> bool {
        self.dirty
    }

    pub fn to_display(&self, column: &Column) -> String {
        self.data().to_display(column)
    }

    pub fn to_sql_value(&self, column: &Column) -> Result<String, String> {
        self.data().to_sql_value(column)
    }

    pub fn original_to_sql_value(&self, column: &Column) -> Result<String, String> {
        self.original_data().to_sql_value(column)
    }

    pub fn update_data(&mut self, column: &Column, value: &str) -> Result<(), String> {
        if self.to_display(column) == value {
            return Ok(());
        }

        let next = if value == "NULL" && column.is_nullable {
            CellValue::Null
        } else {
            CellValue::Value(column.data_type().from_string(value)?)
        };

        self.data.push(next);
        self.dirty = true;
        Ok(())
    }

    pub fn undo(&mut self) {
        if self.data.len() == 1 {
            return;
        }

        self.data.pop();
        self.dirty = self.data.len() != 1;
    }
}

pub struct Row {
    pub index: usize,
    cells: Vec<Cell>,
    deleted: bool,
}

impl Row {
    pub fn cell(&self, column_index: usize) -> Option<&Cell> {
        self.cells.get(column_index)
    }

    pub fn is_deleted(&self) -> bool {
        self.deleted
    }

    pub fn mark_for_deletion(&mut self) {
        self.deleted = true;
    }

    pub fn restore(&mut self) {
        self.deleted = false;
    }
}

pub struct Table {
    pub name: String,
    rows: Vec<Row>,
    columns: Vec<Column>,
}

impl Table {
    /// Takes the result rows by value: the values move into the cells, so a
    /// large result is not held twice.
    pub fn new(name: String, structure: &[ColumnInfo], rows: Vec<JsonRow>) -> Self {
        let columns: Vec<Column> = structure
            .iter()
            .enumerate()
            .map(|(index, info)| Column {
                index,
                name: info.column_name.clone(),
                is_primary: info.is_primary,
                is_nullable: info.is_nullable,
                foreign_key: info.foreign_key.clone(),
                data_type: create_data_type(&info.data_type),
            })
            .collect();

        let rows: Vec<Row> = rows
            .into_iter()
            .enumerate()
            .map(|(index, mut row)| Row {
                index,
                deleted: false,
                cells: columns
                    .iter()
                    .map(|column| {
                        Cell::new(row.swap_remove(&column.name).unwrap_or(JsonValue::Null))
                    })
                    .collect(),
            })
            .collect();

        Self {
            name,
            rows,
            columns,
        }
    }

    pub fn columns(&self) -> &[Column] {
        &self.columns
    }

    pub fn column(&self, index: usize) -> Option<&Column> {
        self.columns.get(index)
    }

    pub fn rows(&self) -> &[Row] {
        &self.rows
    }

    pub fn row(&self, index: usize) -> Option<&Row> {
        self.rows.get(index)
    }

    pub fn cell(&self, row: usize, column: usize) -> Option<&Cell> {
        self.rows.get(row)?.cell(column)
    }

    pub fn cell_mut(&mut self, row: usize, column: usize) -> Option<&mut Cell> {
        self.rows.get_mut(row)?.cells.get_mut(column)
    }

    pub fn row_mut(&mut self, index: usize) -> Option<&mut Row> {
        self.rows.get_mut(index)
    }

    /// The rendered text of a cell, empty when either index is out of bounds.
    pub fn cell_display(&self, row: usize, column: usize) -> String {
        match (self.cell(row, column), self.column(column)) {
            (Some(cell), Some(column)) => cell.to_display(column),
            _ => String::new(),
        }
    }

    pub fn is_empty(&self) -> bool {
        self.rows.is_empty() || self.columns.is_empty()
    }

    /// `columns` and `rows` are separate fields, so the column can be read while
    /// the cell is borrowed mutably.
    pub fn update_cell(&mut self, row: usize, column: usize, value: &str) -> Result<(), String> {
        let Some(column_ref) = self.columns.get(column) else {
            return Ok(());
        };
        let Some(cell) = self
            .rows
            .get_mut(row)
            .and_then(|row| row.cells.get_mut(column))
        else {
            return Ok(());
        };

        cell.update_data(column_ref, value)
    }

    /// Edited cells in rows that are not being deleted anyway.
    pub fn dirty_cells(&self) -> Vec<selection::CellRef> {
        self.rows
            .iter()
            .filter(|row| !row.is_deleted())
            .flat_map(|row| {
                row.cells
                    .iter()
                    .enumerate()
                    .filter(|(_, cell)| cell.is_dirty())
                    .map(move |(column, _)| (row.index, column))
            })
            .collect()
    }

    pub fn deleted_rows(&self) -> Vec<usize> {
        self.rows
            .iter()
            .filter(|row| row.is_deleted())
            .map(|row| row.index)
            .collect()
    }

    /// `("column", "value")` pairs identifying a row, from its original values.
    pub fn primary_key(&self, row: usize) -> Result<Vec<(String, String)>, String> {
        let Some(row) = self.row(row) else {
            return Ok(Vec::new());
        };

        self.columns
            .iter()
            .filter(|column| column.is_primary)
            .map(|column| {
                let cell = row.cell(column.index).ok_or("missing primary key cell")?;
                Ok((column.name.clone(), cell.original_to_sql_value(column)?))
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn column(name: &str, data_type: &str) -> ColumnInfo {
        ColumnInfo {
            column_name: name.to_string(),
            data_type: data_type.to_string(),
            is_primary: name == "id",
            is_nullable: false,
            foreign_key: None,
        }
    }

    fn row(pairs: &[(&str, JsonValue)]) -> JsonRow {
        pairs
            .iter()
            .map(|(k, v)| (k.to_string(), v.clone()))
            .collect()
    }

    #[test]
    fn cells_follow_column_order_not_result_key_order() {
        let structure = vec![column("id", "integer"), column("name", "text")];
        // the result row has the keys the other way round
        let rows = vec![row(&[("name", json!("ada")), ("id", json!(1))])];
        let table = Table::new("users".into(), &structure, rows);

        assert_eq!(table.cell_display(0, 0), "1");
        assert_eq!(table.cell_display(0, 1), "ada");
    }

    #[test]
    fn a_missing_column_in_the_result_becomes_null() {
        let structure = vec![column("id", "integer"), column("missing", "text")];
        let rows = vec![row(&[("id", json!(1))])];
        let table = Table::new("users".into(), &structure, rows);

        assert!(table.cell(0, 1).unwrap().is_null());
    }

    fn nullable(name: &str, data_type: &str) -> ColumnInfo {
        ColumnInfo {
            is_nullable: true,
            ..column(name, data_type)
        }
    }

    #[test]
    fn upper_case_null_is_the_database_null() {
        let structure = vec![nullable("name", "text")];
        let rows = vec![row(&[("name", json!("ada"))])];
        let mut table = Table::new("users".into(), &structure, rows);

        table.update_cell(0, 0, "NULL").unwrap();
        let (cell, column) = (table.cell(0, 0).unwrap(), table.column(0).unwrap());
        assert!(cell.is_null());
        assert_eq!(cell.to_display(column), "NULL");
        assert_eq!(cell.to_sql_value(column).unwrap(), "NULL");

        // the lower case null is just text
        table.update_cell(0, 0, "null").unwrap();
        let (cell, column) = (table.cell(0, 0).unwrap(), table.column(0).unwrap());
        assert!(!cell.is_null());
        assert_eq!(cell.to_sql_value(column).unwrap(), "'null'");
    }

    #[test]
    fn lower_case_null_in_a_json_column_is_the_json_null() {
        let structure = vec![nullable("meta", "jsonb")];
        let rows = vec![row(&[("meta", json!({"a": 1}))])];
        let mut table = Table::new("things".into(), &structure, rows);

        table.update_cell(0, 0, "null").unwrap();
        let (cell, column) = (table.cell(0, 0).unwrap(), table.column(0).unwrap());
        assert!(!cell.is_null(), "a json null is not the database null");
        assert_eq!(cell.to_display(column), "null");
        assert_eq!(cell.to_sql_value(column).unwrap(), "'null'");

        table.update_cell(0, 0, "NULL").unwrap();
        let (cell, column) = (table.cell(0, 0).unwrap(), table.column(0).unwrap());
        assert!(cell.is_null());
        assert_eq!(cell.to_sql_value(column).unwrap(), "NULL");
    }

    #[test]
    fn upper_case_null_in_a_non_nullable_column_is_a_value() {
        let structure = vec![column("name", "text")];
        let rows = vec![row(&[("name", json!("ada"))])];
        let mut table = Table::new("users".into(), &structure, rows);

        table.update_cell(0, 0, "NULL").unwrap();
        let (cell, column) = (table.cell(0, 0).unwrap(), table.column(0).unwrap());
        assert!(!cell.is_null());
        assert_eq!(cell.to_sql_value(column).unwrap(), "'NULL'");
    }

    #[test]
    fn editing_tracks_dirtiness_and_undoes() {
        let structure = vec![column("name", "text")];
        let rows = vec![row(&[("name", json!("ada"))])];
        let mut table = Table::new("users".into(), &structure, rows);

        let column = &table.columns[0];
        let cell = table.rows[0].cells.get_mut(0).unwrap();

        cell.update_data(column, "ada").unwrap();
        assert!(!cell.is_dirty(), "writing the same value is not a change");

        cell.update_data(column, "grace").unwrap();
        assert!(cell.is_dirty());
        assert_eq!(cell.to_display(column), "grace");
        assert_eq!(cell.original_data(), &CellValue::Value(json!("ada")));

        cell.undo();
        assert!(!cell.is_dirty());
        assert_eq!(cell.to_display(column), "ada");
    }
}
