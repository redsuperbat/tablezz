//! instead of pixels.

use unicode_width::UnicodeWidthStr;

use super::Table;

const MIN_COLUMN_WIDTH: usize = 6;
const MAX_COLUMN_WIDTH: usize = 60;
const SAMPLE_ROWS: usize = 50;
/// One glyph per header icon (primary key, foreign key, datatype) + a space.
const HEADER_ICON_SPACE: usize = 2;
/// Content is padded with a space on each side, then a `│` separator.
pub const CELL_PADDING: usize = 1;
pub const SEPARATOR_WIDTH: usize = 1;

#[derive(Default)]
pub struct ColumnLayout {
    widths: Vec<usize>,
}

impl ColumnLayout {
    pub fn compute(table: &Table) -> Self {
        let rows = table.rows();

        let widths = table
            .columns()
            .iter()
            .map(|column| {
                let mut header_width = column.name.width();

                let mut icon_count = 0;
                if column.is_primary {
                    icon_count += 1;
                }
                if column.foreign_key.is_some() {
                    icon_count += 1;
                }
                if column.data_type().icon().is_some() {
                    icon_count += 1;
                }

                header_width += icon_count * HEADER_ICON_SPACE;

                if column.is_nullable {
                    header_width += 1;
                }

                let max_cell_width = rows
                    .iter()
                    .take(SAMPLE_ROWS)
                    .map(|row| match row.cell(column.index) {
                        Some(cell) => cell.to_display(column).width(),
                        None => 0,
                    })
                    .max()
                    .unwrap_or(0);

                header_width
                    .max(max_cell_width)
                    .clamp(MIN_COLUMN_WIDTH, MAX_COLUMN_WIDTH)
            })
            .collect();

        Self { widths }
    }

    pub fn width(&self, index: usize) -> usize {
        self.widths.get(index).copied().unwrap_or(MIN_COLUMN_WIDTH)
    }

    /// Total terminal columns a table column occupies including padding and its
    /// separator.
    pub fn slot_width(&self, index: usize) -> usize {
        self.width(index) + CELL_PADDING * 2 + SEPARATOR_WIDTH
    }

    /// How many columns fit *entirely* starting at `first`. The renderer draws
    /// past this and lets the edge clip; this is what decides when the cursor
    /// forces a scroll, so that the cell under it is never cut off. Always at
    /// least one, so a column wider than the viewport can still be reached.
    pub fn visible_count(&self, first: usize, available: usize) -> usize {
        let mut used = 0;
        let mut count = 0;

        for index in first..self.widths.len() {
            let slot = self.slot_width(index);
            if used + slot > available && count > 0 {
                break;
            }
            used += slot;
            count += 1;
        }

        count.max(1)
    }

    /// The smallest scroll offset that keeps `target` fully visible.
    pub fn scroll_to_show(&self, current_first: usize, target: usize, available: usize) -> usize {
        if target < current_first {
            return target;
        }

        let mut first = current_first;
        while target >= first + self.visible_count(first, available) {
            first += 1;
        }

        first
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn layout(widths: &[usize]) -> ColumnLayout {
        ColumnLayout {
            widths: widths.to_vec(),
        }
    }

    #[test]
    fn counts_columns_that_fit() {
        // slots are width + 3
        let layout = layout(&[10, 10, 10]);
        assert_eq!(layout.visible_count(0, 26), 2);
        assert_eq!(layout.visible_count(0, 39), 3);
        assert_eq!(layout.visible_count(1, 13), 1);
    }

    #[test]
    fn a_column_wider_than_the_viewport_still_renders() {
        let layout = layout(&[100]);
        assert_eq!(layout.visible_count(0, 20), 1);
    }

    #[test]
    fn scrolls_the_minimum_needed_in_both_directions() {
        let layout = layout(&[10, 10, 10, 10]);
        assert_eq!(layout.scroll_to_show(2, 0, 26), 0, "scrolls back to target");
        assert_eq!(layout.scroll_to_show(0, 1, 26), 0, "already visible");
        assert_eq!(layout.scroll_to_show(0, 2, 26), 1, "advances by one");
        assert_eq!(layout.scroll_to_show(0, 3, 26), 2);
    }
}
