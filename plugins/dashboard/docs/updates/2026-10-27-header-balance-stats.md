# Dashboard 1.4.2 — header balance and short summary labels

Centered the complete avatar/divider/date group inside the hero with a
content-sized date column. The date text still aligns left. Increased spacing
on both sides of the divider; responsive spacing retains usability in narrow
panes. Weekday increased from 17px to 19px, line-height reduced to 1.25 and
bottom gap reduced from 8px to 2px to sit closer to the date.

Summary labels now read active days, deep_work and wins by default. Custom rules
use their own property names. Counts remain data-driven; thresholds and text
requirements still control totals and remain available in legends/details.
Summary number/label pairs use a 7px flex gap.

Validation: build and syntax check pass; all three Node suites (50 behavior
tests) pass, including new assertions for default and customized short labels.
Firefox checks pass in dark/light at 1440/700/390/280px plus a narrow embedded
pane. Assertions verify horizontal centering, increased spacing, weekday size
and gap, short labels, no page overflow and existing interactions. No
screenshots or real-vault changes; live Obsidian has not been tested.
