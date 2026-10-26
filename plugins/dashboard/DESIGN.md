# Dashboard visual contract

The user-approved visual reference is mockup v11 with the subsequent requested
header updates through 1.4.4: search → cat portrait/date/clock → Activity Signal. All UI is English.

This is an operating surface: file selection, date navigation, and daily review
are the primary interactions. There is no motivational copy, daily shortcut,
preview-only theme toggle. The cat portrait is the supplied image.

## Tokens

The runtime source of truth is `styles.css`, scoped to `.vault-dashboard`.

| Role | Light | Dark |
| --- | --- | --- |
| Page | `#f7fafc` | `#1c1e1f` |
| Panel | `#edf1f4` | `#23292d` |
| Input | `#ffffff` | `#191d20` |
| Border | `#c4ced7` | `#3b454e` |
| Text | `#24364b` | `#dce3e9` |
| Title / counters | `#132b43` | `#f1f5f7` |
| Muted text | `#50657a` | `#a8b5c1` |
| Green / year | `#157657` | `#7ac6a6` |
| Blue / focus | `#1670a0` | `#79d2f4` |
| Empty cell | `#dce3e7` | `#30383d` |
| Level 1 | `#b6d8c3` | `#355d49` |
| Level 2 | `#72b38b` | `#508b68` |
| Level 3 | `#278653` | `#7ac6a6` |
| Search focus | `#1670a0` | `#b2bbc0` |
| Focused search surface | `#ffffff` | `#202528` |

Palettes are the original three-level colors requested by the user; they are
not automatically adjusted or reversed. Activity is also described in text,
tooltip and accessible labels. No universal contrast-compliance claim is made
for these user-selected data colors.

## Shape, type, layout

Use the Obsidian interface font. Main date is 34–56px (28px in very narrow panes) with a green year; section
title is 20px, body 15px, secondary text 12–13px. Statistics use tabular numbers.
Panel radius 16px, search 9px, controls 8px and heatmap cells 3px.

Root is centered, max-width 1180px. Hero uses 28px/30px insets, then a two-column
row: square cat portrait left and flexible, left-aligned date and HH:mm clock on the right side of the portrait. Portrait is 108–200px,
gap 20–48px, radius 14px and a thin existing border. At container 320px, portrait
is 72px with 14px gap and date text 28px. Root observes pane width, including
embedded notes and narrow panes in a wide desktop window. The original supplied
1350×1350 JPEG pixels are preserved; build.cjs embeds it in main.js.

The heatmap is 53 Sunday-first columns by 7 rows; minimum graph width 790px.
Narrow panes scroll only the heatmap. Month labels and Mon/Wed/Fri row labels
match the GitHub reference; legend is compact Less–More.

## State and interaction

Search focus is a single full-control border/inset ring; the input has no second
outline and remains transparent over the surface. Result name/path are text,
with a listbox active state. Heatmap has visible keyboard focus
and roving tab stops. Day details appear only after selecting a day. Missing
daily disables Open daily. Empty and storage-error states appear only when needed.

No entrance animations, external fonts or network resources. The only raster
default asset is the user-provided cat portrait, embedded locally. Custom avatar
images selected in Set up are stored in the plugin images directory.

## Version 1.1 — tracker setup

Activity Signal has a horizontal green Set up action at the top right. It is
content-sized with 14px horizontal padding and at least 36px tall, with a nowrap label. It expands an inline
form above the statistics; no modal or navigation away from the dashboard.
Each level has Property, Data type (Text/Number), and a numeric minimum shown only
for Number. Level 1 is fixed. Save applies and persists settings to every view;
Cancel discards the draft. Missing names and invalid thresholds receive inline
errors and focus. The form uses the existing input, border, green action and blue
focus tokens. At 600px the property occupies a full row; at 320px fields stack.

Version 1.1.1: Set up uses the same green action background and foreground as Save
in each theme. Live search suggestions also update during IME composition; only
navigation and commit keys are left to the IME until composition ends.

Statistics, legend titles and daily details describe the active configured rules.
Search suggestions start without an active selection; first ArrowDown selects
the first file, subsequent arrows navigate, and Enter opens the selected file
(or the first result if none is selected). Metadata refresh preserves selection.

## Version 1.3 — avatar controls

Set up now includes an Avatar fieldset with a 64px rounded preview, Choose image,
Use default, selected filename and destination/format help. Controls use the
existing neutral button tokens; the compact Set up action remains green. On very
narrow panes the preview stacks above the controls to avoid overflow.

Image selection is a draft until Save. Imports go to a sibling images directory
derived from the actual plugin location via the Obsidian adapter. The persisted
relative path resolves through getResourcePath; every view updates together.
The default Ryo image remains embedded, including as fallback for a missing file.
No external URL or source-device path is saved. Cancel discards the draft;
Use default does not remove previously imported files.

## Version 1.4 — cat, nested image storage and clock

The new default is the original cat.jpg, embedded unchanged. Existing chosen
avatars remain selected. New imports go into dashboard/images. On upgrade the
selected legacy sibling image is copied into that directory and its saved path
updated; originals remain. A failed copy keeps the previous path usable.

Weekday, date and year align to the right of the header, balancing the left
portrait. A local 24-hour HH:mm time sits below the date, using title color and
tabular numerals. The plugin's single shared 30-second interval checks both day
and minute changes; switching leaves also checks immediately. No per-view timer
or live-region announcement is added. Selected historical tracker dates survive
midnight, while a selection on today follows the new day.


## Version 1.4.1 — header divider and left alignment

The date/clock column now aligns left with a 1px vertical divider in the existing
border token. The line spans the header row height. Avatar-to-divider grid gap
remains 20–48px (14px in the narrowest panes); divider-to-text padding is
20–36px, reduced to 12px below 320px to retain usable date width.


## Version 1.4.2 — balanced header and concise statistics

The avatar/divider/date group is centered as a whole within the hero, while date
text stays left-aligned. Content-sized date columns avoid unused space on the
right. Avatar-to-divider gap is 32–80px and divider-to-text padding is 32–64px.
Below 600px these become 24px each, with an 88–120px avatar; below 320px they
become 18px and 16px, with a 72px avatar. Text can wrap within the pane.

Weekday is 19px with line-height 1.25 and 2px bottom spacing to sit close to the
date. Summary labels are active days and configured property names only.
Existing count calculations and full rule descriptions in legends/details stay
unchanged. Each summary pair uses an explicit 7px gap between number and label.


## Version 1.4.3 — left-anchored avatar and larger date typography

The avatar returns to the hero's left content edge. The date uses the remaining
column with left-aligned text, keeping the increased divider spacing from 1.4.2.
Weekday is 22–26px, date 40–68px (32px below 320px), and clock 26–40px.
The weekday stays close to the date with its existing 2px bottom margin.
Text wraps within very narrow panes; no per-theme typography difference.


## Version 1.4.4 — edge-aligned date block

Typography is slightly smaller: weekday 20–24px, date 36–60px (30px below
320px), clock 24–36px. The date column stretches to the header row height.
Weekday sits at the top, close to the date; the clock's automatic top margin
places it at the bottom, aligned to the avatar on layouts with enough height.
Avatar stays anchored top-left with the same size, divider and wide spacing.
In very narrow panes where wrapped date text exceeds the avatar height, the
column grows naturally to avoid overlapping or clipping content.
