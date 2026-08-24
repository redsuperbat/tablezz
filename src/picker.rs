//! Port of `src/picker/usePicker.tsx`. The promise the original resolved
//! becomes a `PickerAction`: what to do with the value once it is picked.

use nucleo_matcher::pattern::{CaseMatching, Normalization, Pattern};
use nucleo_matcher::{Config, Matcher, Utf32Str};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum PickerAction {
    PickTable,
    PickSchema,
    PickDatabase,
    PickUrl,
    /// The item values are complete queries to hop to.
    HopToQuery,
}

#[derive(Debug, Clone)]
pub struct PickerItem {
    pub value: String,
    pub label: String,
    pub icon: Option<char>,
}

pub struct Picker {
    pub action: PickerAction,
    pub items: Vec<PickerItem>,
    pub search_term: String,
    selected: usize,
    matcher: Matcher,
}

impl Picker {
    pub fn new(action: PickerAction, items: Vec<PickerItem>) -> Self {
        Self {
            action,
            items,
            search_term: String::new(),
            selected: 0,
            matcher: Matcher::new(Config::DEFAULT),
        }
    }

    /// Indices of `items` that match the search term, best match first.
    pub fn filtered(&mut self) -> Vec<usize> {
        if self.search_term.is_empty() {
            return (0..self.items.len()).collect();
        }

        let pattern = Pattern::parse(
            &self.search_term,
            CaseMatching::Ignore,
            Normalization::Smart,
        );
        let mut buf = Vec::new();
        let mut scored: Vec<(u32, usize)> = Vec::new();

        for (index, item) in self.items.iter().enumerate() {
            let haystack = Utf32Str::new(&item.label, &mut buf);
            if let Some(score) = pattern.score(haystack, &mut self.matcher) {
                scored.push((score, index));
            }
        }

        scored.sort_by(|a, b| b.0.cmp(&a.0).then(a.1.cmp(&b.1)));
        scored.into_iter().map(|(_, index)| index).collect()
    }

    pub fn selected_index(&mut self) -> usize {
        let len = self.filtered().len();
        if len == 0 {
            return 0;
        }
        self.selected.min(len - 1)
    }

    pub fn selected_value(&mut self) -> Option<String> {
        let selected = self.selected_index();
        let index = *self.filtered().get(selected)?;
        Some(self.items[index].value.clone())
    }

    /// Wrapping selection, like `createCounterWithWrap`.
    pub fn select_next(&mut self) {
        let len = self.filtered().len();
        if len == 0 {
            return;
        }
        self.selected = (self.selected_index() + 1) % len;
    }

    pub fn select_prev(&mut self) {
        let len = self.filtered().len();
        if len == 0 {
            return;
        }
        self.selected = (self.selected_index() + len - 1) % len;
    }

    pub fn set_search_term(&mut self, term: String) {
        self.search_term = term;
        self.selected = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn picker(labels: &[&str]) -> Picker {
        Picker::new(
            PickerAction::PickTable,
            labels
                .iter()
                .map(|l| PickerItem {
                    value: l.to_string(),
                    label: l.to_string(),
                    icon: None,
                })
                .collect(),
        )
    }

    #[test]
    fn fuzzy_filters_and_ranks() {
        let mut picker = picker(&["users", "user_sessions", "orders"]);
        picker.set_search_term("usr".to_string());
        let filtered = picker.filtered();
        assert!(!filtered.is_empty());
        assert!(filtered.iter().all(|&i| picker.items[i].label != "orders"));
    }

    #[test]
    fn selection_wraps_and_stays_in_range() {
        let mut picker = picker(&["a", "b"]);
        picker.select_prev();
        assert_eq!(picker.selected_index(), 1);
        picker.select_next();
        assert_eq!(picker.selected_index(), 0);
    }

    #[test]
    fn narrowing_the_search_resets_the_selection() {
        let mut picker = picker(&["users", "orders"]);
        picker.select_next();
        picker.set_search_term("ord".to_string());
        assert_eq!(picker.selected_value().as_deref(), Some("orders"));
    }
}
