//! Port of `src/table/UndoTree.ts`. The original stored closures; a change is
//! an enum here, since a closure cannot borrow the table it has to mutate.

use super::selection::CellRef;
use super::Table;

#[derive(Debug, Clone)]
pub enum Change {
    CellEdits(Vec<CellRef>),
    RowDeletions(Vec<usize>),
}

#[derive(Debug, Default)]
pub struct UndoTree {
    changes: Vec<Change>,
}

impl UndoTree {
    pub fn add(&mut self, change: Change) {
        self.changes.push(change);
    }

    pub fn clear(&mut self) {
        self.changes.clear();
    }

    pub fn undo(&mut self, table: &mut Table) {
        match self.changes.pop() {
            Some(Change::CellEdits(cells)) => {
                for (row, column) in cells {
                    if let Some(cell) = table.cell_mut(row, column) {
                        cell.undo();
                    }
                }
            }
            Some(Change::RowDeletions(rows)) => {
                for row in rows {
                    if let Some(row) = table.row_mut(row) {
                        row.restore();
                    }
                }
            }
            None => {}
        }
    }
}
