//! Port of `src/table/canvas/CanvasRenderer.ts`. Same structure — backgrounds,
//! text, grid, sticky header — drawn into the terminal buffer.

use ratatui::buffer::Buffer;
use ratatui::layout::Rect;
use ratatui::style::{Color, Modifier, Style};

use super::datatype::icons;
use super::layout::{ColumnLayout, CELL_PADDING, SEPARATOR_WIDTH};
use super::selection::VisualSelection;
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
    pub selection: VisualSelection,
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
        selection,
    } = state;

    if table.columns().is_empty() || area.width == 0 || area.height == 0 {
        return;
    }

    let (scroll_y, scroll_x) = scroll;
    let row_count = visible_rows(area).min(table.rows().len().saturating_sub(scroll_y));

    // Every column from the scroll offset onwards is drawn; the last one is
    // clipped at the edge rather than dropped, so the width is never wasted.
    // Scrolling only moves when the cursor lands somewhere not fully visible.
    let columns = scroll_x..table.columns().len();

    // --- header ---
    let mut x = area.x;
    for column_index in columns.clone() {
        let Some(column) = table.column(column_index) else {
            break;
        };
        let width = layout.width(column_index);

        let mut cursor_x = x + CELL_PADDING as u16;
        let limit = (x + (width + CELL_PADDING) as u16).min(area.right());

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
            icon(icons::KEY, Color::Yellow);
        }
        if column.foreign_key.is_some() {
            icon(icons::LINK, Color::Blue);
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
        for column_index in columns.clone() {
            let Some(column) = table.column(column_index) else {
                break;
            };
            let Some(cell) = row.cell(column_index) else {
                break;
            };

            let width = layout.width(column_index);
            let slot = layout.slot_width(column_index) as u16;

            let style = cell_style(CellState {
                is_current: (row_index, column_index) == cursor,
                is_selected: selection.contains_cell(cursor, (row_index, column_index)),
                is_selection_start: selection.start == Some((row_index, column_index)),
                is_dirty: cell.is_dirty(),
                is_deleted: row.is_deleted(),
            });

            let cell_width = (width + CELL_PADDING * 2) as u16;
            let painted = Rect {
                x,
                y,
                width: cell_width.min(area.right().saturating_sub(x)),
                height: 1,
            };
            buf.set_style(painted, style);

            let text_x = x + CELL_PADDING as u16;
            let room = width.min(area.right().saturating_sub(text_x) as usize);
            buf.set_stringn(text_x, y, cell.to_display(column), room, style);

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

struct CellState {
    is_current: bool,
    is_selected: bool,
    is_selection_start: bool,
    is_dirty: bool,
    is_deleted: bool,
}

/// Port of `#cellBgColor`, same precedence: dirtiness beats selection, the
/// cursor is always marked on top.
fn cell_style(state: CellState) -> Style {
    let mut style = Style::default();

    if state.is_deleted {
        style = style.fg(Color::Red).add_modifier(Modifier::CROSSED_OUT);
    }

    if state.is_dirty {
        style = style.fg(Color::Black).bg(Color::Yellow);
    } else if state.is_selection_start {
        style = style.fg(Color::Black).bg(Color::Cyan);
    } else if state.is_selected {
        style = style.fg(Color::White).bg(Color::Blue);
    }

    if state.is_current {
        style = style.add_modifier(Modifier::REVERSED);
    }

    style
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

        Table::new("users".into(), &structure, rows)
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
                selection: VisualSelection::default(),
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
        let expected_id = format!("{} {} id", icons::KEY, icons::NUMBER);
        let expected_org = format!("{} {} org?", icons::LINK, icons::NUMBER);
        assert!(lines[0].contains(&expected_id), "header was {:?}", lines[0]);
        assert!(
            lines[0].contains(&expected_org),
            "header was {:?}",
            lines[0]
        );
        assert!(lines[1].starts_with('─'));
        assert!(lines[2].contains('1'));
        assert!(lines[5].contains('4'));
    }

    #[test]
    fn a_column_that_only_half_fits_is_still_drawn() {
        let structure: Vec<ColumnInfo> = ["alpha", "bravo", "charlie"]
            .iter()
            .map(|name| column(name, "text", false))
            .collect();
        let rows: Vec<JsonRow> = vec![["alpha", "bravo", "charlie"]
            .iter()
            .map(|name| (name.to_string(), json!(format!("{name}-value"))))
            .collect()];

        let table = Table::new("t".into(), &structure, rows);
        let layout = ColumnLayout::compute(&table);

        // two whole columns and part of a third
        let width = (layout.slot_width(0) + layout.slot_width(1) + 4) as u16;
        assert!(width < (0..3).map(|i| layout.slot_width(i)).sum::<usize>() as u16);

        let area = Rect::new(0, 0, width, 4);
        let mut buf = Buffer::empty(area);
        render(
            RenderState {
                table: &table,
                layout: &layout,
                cursor: (0, 0),
                scroll: (0, 0),
                selection: VisualSelection::default(),
            },
            area,
            &mut buf,
        );

        let row: String = (0..area.width)
            .map(|x| buf[(x, HEADER_HEIGHT)].symbol().to_string())
            .collect();

        assert!(
            row.contains("cha"),
            "the clipped column should still show what fits, row was {row:?}"
        );
        assert_eq!(
            row.trim_end().chars().count(),
            area.width as usize,
            "no dead space at the right edge, row was {row:?}"
        );
    }

    #[test]
    fn scroll_offset_picks_the_first_visible_row() {
        let lines = render_to_lines(Rect::new(0, 0, 40, 4), (3, 0), (3, 0));
        assert!(lines[2].contains('4'), "first data row was {:?}", lines[2]);
        assert!(lines[3].contains('5'));
    }

    #[test]
    fn a_visual_selection_is_painted() {
        let table = table();
        let layout = ColumnLayout::compute(&table);
        let area = Rect::new(0, 0, 40, 6);
        let mut buf = Buffer::empty(area);

        render(
            RenderState {
                table: &table,
                layout: &layout,
                cursor: (2, 0),
                scroll: (0, 0),
                selection: VisualSelection {
                    start: Some((0, 0)),
                },
            },
            area,
            &mut buf,
        );

        let x = 1;
        // the anchor cell reads differently from the rest of the range
        assert_eq!(buf[(x, HEADER_HEIGHT)].style().bg, Some(Color::Cyan));
        assert_eq!(buf[(x, HEADER_HEIGHT + 1)].style().bg, Some(Color::Blue));
        // the cursor row is selected and current
        assert!(buf[(x, HEADER_HEIGHT + 2)]
            .style()
            .add_modifier
            .contains(Modifier::REVERSED));
        // a column outside the selection is untouched
        let outside = layout.slot_width(0) as u16 + 1;
        assert_eq!(
            buf[(outside, HEADER_HEIGHT + 1)].style().bg,
            Some(Color::Reset)
        );
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
                selection: VisualSelection::default(),
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
