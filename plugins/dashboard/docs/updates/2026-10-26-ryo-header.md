# Ryo header and horizontal Set up action — 1.2.0

The user requested removal of the duplicate calendar in the header, shifting the
weekday/date into the freed space, using the supplied Ryo.png on the left in a
slightly rounded square, and making Set up a horizontal control with a single-line
label. This update supersedes the original header-calendar design.

The header now contains the original 1000×1000 RGBA image left, date right. CSS
uses a 108–200px square, radius 14px and 20–48px gap; under 320px the image is 72px,
gap 14px and heading 28px. No image editing or regeneration was performed. Source
SHA-256 matches the supplied file (see assets/README.md). build.cjs embeds the PNG
in main.js, preserving the existing three-file installation and offline operation.

Removed the header calendar, its event handlers, unused date/month helpers and
calendar-specific styles/tests. Heatmap selection, keyboard navigation, daily
details, IME search, rule setup and midnight updates remain available.

Set up is a green horizontal control 100–280px wide with a nowrap label. The title
can wrap inside a very narrow pane; the action label stays on one line.

Validation: 8 model +27 integration tests pass, including image PNG dimensions,
header ordering, no duplicate calendar, and existing feature regressions. Firefox
checks confirm the embedded image loads at natural width 1000, its frame is square
and rounded, portrait precedes date, Set up is wider than twice its height with a
nowrap label, and no page overflow at 1440/700/390/280px in both themes. A 500px
pane inside a wide window also retains the new layout. No screenshots were created.
Mechanical detector reports no findings. Source image and embedded bytes are
checked; release ZIP contains only the current main.js, styles.css, manifest.json.

Validation still uses a simulated Obsidian host, not live desktop/mobile vaults.
