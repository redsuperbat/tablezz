//! Port of `src/table/canvas/CanvasRenderer.ts`. Same structure — backgrounds,
//! text, grid, sticky header — drawn into the terminal buffer.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};

use super::layout::{ColumnLayout, CELL_PADDING, SEPARATOR_WIDTH};
use super::Table;

pub const HEADER_HEIGHT: u16 = 2;

fn header_style() -> Style {
    Style::default().add_modifier(Modifier::BOLD)
}

fn separator_style() -> Style {
    Style::default().fg(Color::DarkGray)
}

pub struct RenderState<'a> {
    pub table: &'a Table,
    pub layout: &'a ColumnLayout,
    /// (row, column) of the cursor.
    pub cursor: (usize, usize),
    /// (first visible row, first visible column).
    pub scroll: (usize, usize),
}

/// Rows of table data that fit in `area`.
pub fn visible_rows(area: Rect) -> usize {
    area.height.saturating_sub(HEADER_HEIGHT) as usize
}

pub fn render(state: RenderState, area: Rect, buf: &mut Buffer) {
    let RenderState {
        table,
        layout,
        cursor,
        scroll,
    } = state;

    if table.columns().is_empty() || area.width == 0 || area.height == 0 {
        return;
    }

    let (scroll_y, scroll_x) = scroll;
    let column_count = layout.visible_count(scroll_x, area.width as usize);
    let row_count = visible_rows(area).min(table.rows().len().saturating_sub(scroll_y));

    // --- header ---
    let mut x = area.x;
    for column_index in scroll_x..(scroll_x + column_count) {
        let Some(column) = table.column(column_index) else {
            break;
        };
        let width = layout.width(column_index);

        let mut cursor_x = x + CELL_PADDING as u16;
        let limit = x + (width + CELL_PADDING) as u16;

        let mut icon = |glyph: char, color: Color| {
            if cursor_x + 1 < limit {
                buf.set_string(
                    cursor_x,
                    area.y,
                    glyph.to_string(),
                    Style::default().fg(color),
                );
                cursor_x += 2;
            }
        };

        if column.is_primary {
            icon('*', Color::Yellow);
        }
        if column.foreign_key.is_some() {
            icon('>', Color::Blue);
        }
        if let Some(glyph) = column.data_type().icon() {
            icon(glyph, Color::DarkGray);
        }

        let remaining = limit.saturating_sub(cursor_x) as usize;
        let (next_x, _) =
            buf.set_stringn(cursor_x, area.y, &column.name, remaining, header_style());
        cursor_x = next_x;

        if column.is_nullable && cursor_x < limit {
            buf.set_string(cursor_x, area.y, "?", Style::default().fg(Color::Blue));
        }

        // header underline + column separator
        let slot = layout.slot_width(column_index) as u16;
        let rule_width = (slot).min(area.right().saturating_sub(x));
        buf.set_string(
            x,
            area.y + 1,
            "─".repeat(rule_width as usize),
            separator_style(),
        );

        let separator_x = x + (width + CELL_PADDING * 2) as u16;
        if separator_x < area.right() {
            buf.set_string(separator_x, area.y, "│", separator_style());
            buf.set_string(separator_x, area.y + 1, "┼", separator_style());
        }

        x += slot;
        if x >= area.right() {
            break;
        }
    }

    // --- rows ---
    for offset in 0..row_count {
        let row_index = scroll_y + offset;
        let y = area.y + HEADER_HEIGHT + offset as u16;
        let Some(row) = table.row(row_index) else {
            break;
        };

        let mut x = area.x;
        for column_index in scroll_x..(scroll_x + column_count) {
            let Some(column) = table.column(column_index) else {
                break;
            };
            let Some(cell) = row.cell(column_index) else {
                break;
            };

            let width = layout.width(column_index);
            let slot = layout.slot_width(column_index) as u16;

            let mut style = Style::default();
            if row.is_deleted() {
                style = style.fg(Color::Red).add_modifier(Modifier::CROSSED_OUT);
            }
            if cell.is_dirty() {
                style = style.fg(Color::Black).bg(Color::Yellow);
            }
            if (row_index, column_index) == cursor {
                style = style.add_modifier(Modifier::REVERSED);
            }

            let cell_width = (width + CELL_PADDING * 2) as u16;
            let painted = Rect {
                x,
                y,
                width: cell_width.min(area.right().saturating_sub(x)),
                height: 1,
            };
            buf.set_style(painted, style);

            buf.set_stringn(
                x + CELL_PADDING as u16,
                y,
                cell.to_display(column),
                width,
                style,
            );

            let separator_x = x + cell_width;
            if separator_x < area.right() {
                buf.set_string(separator_x, y, "│", separator_style());
            }

            x += slot;
            if x >= area.right() {
                break;
            }
        }
    }

    let _ = SEPARATOR_WIDTH;
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::{ColumnInfo, ForeignKey, JsonRow};
    use crate::table::layout::ColumnLayout;
    use serde_json::json;

    fn column(name: &str, data_type: &str, primary: bool) -> ColumnInfo {
        ColumnInfo {
            column_name: name.to_string(),
            data_type: data_type.to_string(),
            is_primary: primary,
            is_nullable: false,
            column_default: None,
            foreign_key: None,
        }
    }

    fn table() -> Table {
        let structure = vec![
            column("id", "integer", true),
            ColumnInfo {
                foreign_key: Some(ForeignKey {
                    table: "orgs".into(),
                    column: "id".into(),
                }),
                is_nullable: true,
                ..column("org", "integer", false)
            },
        ];

        let rows: Vec<JsonRow> = (1..=5)
            .map(|i| {
                [
                    ("id".to_string(), json!(i)),
                    ("org".to_string(), json!(i * 10)),
                ]
                .into_iter()
                .collect()
            })
            .collect();

        Table::new("users".into(), &structure, &rows)
    }

    fn render_to_lines(area: Rect, cursor: (usize, usize), scroll: (usize, usize)) -> Vec<String> {
        let table = table();
        let layout = ColumnLayout::compute(&table);
        let mut buf = Buffer::empty(area);

        render(
            RenderState {
                table: &table,
                layout: &layout,
                cursor,
                scroll,
            },
            area,
            &mut buf,
        );

        (0..area.height)
            .map(|y| {
                (0..area.width)
                    .map(|x| buf[(x, y)].symbol().to_string())
                    .collect::<String>()
                    .trim_end()
                    .to_string()
            })
            .collect()
    }

    #[test]
    fn draws_header_icons_and_rows() {
        let lines = render_to_lines(Rect::new(0, 0, 40, 6), (0, 0), (0, 0));

        // primary key marker, foreign key marker, datatype glyph, nullable "?"
        assert!(lines[0].contains("* # id"), "header was {:?}", lines[0]);
        assert!(lines[0].contains("> # org?"), "header was {:?}", lines[0]);
        assert!(lines[1].starts_with('─'));
        assert!(lines[2].contains('1'));
        assert!(lines[5].contains('4'));
    }

    #[test]
    fn scroll_offset_picks_the_first_visible_row() {
        let lines = render_to_lines(Rect::new(0, 0, 40, 4), (3, 0), (3, 0));
        assert!(lines[2].contains('4'), "first data row was {:?}", lines[2]);
        assert!(lines[3].contains('5'));
    }

    #[test]
    fn the_cursor_cell_is_highlighted() {
        let table = table();
        let layout = ColumnLayout::compute(&table);
        let area = Rect::new(0, 0, 40, 5);
        let mut buf = Buffer::empty(area);

        render(
            RenderState {
                table: &table,
                layout: &layout,
                cursor: (1, 1),
                scroll: (0, 0),
            },
            area,
            &mut buf,
        );

        let cursor_x = layout.slot_width(0) as u16 + 1;
        let y = HEADER_HEIGHT + 1;
        assert!(
            buf[(cursor_x, y)]
                .style()
                .add_modifier
                .contains(Modifier::REVERSED),
            "cursor cell was not reversed"
        );
        assert!(!buf[(cursor_x, y - 1)]
            .style()
            .add_modifier
            .contains(Modifier::REVERSED));
    }
}
