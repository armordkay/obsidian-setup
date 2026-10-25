# Eisenhower Matrix — Obsidian

## Manual installation
1. Copy the eisenhower-native folder (main.js, manifest.json, styles.css) to VAULT/.obsidian/plugins/.
2. Restart Obsidian, then enable Eisenhower Matrix under Settings → Community plugins.
3. Add the following block to main.md and switch to Reading view:

```eisenhower
```

Alternatively, press Ctrl+P → Eisenhower Matrix: Open Eisenhower Matrix to open a dedicated tab.
No Dataview, iframe, server, or Supabase is required. main.js runs directly without an npm build.

## Version 1.1.0
- The matrix, task dialog, and calendar automatically follow Obsidian's light or dark theme.
- Click the blank bar or + in any quadrant to open the task dialog.
- Quadrant descriptions and task input placeholders are omitted. The interface is in English.
- The dialog contains Task, Due date, and Time fields.
- Due date and time start blank and are both optional. You can save a task with only its name, or add a time without a date.
- Time accepts HH:mm or four digits (1206 becomes 12:06) in a compact field the same size as the date field. Clear removes the time. There are no wheels, spinners, or time suggestions.
- The visible date field always uses yyyy-mm-dd, independent of the system locale. Type a date or open the centered calendar with the calendar button; leaving it blank is allowed.
- Task, date, and time fields keep the same dimensions on hover and focus.
- Adding tasks updates the list without flashing or entrance animations. Other quadrants retain their existing task rows.
- Saved example: - [ ] Submit assignment 📅 2026-10-25 09:30
- Dates retain the 📅 YYYY-MM-DD format for compatibility with existing Calendar deadline readers.
- Markdown uses task → date → time with spaces, while the matrix displays task date | time. Blank optional fields are omitted;
  minute-level reminders have not been verified with the custom Calendar fork.
- The plugin ID and existing task files are preserved. Existing tasks keep their original format.

## Tasks
Click the blank bar or + in a quadrant to open the task dialog. Both controls also work with Enter or Space when focused.
Enter a task name, then press Enter or Add task to save. Click outside the dialog, use the close button, or press Escape to cancel.
Enter a 24-hour time such as 09:30 or 0930, or leave it blank. The field formats while you type: 1 → 12: → 12:0 → 12:03. During Vietnamese or other IME input, a formatted preview is shown while the underlying text is left untouched until composition finishes, preventing duplicated digits. Only complete, valid times can be saved. Click Clear or delete the text to clear the time.
The calendar opens in the center of the window. Use the previous/next buttons to change months, select a day, or choose Today or Clear.
Calendar days support arrow keys and Home/End. Closing the calendar without selecting a day preserves the date.
Check a task to complete it; click × to delete it.
Matrices reuse an existing Eisenhower Tasks.md instead of creating separate files for each folder.
Lookup order is: the source note's folder, then each parent folder up to the vault root, then the rest of the vault.
The filename match ignores letter case. If several files exist elsewhere, the shallowest path wins;
ties use path order so the selection remains predictable. A file in the current folder always takes priority.
When no task file exists anywhere, adding a task or opening the task file creates Eisenhower Tasks.md beside the source note.
Concurrent first saves share the first file created. All matrices resolving to the same file share its tasks and updates.
Dedicated tabs retain their source note in workspace state and use the same lookup rules. Without an active note,
new files default to the vault root. Existing matrix tabs for the resolved task file are reused.
Moving the source note or adding, deleting, or renaming task files updates the lookup automatically.
Existing task files are not automatically moved or merged.
Do not rename this file or the four headings: ## Do / ## Decide / ## Delegate / ## Delete.
You can edit or add top-level checkboxes directly under these headings; do not place them in code blocks.
Headings inside frontmatter or code blocks are ignored when adding tasks. Unclosed frontmatter or code blocks must be closed before adding a task.
Data from the old JSON matrix is not imported automatically.

Example saved Markdown task:
- [ ] Submit assignment 📅 2026-10-25 09:30

The matrix displays: Submit assignment 📅 2026-10-25 | 09:30.
Separators are presentation only; completing a task preserves its saved text. Existing tasks are not rewritten automatically.

The task field also accepts: Submit assignment [due:: 2026-10-25]
and converts the date to 📅 syntax when saving.
New tasks do not receive a `^em-...` ID. Existing tasks with these IDs remain supported.
Actions on legacy IDs reject changed task content or duplicate IDs; refresh the board before retrying.
Adding tasks preserves LF or CRLF line endings. Fence markers with trailing text do not close code blocks.
Custom Calendar integrations must scan Eisenhower Tasks.md in the corresponding folders and support 📅 YYYY-MM-DD.
This plugin does not change Calendar code or configure Tasks filters.

## Appearance
The matrix retains four distinct quadrants, Urgent/Important axes, and controls.
There is no large title. A compact status badge sits at the top-right of the toolbar: Loading, Saving…, Saved, or Error.
Error details remain available in the badge tooltip and accessible label.
CSS is scoped to the matrix and its dialog. The font follows Obsidian's interface font, with Arial as a fallback;
no remote fonts are loaded and no data is sent over the network.
Backgrounds use miniVT's neutral surfaces and soft tints inspired by the Calendar dashboard.
The main surface inherits Obsidian's background color, with a standalone fallback.
Light mode uses the original bright rose, blue, cyan, and gray quadrant colors. Dark mode uses deeper, subdued tints for a softer appearance. Cards have no surrounding border. The add controls have no diagonal decoration. In both themes, the blank bar and + use matching neutral backgrounds with gray borders and hover/focus states. Dark-mode borders are subdued to avoid an overly bright outline.
Text, borders, focus rings, checkboxes, calendar selection, and save indicators retain their original colors.
Completed task rows retain their original faded appearance.
The surface wraps the matrix grid, with 32px of bottom padding.
The toolbar sits outside the surface. The surface is centered and limited to 1040px wide.
Change Obsidian's theme under Settings → Appearance; the matrix and any open task dialog update automatically.
The quadrants use two columns when space allows and one column when the matrix area is at most 600px wide.
Card height grows with task content.

## BRAT release
Upload main.js, manifest.json, and styles.css directly to release tag 1.1.0.
This is a separate plugin; Calendar can remain enabled.

## Verification
Automated checks cover task parsing, adding, completing, deleting, preserving other content,
manual tasks, code fences, changed-line detection, manual date/time validation, calendar navigation, and the task dialog save flow.
Regression tests also cover adding tasks without animations, unchanged row preservation, actions after line shifts, stale reads, and refresh locking.
Additional checks cover CRLF preservation, fenced content, stale or duplicate legacy IDs, and closing a dialog during a pending save.
Local/ancestor/vault lookup priority, shared files, concurrent first saves, source-note moves, dedicated-tab state, queued write targets, and task-date-time formatting are also covered.
Palette checks require at least 4.5:1 text contrast on the default light/dark surfaces, including quadrant titles and selected controls. Card fills also have at least 1.25:1 contrast in light mode and 1.3:1 in dark mode against the fallback dashboard backgrounds.
Run the tests with `node --test tests/main.test.cjs`. No dependencies are required.
The interface has not been tested inside the Obsidian application.
