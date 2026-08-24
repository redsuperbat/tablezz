//! Port of `App.tsx` + `Router.tsx`: what is on screen, in what order.

use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Clear, Paragraph, Wrap};
use ratatui::Frame;

use crate::app::App;
use crate::commands::messages::MessageType;
use crate::keybinds::PotentialKeybind;
use crate::table::render::{self, RenderState, HEADER_HEIGHT};

pub fn draw(frame: &mut Frame, app: &mut App) {
    let [content, status] =
        Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(frame.area());

    // The equivalent of measuring the canvas container: scrolling can only be
    // resolved once we know how much room there is.
    app.viewport = content;
    app.ensure_cursor_visible();

    draw_content(frame, app, content);
    draw_status(frame, app, status);

    if app.opened_cell.is_some() {
        draw_opened_cell(frame, app, content);
    }

    // Both help panels float bottom right, the same corner as the original.
    if app.help.is_some() {
        draw_help(frame, app, content, true);
    } else if app.keybinds.potential.is_some() {
        draw_help(frame, app, content, false);
    }

    if app.autocomplete.is_some() {
        draw_autocomplete(frame, app, content);
    }

    if app.picker.is_some() {
        draw_picker(frame, app);
    }
}

fn draw_content(frame: &mut Frame, app: &mut App, area: Rect) {
    if app.state.database_url.is_none() && app.table.is_none() {
        return centered(frame, area, "Press \":\" then type DatabaseUrlAdd <url>");
    }

    if let Some(error) = app.connection_error.clone() {
        return centered(frame, area, &error);
    }

    if app.connecting {
        return centered(frame, area, "Connecting to database...");
    }

    if let Some(error) = app.rows.error().or_else(|| app.structure.error()) {
        return centered(frame, area, error);
    }

    if app.rows.is_loading() || app.structure.is_loading() {
        return centered(frame, area, "Loading...");
    }

    let Some(table) = app.table.as_ref() else {
        return centered(frame, area, "No table selected — press <Leader> <Space>");
    };

    if table.is_empty() {
        return centered(frame, area, "No rows");
    }

    let scroll = scroll_offsets(app);

    render::render(
        RenderState {
            table,
            layout: &app.layout,
            cursor: app.cursor(),
            scroll,
            selection: app.selection,
        },
        area,
        frame.buffer_mut(),
    );
}

fn scroll_offsets(app: &App) -> (usize, usize) {
    app.state
        .current_hop()
        .map(|hop| (hop.scroll_y, hop.scroll_x))
        .unwrap_or((0, 0))
}

/// Port of the command line bar: the prompt on the left, the row counter on the
/// right, messages in place of the prompt when it is closed.
fn draw_status(frame: &mut Frame, app: &mut App, area: Rect) {
    let suffix = status_suffix(app);
    let suffix_width = suffix.chars().count() as u16;

    let [left, right] =
        Layout::horizontal([Constraint::Min(0), Constraint::Length(suffix_width)]).areas(area);

    frame.render_widget(
        Paragraph::new(suffix).style(Style::default().fg(Color::DarkGray)),
        right,
    );

    if app.command_line.is_some() {
        return draw_prompt(frame, app, left);
    }

    if let Some((kind, text)) = app.messages.current() {
        let color = match kind {
            MessageType::Info => Color::Blue,
            MessageType::Error => Color::Red,
        };
        frame.render_widget(Paragraph::new(text).style(Style::default().fg(color)), left);
        return;
    }

    if app.selection.is_selecting() {
        frame.render_widget(
            Paragraph::new("-- VISUAL --").style(Style::default().fg(Color::Cyan).bold()),
            left,
        );
    }
}

fn draw_prompt(frame: &mut Frame, app: &App, area: Rect) {
    let Some(line) = app.command_line.as_ref() else {
        return;
    };

    let value = line.value();
    let mut spans = vec![Span::styled(":", Style::default().fg(Color::DarkGray))];

    // While walking the history the matching part of the recalled entry is
    // highlighted, the way the original tinted it.
    match line.history_search().filter(|query| !query.is_empty()) {
        Some(query) => match value.to_lowercase().find(&query.to_lowercase()) {
            Some(start) => {
                let end = start + query.len();
                spans.push(Span::raw(value[..start].to_string()));
                spans.push(Span::styled(
                    value[start..end].to_string(),
                    Style::default().fg(Color::Blue).bold(),
                ));
                spans.push(Span::raw(value[end..].to_string()));
            }
            None => spans.push(Span::raw(value.clone())),
        },
        None => {
            spans.push(Span::raw(value.clone()));
            let ghost = line
                .ghost_text(&app.commands, &app.config.command_aliases)
                .unwrap_or_default();
            spans.push(Span::styled(ghost, Style::default().fg(Color::DarkGray)));
        }
    }

    frame.render_widget(Paragraph::new(Line::from(spans)), area);

    let cursor_x = area.x + 1 + line.cursor() as u16;
    frame.set_cursor_position((cursor_x.min(area.right().saturating_sub(1)), area.y));
}

fn status_suffix(app: &App) -> String {
    let Some(table) = app.table.as_ref() else {
        return String::new();
    };

    let loaded = table.rows().len();
    let pending = table.dirty_cells().len() + table.deleted_rows().len();
    let changes = match pending {
        0 => String::new(),
        pending => format!("[+{pending}] "),
    };

    match app.count {
        Some(count) => format!("{changes}{} · {loaded}/{count} rows ", table.name),
        None => format!("{changes}{} · {loaded} rows ", table.name),
    }
}

/// Port of `SelectionOpen`'s popover: the full value of one cell.
fn draw_opened_cell(frame: &mut Frame, app: &App, area: Rect) {
    let (Some((row, column)), Some(table)) = (app.opened_cell, app.table.as_ref()) else {
        return;
    };

    let (scroll_y, scroll_x) = scroll_offsets(app);
    let text = table.cell_display(row, column);

    let width = area.width.saturating_sub(4).clamp(20, 72);
    let lines = text.chars().count() as u16 / width.max(1) + 3;
    let height = lines.clamp(3, area.height.max(3));

    // Anchored under the cell, then nudged to stay on screen.
    let cell_x: u16 = (scroll_x..column)
        .map(|index| app.layout.slot_width(index) as u16)
        .sum();
    let cell_y = HEADER_HEIGHT + row.saturating_sub(scroll_y) as u16;

    let x = (area.x + cell_x).min(area.right().saturating_sub(width));
    let y = match area.y + cell_y + 1 + height <= area.bottom() {
        true => area.y + cell_y + 1,
        false => (area.y + cell_y).saturating_sub(height),
    };

    let popup = Rect {
        x,
        y,
        width,
        height,
    };

    frame.render_widget(Clear, popup);
    frame.render_widget(
        Paragraph::new(text)
            .wrap(Wrap { trim: false })
            .block(bordered()),
        popup,
    );
}

/// Port of `KeybindHelp.tsx`. The full list (`?`) is a searchable grid; the keys
/// that can follow a partially entered sequence get one line each, with the
/// description, since there are only a few of them.
fn draw_help(frame: &mut Frame, app: &App, area: Rect, full: bool) {
    let mut binds: Vec<PotentialKeybind> = match full {
        true => app.keybinds.all_keybinds(),
        false => app.keybinds.potential.clone().unwrap_or_default(),
    };

    if binds.is_empty() {
        return;
    }
    binds.sort_by(|a, b| a.command.cmp(&b.command));

    match full {
        true => draw_help_grid(frame, app, area, &binds),
        false => draw_help_list(frame, area, &binds),
    }
}

fn draw_help_list(frame: &mut Frame, area: Rect, binds: &[PotentialKeybind]) {
    let lines: Vec<Line> = binds
        .iter()
        .map(|bind| {
            let mut spans = vec![
                Span::styled(bind.bind.clone(), Style::default().fg(Color::Yellow)),
                Span::raw(format!(" {}", bind.command)),
            ];
            if let Some(description) = bind.description.as_deref() {
                spans.push(Span::styled(
                    format!(" — {description}"),
                    Style::default().fg(Color::DarkGray),
                ));
            }
            Line::from(spans)
        })
        .collect();

    let width = lines
        .iter()
        .map(|line| line.width() as u16 + 2)
        .max()
        .unwrap_or(20)
        .clamp(20, area.width);
    let height = (lines.len() as u16 + 2).min(area.height);

    let panel = anchored_bottom_right(area, width, height);
    frame.render_widget(Clear, panel);
    frame.render_widget(Paragraph::new(lines).block(bordered()), panel);
}

fn draw_help_grid(frame: &mut Frame, app: &App, area: Rect, binds: &[PotentialKeybind]) {
    let searching = app.help.as_ref().is_some_and(|help| help.searching);
    let query = app
        .help
        .as_ref()
        .map(|help| help.search.to_lowercase())
        .unwrap_or_default();

    // Up to three columns of ten, like the original — but only as many as
    // actually fit, since squeezing them would clip the command names.
    let wanted = binds.len().div_ceil(10).clamp(1, 3);
    let (chunks, column_widths) = (1..=wanted)
        .rev()
        .map(|count| split_columns(binds, count))
        .find(|(_, widths)| widths.iter().sum::<u16>() + 2 <= area.width)
        .unwrap_or_else(|| split_columns(binds, 1));

    let per_column = chunks.first().map(|chunk| chunk.len()).unwrap_or(0);
    let width = (column_widths.iter().sum::<u16>() + 2).clamp(20, area.width);
    let height = (per_column as u16 + 2 + u16::from(searching)).min(area.height);

    let panel = anchored_bottom_right(area, width, height);
    frame.render_widget(Clear, panel);

    let block = bordered();
    let inner = block.inner(panel);
    frame.render_widget(block, panel);

    let inner = match searching {
        false => inner,
        true => {
            let [search, rest] =
                Layout::vertical([Constraint::Length(1), Constraint::Min(0)]).areas(inner);
            frame.render_widget(
                Paragraph::new(Line::from(vec![
                    Span::styled("/", Style::default().fg(Color::DarkGray)),
                    Span::raw(query.clone()),
                ])),
                search,
            );
            frame.set_cursor_position((search.x + 1 + query.chars().count() as u16, search.y));
            rest
        }
    };

    let columns = Layout::horizontal(
        column_widths
            .iter()
            .map(|width| Constraint::Length(*width))
            .collect::<Vec<_>>(),
    )
    .split(inner);

    for (index, chunk) in chunks.iter().enumerate() {
        let Some(column) = columns.get(index) else {
            break;
        };

        for (offset, bind) in chunk.iter().enumerate() {
            let y = column.y + offset as u16;
            if y >= column.bottom() {
                break;
            }

            // Filtering dims what does not match rather than hiding it, so the
            // layout stays put while typing.
            let matched = !query.is_empty() && bind.command.to_lowercase().contains(&query);
            let style = match (query.is_empty(), matched) {
                (true, _) => Style::default(),
                (false, true) => Style::default().fg(Color::Blue).bold(),
                (false, false) => Style::default().fg(Color::DarkGray),
            };

            let row = Rect {
                x: column.x,
                y,
                width: column.width,
                height: 1,
            };

            let bind_width = bind.bind.chars().count() as u16 + 1;
            let [name, key] =
                Layout::horizontal([Constraint::Min(0), Constraint::Length(bind_width)]).areas(row);

            frame.render_widget(Paragraph::new(bind.command.clone()).style(style), name);
            frame.render_widget(
                Paragraph::new(bind.bind.clone())
                    .right_aligned()
                    .style(style.fg(Color::Yellow)),
                key,
            );
        }
    }
}

/// Split the binds into `count` columns, each as wide as its own widest entry.
fn split_columns(binds: &[PotentialKeybind], count: usize) -> (Vec<&[PotentialKeybind]>, Vec<u16>) {
    let per_column = binds.len().div_ceil(count);
    let chunks: Vec<&[PotentialKeybind]> = binds.chunks(per_column.max(1)).collect();

    let widths = chunks
        .iter()
        .map(|chunk| {
            chunk
                .iter()
                .map(|bind| (bind.command.chars().count() + bind.bind.chars().count() + 3) as u16)
                .max()
                .unwrap_or(20)
        })
        .collect();

    (chunks, widths)
}

fn anchored_bottom_right(area: Rect, width: u16, height: u16) -> Rect {
    Rect {
        x: area.right().saturating_sub(width).max(area.x),
        y: area.bottom().saturating_sub(height).max(area.y),
        width,
        height,
    }
}

/// Port of `AutocompleteOptions`: the menu that grows upward from the prompt.
fn draw_autocomplete(frame: &mut Frame, app: &App, area: Rect) {
    let matches = app.autocomplete_matches();
    if matches.is_empty() {
        return;
    }

    let selected = app.autocomplete_selected();
    let width = matches
        .iter()
        .map(|name| name.chars().count() as u16 + 2)
        .max()
        .unwrap_or(20)
        .min(area.width);
    let height = (matches.len() as u16 + 2).min(area.height).min(12);

    let panel = Rect {
        x: area.x,
        y: area.bottom().saturating_sub(height),
        width,
        height,
    };

    frame.render_widget(Clear, panel);
    let block = bordered();
    let inner = block.inner(panel);
    frame.render_widget(block, panel);

    let visible = inner.height as usize;
    let first = selected.saturating_sub(visible.saturating_sub(1));

    for (offset, name) in matches.iter().skip(first).take(visible).enumerate() {
        let style = match first + offset == selected {
            true => Style::default().add_modifier(Modifier::REVERSED),
            false => Style::default(),
        };
        let row = Rect {
            y: inner.y + offset as u16,
            height: 1,
            ..inner
        };
        frame.render_widget(Paragraph::new(name.clone()).style(style), row);
    }
}

fn draw_picker(frame: &mut Frame, app: &mut App) {
    let area = centered_rect(frame.area(), 60, 20);
    let Some(picker) = app.picker.as_mut() else {
        return;
    };

    frame.render_widget(Clear, area);
    let block = bordered();
    let inner = block.inner(area);
    frame.render_widget(block, area);

    let [search, list] = Layout::vertical([Constraint::Length(1), Constraint::Min(0)]).areas(inner);

    frame.render_widget(
        Paragraph::new(Line::from(vec![
            Span::styled("> ", Style::default().fg(Color::DarkGray)),
            Span::raw(picker.search_term.clone()),
        ])),
        search,
    );
    frame.set_cursor_position((
        search.x + 2 + picker.search_term.chars().count() as u16,
        search.y,
    ));

    let filtered = picker.filtered();
    let selected = picker.selected_index();
    let height = list.height as usize;
    // Keep the selection in view.
    let first = selected.saturating_sub(height.saturating_sub(1));

    for (offset, &index) in filtered.iter().skip(first).take(height).enumerate() {
        let item = &picker.items[index];
        let is_active = first + offset == selected;

        let mut style = Style::default();
        if is_active {
            style = style.add_modifier(Modifier::REVERSED);
        }

        let icon = item.icon.map(|icon| format!("{icon} ")).unwrap_or_default();
        let row = Rect {
            y: list.y + offset as u16,
            height: 1,
            ..list
        };

        frame.render_widget(
            Paragraph::new(format!("{icon}{}", item.label)).style(style),
            row,
        );
    }
}

fn bordered() -> Block<'static> {
    Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray))
}

fn centered(frame: &mut Frame, area: Rect, text: &str) {
    let [line] = Layout::vertical([Constraint::Length(1)])
        .flex(ratatui::layout::Flex::Center)
        .areas(area);

    frame.render_widget(Paragraph::new(text).centered().dim(), line);
}

fn centered_rect(area: Rect, width_percent: u16, height: u16) -> Rect {
    let width = (area.width * width_percent / 100).clamp(20, area.width);
    let height = height.min(area.height);

    Rect {
        x: area.x + (area.width - width) / 2,
        y: area.y + (area.height.saturating_sub(height)) / 2,
        width,
        height,
    }
}
