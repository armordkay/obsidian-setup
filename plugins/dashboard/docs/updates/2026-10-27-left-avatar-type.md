# Dashboard 1.4.3 — restore left avatar, enlarge date and clock

Avatar is anchored to the left content edge again. Removed centering of the
complete header group; the date column fills the remaining space. The increased
avatar/divider/date spacing from 1.4.2 is retained.

Weekday increased to 22–26px, date to 40–68px (32px in panes below 320px), and
clock to 26–40px. The 2px weekday/date gap remains. Text wraps within narrow
panes. No tracker behavior, image storage or palette changes.

Validation: Firefox DOM/interaction checks pass in both themes at
1440/700/390/280px and a narrow pane in a wide window. Assertions verify the
avatar left edge, enlarged typography, retained spacing, no page overflow and
existing interactions. CSS-only change; Node runtime tests were not rerun.
No screenshots or live-vault changes; live Obsidian remains untested.
