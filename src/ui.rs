//! Port of `App.tsx` + `Router.tsx`: what is on screen, in what order.

use ratatui::layout::{Constraint, Layout, Rect};
use ratatui::style::{Color, Modifier, Style, Stylize};
use ratatui::text::{Line, Span};
use ratatui::widgets::{Block, Borders, Clear, Paragraph};
use ratatui::Frame;

use crate::app::App;
use crate::commands::messages::MessageType;
use crate::table::render::{self, RenderState};

pub fn draw(frame: &mut Frame, app: &mut App) {
    let [content, status] =
        Layout::vertical([Constraint::Min(0), Constraint::Length(1)]).areas(frame.area());

    // The equivalent of measuring the canvas container: scrolling can only be
    // resolved once we know how much room there is.
    app.viewport = content;
    app.ensure_cursor_visible();

    draw_content(frame, app, content);
    draw_status(frame, app, status);

    if app.picker.is_some() {
        draw_picker(frame, app);
    }
}

fn draw_content(frame: &mut Frame, app: &mut App, area: Rect) {
    if app.state.database_url.is_none() {
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

    let (row, column) = app.cursor();
    let scroll = app
        .state
        .current_hop()
        .map(|h| (h.scroll_y, h.scroll_x))
        .unwrap_or((0, 0));

    render::render(
        RenderState {
            table,
            layout: &app.layout,
            cursor: (row, column),
            scroll,
        },
        area,
        frame.buffer_mut(),
    );
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

    if let Some(line) = app.command_line.as_ref() {
        let value = line.value();
        let ghost = line
            .ghost_text(&app.commands, &app.config.command_aliases)
            .unwrap_or_default();

        frame.render_widget(
            Paragraph::new(Line::from(vec![
                Span::styled(":", Style::default().fg(Color::DarkGray)),
                Span::raw(value.clone()),
                Span::styled(ghost, Style::default().fg(Color::DarkGray)),
            ])),
            left,
        );

        let cursor_x = left.x + 1 + line.cursor() as u16;
        frame.set_cursor_position((cursor_x.min(left.right().saturating_sub(1)), left.y));
        return;
    }

    if let Some((kind, text)) = app.messages.current() {
        let color = match kind {
            MessageType::Info => Color::Blue,
            MessageType::Success => Color::Green,
            MessageType::Error => Color::Red,
        };
        frame.render_widget(Paragraph::new(text).style(Style::default().fg(color)), left);
        return;
    }

    if let Some(potential) = app.keybinds.potential.as_ref() {
        let hint = potential
            .iter()
            .map(|p| format!("{} → {}", p.bind, p.command))
            .collect::<Vec<_>>()
            .join("  ");
        frame.render_widget(
            Paragraph::new(hint).style(Style::default().fg(Color::DarkGray)),
            left,
        );
    }
}

fn status_suffix(app: &App) -> String {
    let Some(table) = app.table.as_ref() else {
        return String::new();
    };

    let loaded = table.rows().len();
    match app.count {
        Some(count) => format!("{} · {loaded}/{count} rows ", table.name),
        None => format!("{} · {loaded} rows ", table.name),
    }
}

fn draw_picker(frame: &mut Frame, app: &mut App) {
    let area = centered_rect(frame.area(), 60, 20);
    let Some(picker) = app.picker.as_mut() else {
        return;
    };

    frame.render_widget(Clear, area);
    let block = Block::default()
        .borders(Borders::ALL)
        .border_style(Style::default().fg(Color::DarkGray));
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

        let icon = item.icon.map(|i| format!("{i} ")).unwrap_or_default();
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

fn centered(frame: &mut Frame, area: Rect, text: &str) {
    let [line] = Layout::vertical([Constraint::Length(1)])
        .flex(ratatui::layout::Flex::Center)
        .areas(area);

    frame.render_widget(Paragraph::new(text).centered().dim(), line);
}

fn centered_rect(area: Rect, width_percent: u16, height: u16) -> Rect {
    let width = (area.width * width_percent / 100).max(20).min(area.width);
    let height = height.min(area.height);

    Rect {
        x: area.x + (area.width - width) / 2,
        y: area.y + (area.height.saturating_sub(height)) / 2,
        width,
        height,
    }
}
