# Configurable tracker and search — Dashboard 1.1.0

User-authorized update: add Setup at the top right of the tracker; keep level 1
fixed to daily-note existence; choose a frontmatter property and Text/Number for
each of levels 2–3. Text requires a nonblank string. Number requires a finite
numeric value greater than or equal to the configured finite minimum. Level 3
retains priority independently of whether level 2 is satisfied.

Implemented as an inline form with Save/Cancel, validation, saving state, error
recovery, keyboard access and responsive fields. Settings version remains 1;
old settings get the original deep_work/60 and wins defaults automatically.
Every tab/embed uses the same saved rules. Property names are exact top-level
frontmatter keys; no nested-path evaluation or implicit conversion is performed.
Statistics count rule matches independently; legend and details use current rules.

Automatic fallback detection accepts configured properties in addition to the
original deep_work/wins markers, so changing rules does not lose existing daily
notes that use custom titles. Date parsing and folder/duplicate policies remain.

Search still matches name/path substrings with case/diacritic normalization.
Suggestions no longer preselect a file: first ArrowDown selects first, ArrowUp
selects last, Enter opens the selected or first result. Handling stops key
propagation so Obsidian shortcuts do not consume these navigation keys. Metadata
refresh preserves a user's active matching file. IME composition and the earlier
debounce/dismissal regressions remain covered.

Validation: 9 model +23 integration tests pass. Tests cover custom text/numeric
rules, level priority, typed values, inherited-property rejection, migration,
blank/invalid/zero thresholds, cancel, save failure/retry, reload persistence,
cross-view updates and search selection. Firefox host checks pass in both themes
at 1440/700/390/280px with Setup open and closed, plus a narrow pane inside a wide
window. Browser checks exercise actual Save submission, type switching, inline
errors, custom metadata activity and no script errors. Mechanical detector has
no findings. No screenshots were created; no real vault was changed.

The simulated-host limitation remains: live Obsidian desktop/mobile was not run.
Release archive contains the current main.js, styles.css and manifest.json only.
