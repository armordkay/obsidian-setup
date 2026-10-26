# Final systematic debugging — Dashboard 1.0.0

Date: 2026-10-26. Scope: the standalone Dashboard plugin, approved mockup v11,
real metadata-driven activity, file search, settings, tab/embed lifecycle.

## Method

Used the explicitly requested systematic-debugging skill: reproduce the failure,
trace input/state flow, compare the working event path, add a failing regression,
make a minimal root-cause fix, then rerun the relevant tests and final suite.
No live vault, external services, publishing, or commits were involved.

The referenced subsidiary TDD/verification skills were not installed locally;
their relevant test-first and evidence-before-completion practices were followed
directly. The available systematic-debugging skill itself was read and applied.

## Reproduced defects and fixes

### 1. Enter opened an outdated search result

- Reproduction: search Alpha; change input to Beta; press Enter before the 120-ms
  debounce fires. The test opened Alpha instead of Beta.
- Root cause: keyboard handling canceled the debounce but reused the visible
  result list, whose contents belonged to the previous query.
- Fix: detect pending query work and synchronously compute current results before
  choosing the file.
- Regression: `Enter after a new query opens its current result instead of the previous query`.

### 2. Outside dismissal was undone by debounce

- Reproduction: type a query, immediately click outside search, then allow pending
  timers to run. The dropdown reopened.
- Root cause: hideResults only changed DOM visibility; the pending search callback
  remained scheduled.
- Fix: cancel the search timer whenever results are dismissed.
- Regression: `dismissed pending search stays closed after outside pointerdown`.

### 3. First ArrowDown skipped the first result

- Reproduction: focus a collapsed search with multiple matching files, then press
  ArrowDown. Active result was index 1, not index 0.
- Root cause: opening results selected index 0, then the same key handler advanced
  the selection a second time.
- Fix: when results are newly opened/recomputed, select first for ArrowDown or
  last for ArrowUp; only subsequent arrow events advance.
- Regression: `first ArrowDown from a collapsed search highlights the first result`.

### 4. A delayed tab survived plugin disable

- Reproduction: pause asynchronous setViewState; unload plugin; resume tab
  creation. A board/subscription was created after shutdown.
- Root cause: the view creation continuation did not recheck plugin lifecycle.
- Fix: guard view onOpen against stopped state and detach the leaf when pending
  tab creation completes after shutdown.
- Regression: `disabling during asynchronous tab creation leaves no dashboard or subscriptions`.

## Environment-only browser harness issue

An initial browser run passed its functional assertions, then exited with a
PermissionError while terminating the spawned geckodriver process. That first
run was not counted as a successful command. Firefox/driver ownership in the
managed execution environment prevents the Python cleanup signal. Re-running
with a tool-managed external WebDriver via GECKODRIVER_URL completed with exit 0;
the browser session was deleted through WebDriver, and the driver is stopped by
its owning tool. No plugin changes were made to hide this environment problem.

## Verification evidence

- `node dashboard/build.cjs` and `node --check dashboard/main.js`: pass.
- `node --test dashboard/tests/*.test.cjs`: both test files pass.
- Direct model suite: **6/6 pass**. Direct integration suite: **17/17 pass**.
- Model suite under `TZ=America/New_York` and `TZ=Pacific/Auckland`: **6/6 pass in each**.
- Firefox host checks: dark/light at 1440, 700, 390 and 280px; exact original
  palettes, 53 columns, one heatmap tab stop, input focus surface, no page
  overflow; a 500px pane inside a 1440px window correctly stacks the calendar.
- Browser behavior: accent-insensitive live search and file opening, debounce
  regression, live metadata level changes, daily details, calendar keyboard
  focus, missing-day disabled state, multiple embeds and unload cleanup.
- Browser fixture reports no script errors or unhandled rejections.
- Impeccable mechanical detector over `styles.css` and `src/board.js`: empty
  findings list. No screenshots were created, following the user's preference.
- Fresh independent finish review: **ship** for the reviewed implementation;
  reviewer ran the direct 23 test cases and syntax check independently.
- Removed Setting.setHeading() in favor of a standard DOM heading, so the
  settings section does not require that unverified version-specific method.

## Practical limits

The Node and Firefox hosts simulate Obsidian. These results do not prove live
Obsidian desktop/mobile integration or every third-party theme. Daily Notes and
Periodic Notes inheritance uses optional internal adapters consistent with the
existing Calendar plugin; custom folder/format configuration remains available.
Moment parsing in test doubles covers the configured fixture formats, not every
possible Moment token; the real plugin delegates to Obsidian's Moment export.

The final ZIP is verified to contain only main.js, styles.css and manifest.json,
with bytes matching the delivered build. User-selected original tracker colors
are preserved; no blanket accessibility-compliance claim is made for those colors.


## 1.4.0 follow-up

Avatar paths were derived from the parent plugin directory; the revised behavior
uses the actual dashboard directory and migrates the selected legacy file by
copying it. Regression tests first failed for the new destination and migration.
The shared timer previously detected only day changes; it now also checks local
HH:mm. All 50 behavior tests and Firefox responsive/interaction checks pass.
Details: updates/2026-10-26-cat-clock.md. No screenshots or real vault changes.
