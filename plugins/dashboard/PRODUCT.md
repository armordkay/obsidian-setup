# Dashboard for Obsidian

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

An Obsidian user who wants a vault home screen and a daily-note activity tracker.

## Product Purpose

Search and open vault files, see today's date and local HH:mm time next to the supplied cat portrait, and review daily activity in a GitHub-style heatmap. The duplicate header calendar was removed at the user's request in 1.2.0.

## Operating Context

Dedicated Obsidian tab and a `dashboard` Markdown block. UI is English; theme follows Obsidian. Approved visual reference: `.superpowers/brainstorm/58794-1793025253/content/dashboard-layout-v11.html` at the parent plugin repository, with the subsequent user-requested header/avatar layout recorded in `docs/updates/2026-10-26-ryo-header.md`.

## Capabilities and Constraints

- Level 1: daily note exists. Setup inside the tracker configures the property, Text/Number type and numeric minimum for levels 2–3. Defaults remain `deep_work >= 60` minutes and nonblank `wins`. Highest matching level wins. Habit checkboxes do not affect the level.
- User chose an independent plugin in `dashboard` and authorized implementation after approving the mockup.
- No daily notes are created or modified. Search opens existing files.
- Custom avatars are copied on Save to an images folder inside the installed plugin; only their relative paths are persisted. Source and prior images are retained.
- Implementation choices: dependency-free JavaScript, Obsidian API, CSS scoped to this plugin, 365 local calendar days, 53 heatmap columns, settings stored with Obsidian `loadData` / `saveData`.
- Daily folder/format can inherit Daily Notes or Periodic Notes, or be configured explicitly. Date-property and duplicate behavior is specified in the design.

## Brand Commitments

Gray surfaces, green accents, white text in dark mode, blue for secondary focus/selection. Year is green. Original three-level tracker palettes retained in both themes. No motivational copy or prominent daily shortcut.
Avatar in a square frame with slightly rounded corners, left of the date. The user-supplied cat image is the default. The avatar stays anchored to the left of the hero. The enlarged weekday, date and local clock align left, with a vertical divider and generous spacing from the avatar. Set up can select a custom image, copied to an images directory inside the installed dashboard plugin, and remembers the selection. The green Set up button is compact and its label never wraps.

## Evidence on Hand

Mockup approval and daily properties example supplied in the conversation. Existing sibling plugins use direct CommonJS entry points and Node's built-in tests.

## Accessibility & Inclusion

Keyboard search and date navigation, readable focus states, textual activity levels and daily details. No remote fonts, imagery, or network requests.

Summary labels show active days and property names only; counts follow the configured rules.
