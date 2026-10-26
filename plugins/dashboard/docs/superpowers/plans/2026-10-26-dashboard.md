# Dashboard Implementation Plan

> **For agentic workers:** Implement task-by-task with the available native tools. The user explicitly authorized implementation in this session. Referenced executing-plans/test-driven-development/verification-before-completion skills are not installed; preserve their relevant test-first and evidence-before-completion practices without claiming to invoke them. Steps use checkbox syntax.

**Goal:** Deliver an installable Obsidian dashboard matching approved mockup v11 with live vault search and daily-note activity.

**Architecture:** Focused dependency-free JavaScript sources are concatenated into a single CommonJS plugin entry point. A shared metadata index drives independent tab/embed boards; boards own DOM listeners and UI state, the plugin owns settings and index lifecycle.

**Tech Stack:** JavaScript, Obsidian API and built-in Moment, scoped CSS, Node built-in test runner, Python standard-library browser validation tooling.

**Spec:** `../specs/2026-10-26-dashboard-design.md`

## Global Constraints

- Plugin ID `dashboard`, version `1.0.0`, minimum Obsidian `1.5.0`, desktop/mobile target.
- No runtime or build dependencies are added.
- No daily notes are created or modified. Search opens existing files.
- Numeric `deep_work >= 60` minutes: level 2. String `wins` with non-whitespace content: level 3.
- Preserve the exact three-level palettes from the approved spec; UI is English and follows Obsidian theme.
- No commit, publishing, or installation into a live vault is authorized by this task.

## Review Focus

1. Cache arriving after file creation: file appears as level 1 before properties resolve, then updates all boards.
2. DST, leap days, and midnight: cells represent local calendar dates without skipped/duplicated dates.
3. Duplicate dates, nested daily folders, and folder rename: deterministic selection and no stale activity.
4. IME, hostile filenames, and file deletion during search: no premature opens, HTML injection, or unhandled rejection.
5. Embedded notes, narrow panes, and unload while work is pending: no layout leak, late repaint, or retained subscriptions.

## File structure

- `src/model.js`: strict dates, calendar/range generation, activity rules, search ranking, settings normalization.
- `src/index.js`: daily settings resolution and shared metadata index.
- `src/board.js`: DOM, search, calendar, heatmap, daily details, cleanup.
- `src/plugin.js`: view/embed registration, native settings, persistence, lifecycle, file opening.
- `build.cjs`: deterministic concatenation into installable `main.js` without dependencies.
- `manifest.json`, `styles.css`: Obsidian entry metadata and scoped responsive styles.
- `tests/model.test.cjs`, `tests/integration.test.cjs`, `tests/host.cjs`: built-in Node tests and reusable Obsidian host double.
- `tests/preview.html`, `tests/browser-host.js`: run the real built plugin in a simulated browser host for manual/WebDriver checks.
- `README.md`, `DESIGN.md`, `docs/systematic-debugging-2026-10-26.md`: usage, final palette/context and verification evidence.

## Task 1: Date, activity and search model

**Interfaces:** `parseDay(value) -> string|null`, `localDay(date) -> string`, `shiftDay(day,delta) -> string`, `activity(frontmatter) -> {level,deepWork,wins}`, `heatmapDays(today) -> {day,inRange,future}[]`, `calendarDays(month) -> (string|null)[]`, `searchFiles(files,query,limit=20) -> file[]`, `normalizeSettings(value) -> settings`.

- [x] Add tests pinning invalid dates, leap years, string/negative/infinite deep work, blank/non-string wins, wins-overrides-deep-work, 365 in-range days, and accent-insensitive ranked file search.
- [x] Run `node --test dashboard/tests/model.test.cjs`; expect failure before the source exists.
- [x] Implement `src/model.js` with local noon date arithmetic and explicit numerical/type validation.
- [x] Run the same model tests; expect all pass. Repeat date tests under `TZ=America/New_York` and `TZ=Pacific/Auckland`.

## Task 2: Shared vault index and settings detection

**Interfaces:** `resolveDailySettings(app,settings) -> {folder,format,source}`, `DailyIndex(app,settings,parseFormat)` with `rebuild()`, `update(file)`, `get(day) -> {file,level,deepWork,wins,count}|null`, `subscribe(listener) -> unsubscribe`, `dispose()`.

- [x] Add integration assertions for inherited Periodic/Core settings, explicit root folder, metadata-date precedence, malformed date fallback, recursive folder boundaries, canonical duplicates and property-only fallback identification.
- [x] Run `node --test dashboard/tests/integration.test.cjs`; expect relevant index failures.
- [x] Implement the shared index with per-path cached entries and deterministic daily grouping. Resolve nested path formats strictly using Obsidian Moment.
- [x] Test metadata arrival, modification, folder rename/delete and rescan behavior. Expect removed paths to disappear and every subscribed board to receive current state.

## Task 3: Real plugin, views and file opening

**Interfaces:** `DashboardPlugin` exports the Obsidian entry; `openDashboard()`, `openFile(file)`, `refresh()`, `applySettings(next)`, `subscribe(listener)`. `DashboardBoard(container,plugin)` extends MarkdownRenderChild and cleans up on unload.

- [x] Add tests proving command/ribbon/view/embed registration; rapid duplicate open reuses one tab; opening vanished files reports a Notice; load/save failures remain visible and retryable.
- [x] Implement view registration `dashboard-view`, block name `dashboard`, settings storage version 1, serial saves, event cleanup, 30-second local-date check and metadata/vault event handlers.
- [x] Add `build.cjs` and `manifest.json`; build with `node dashboard/build.cjs`, syntax-check with `node --check dashboard/main.js`.
- [x] Run both test files. Verify unload removes boards/subscriptions and late work cannot repaint disposed UI.

## Task 4: Dashboard UI and scoped themes

**Interfaces:** Board consumes the shared index and search list; produces no note mutations. All UI class names use the `db-` namespace within `.vault-dashboard`.

- [x] Build search combobox/listbox with 120-ms debounce, composition guard, arrows/Enter/Escape, outside dismissal, real file opening and safe text content.
- [x] Build local-date header, green year, Monday-first monthly calendar and 53-column Sunday-first heatmap with roving keyboard navigation.
- [x] Render the three independent real counts, Less–More legend and selected-day details. Missing dates disable Open daily; dates with duplicates disclose their count.
- [x] Port v11 colors/layout to `styles.css`, using Obsidian themes and container breakpoints at 760/600px; keep heatmap scrolling inside narrow containers. Embed-only note-width rule.
- [x] Exercise all controls in the real built entry using browser host fixture. At widths 1440/700/390/280, expect no page overflow, correct theme colors, full-width search focus and working file/date navigation.

## Task 5: Final systematic debugging and delivery

- [x] Use systematic-debugging: reproduce any failing behavior, trace its source, compare existing working patterns, add a regression case, then fix one root cause at a time.
- [x] Check stale search after rename/delete, metadata cache timing, midnight/DST, concurrent save failure/retry, multiple embeds and unload during pending callbacks.
- [x] Build and run `node --test dashboard/tests/*.test.cjs` plus browser behavior checks; record actual results and the limits of host simulation.
- [x] Write README/install guide, DESIGN.md and final debug report. Generate `dashboard/releases/dashboard-1.0.0.zip` containing only `main.js`, `styles.css`, `manifest.json` at the ZIP root.
- [x] Verify ZIP content and current build equality. Do not commit, publish, or modify a real vault.
