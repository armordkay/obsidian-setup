# Dashboard 1.4.5 — keep the clock aligned with avatar bottom

Root cause: the date column contributed its natural minimum height to the grid
row. When wrapped text exceeded avatar height, the clock moved below the image.
The previous browser assertions checked bottom alignment only on wide layouts.
Reproduced failure by removing that exception: a narrow pane showed the clock
3.6px below the portrait.

One CSS variable now defines both portrait column width and grid row height.
Date column has min-height:0; compact typography fits its content within the
row without clipping, overlap or enlarging the avatar. Wide-pane type, avatar
position, divider and spacing stay unchanged.

Validation: Firefox DOM/interaction checks pass in dark/light themes, with
explicit host widths 1440/700/390/280px (independent of Firefox's minimum window
size). At each width, all seven English weekdays and three representative dates
are checked for clock/image bottom alignment and no heading/clock overlap.
Existing search, rules, upload/reset and cleanup checks also pass. No screenshots
or live-vault changes. CSS-only change; Node runtime tests were not rerun.
