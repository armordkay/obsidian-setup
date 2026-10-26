# Dashboard 1.4.4 — smaller type and vertical edge alignment

Reduced weekday/date/time sizes slightly. Date column starts at the avatar top,
with weekday followed closely by the date. Automatic top margin on the clock
pushes it to the avatar bottom when the text fits within the avatar height.
Avatar remains top-left; its dimensions and wide divider spacing are unchanged.
Narrow wrapped layouts grow naturally so text never overlaps or clips.

Validation: existing Firefox DOM/interaction checks pass in both themes at
1440/700/390/280px and a narrow pane within a wide window. Added assertions
verify top-edge alignment at every size and bottom-edge alignment at desktop
widths, plus reduced type ranges. All existing interactions pass. No screenshots
or real-vault changes. CSS-only update; Node runtime tests were not rerun.
