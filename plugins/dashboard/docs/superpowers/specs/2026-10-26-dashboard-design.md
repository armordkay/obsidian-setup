# Dashboard for Obsidian — approved direction

The user approved mockup v11 and authorized implementation on 2026-10-26. This document records that direction and the implementation decisions needed to make it usable with real vault data. No commit, publishing, or installation into a live vault is authorized by this task.

## Purpose and scope

An independent `dashboard` plugin offers a reusable dedicated tab and a `dashboard` Markdown code block. It searches existing vault files, displays today's date and a monthly calendar, and shows a GitHub-style daily activity heatmap. The UI is English. It does not edit daily notes, create missing notes, track checkbox habits, count file modification history, or depend on other community plugins.

## Approaches

1. **Independent plugin with tab and embed — selected by the user.** Own lifecycle and layout; shares Obsidian's vault/cache and theme.
2. Extend Pomodoro or Eisenhower — rejected because this adds unrelated responsibilities and couples the dashboard to an existing plugin.

Builder choice: focused JavaScript sources are concatenated by a small Node build script into a self-contained CommonJS `main.js`. The installed plugin needs only `main.js`, `styles.css`, and `manifest.json`. No runtime or build dependencies are added.

## Daily activity contract

- One cell represents one local calendar day. The view contains today and the preceding 364 days, padded to 53 Sunday-first week columns. Padding and future dates are invisible, disabled, and excluded from statistics.
- No daily note: level 0. Existing daily: level 1. Numeric `deep_work >= 60` minutes: level 2. String `wins` with non-whitespace content: level 3, regardless of deep work. Missing, negative, nonfinite, or wrongly typed deep work is treated as zero. Non-string wins does not qualify.
- `date` in frontmatter, when a strict valid `YYYY-MM-DD` value (or a YAML date object), takes precedence. Otherwise parse the daily path using the configured Moment format in strict mode. Date-only properties never use UTC conversion on local date strings.
- Folder is recursive. Explicit empty folder means vault root. With automatic settings, prefer enabled Periodic Notes daily settings, then enabled core Daily Notes; otherwise use root and `YYYY-MM-DD`. In that fallback, a property-dated file must also contain `deep_work` or `wins`, or have a matching date filename. Within an explicit/detected daily folder, a valid date property identifies a daily note.
- Multiple files for one date are not added together. Prefer the canonical formatted daily path, then lexicographic vault path. Show the number of notes in the selected day's details. This deterministic policy is a builder choice.
- Opening a day only opens its existing selected note in a tab. A missing day gives an empty state and disables Open daily.
- Metadata cache is the source of properties. Initial indexing and metadata changes update all views. Create, delete, rename (including folders), resolved metadata, changed settings, and crossing local midnight invalidate relevant state. Only metadata is read; no full-content vault scan.

## Search

Search filenames and paths for all vault files, including attachments. Match normalized case/diacritic-insensitive query terms; rank exact filename, filename prefix, filename inclusion, then path matches. Limit results to 20 and debounce input by 120 ms. Display filename and vault path safely as text. Arrow keys move the active result, Enter opens it, Escape/outside click dismisses results. Respect IME composition. Verify the file still exists before opening. No network or content-search index.

## Visual contract

Preserve v11's search, date/calendar, and Activity Signal layout. Date year is green. No quotation, daily shortcut, example path, preview theme switch, or permanent technical annotations in the real plugin. Dark/light changes follow Obsidian, including existing views.

| Role | Dark | Light |
| --- | --- | --- |
| Page | `#1c1e1f` | `#f7fafc` |
| Panel | `#23292d` | `#edf1f4` |
| Search | `#191d20` | `#ffffff` |
| Text | `#dce3e9` | `#24364b` |
| Title / statistics | `#f1f5f7` | `#132b43` |
| Green accent | `#7ac6a6` | `#157657` |
| Empty cell | `#30383d` | `#dce3e7` |
| Level 1 | `#355d49` | `#b6d8c3` |
| Level 2 | `#508b68` | `#72b38b` |
| Level 3 | `#7ac6a6` | `#278653` |

Search focus surrounds the complete control; input stays transparent over the focused surface. Dark focus is gray/white; light focus blue. Heatmap month/weekday labels and compact Less–More legend remain close to the supplied reference. Three statistics count existing days, deep-work days, and days with wins independently. Details appear after date selection.

Responsive behavior is based on the Obsidian pane/container, not window width. Calendar stacks below the date in narrow panes; heatmap scrolls horizontally rather than distorting its 53 columns. Only notes containing an embed receive a wider readable-line limit. Use Obsidian interface fonts and icons. No screenshots are needed for further user previews.

## Accessibility and resilience

Search uses a combobox/listbox with an active descendant. Calendar and heatmap have roving keyboard focus, date labels, selected state and textual level descriptions; empty states do not invent sample statistics. Date details include full text rather than just color. Error/status text announces meaningful changes. UI strings and file content are inserted using textContent. Unload removes subscriptions, timers, DOM listeners and view resources. Settings failures preserve usable in-memory state and report that saving failed.

## Delivery and checks

Plugin ID `dashboard`, version `1.0.0`, minimum Obsidian `1.5.0`, desktop/mobile target. These are builder choices; actual Obsidian mobile testing is a separate validation limitation. Tests use Node's built-in test runner with Obsidian host doubles; browser checks run the same built entry point with a browser host fixture. Supply installation instructions and a local ZIP. A final systematic-debugging report records reproduced issues, root causes, regression checks and remaining environment limits.
