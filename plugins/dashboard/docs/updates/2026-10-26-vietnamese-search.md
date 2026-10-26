# Vietnamese search and Set up button — 1.1.1

## Reproduction and root cause

With a Vietnamese composition session active, send an input event containing
`Đọc`. The 1.1.0 code hides existing suggestions on compositionstart, ignores
input while its composing flag is set, and refuses runSearch while composing.
The result list therefore stays hidden until compositionend, which some input
methods defer until the word is committed. This is a search event-flow issue,
not an accent-normalization failure.

Three regression tests were written and failed on the old build: live suggestions
before compositionend; updating accented input without hiding matches; recovering
from a canceled composition when search loses focus.

## Fix

Search input now queues the normal 120-ms search regardless of composition state;
compositionstart no longer hides matches, and runSearch can display the current
in-progress value. The input element and its value are never replaced or edited.
The existing composition guards still leave Enter/arrow keys to the IME. Blur
clears canceled composition and pending suggestions. A late compositionend only
queues work when search still owns focus.

The tracker action is now labelled **Set up**, the English verb phrase. Its
background, text and border use the existing green action tokens in both themes;
hover keeps that green background with a small brightness change.

## Validation

9 model +26 integration tests pass, including the three new IME regressions.
Browser tests dispatch real DOM CompositionEvent/InputEvent sequences in Firefox,
verify suggestions are visible before compositionend and that composing Enter is
not prevented or used to open a file, then select/open the matched Vietnamese
file after composition. Two themes and four layout widths verify the label and
exact green button background. The mechanical detector reports no findings.

These are synthesized IME events in a simulated Obsidian host. They do not prove
hardware/OS-specific behavior for every Vietnamese input engine or live Obsidian
desktop/mobile. No screenshots or changes to a real vault were made.
