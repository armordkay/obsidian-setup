# Dashboard 1.4.1 — header separator and alignment

Added the requested 1px vertical separator between the avatar and date block,
using the existing theme border color. The date and HH:mm clock now align left.
The date block fills the header height and centers its content vertically.
Grid gap separates the avatar from the line; text padding is 20–36px, reduced
to 12px in panes below 320px. Tracker colors and runtime logic are unchanged.

Validated via the existing Firefox DOM/interaction checks in both themes at
1440/700/390/280px and a 500px pane within a wide window. Assertions cover the
separator color/width/height, left alignment, padding, avatar spacing, no page
overflow and existing interactions. No screenshots or live-vault changes.
