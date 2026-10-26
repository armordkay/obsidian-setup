# Dashboard 1.4.8 — date offset follow-up

Increased the normal-layout date heading top margin from 8px to 12px, lowering
it another 4px. Avatar, weekday and clock positions remain fixed; compact top
margin remains zero.

Validation: Firefox checks pass in both themes at 1440/700/390/280px, including
the revised margin, normal clock/avatar alignment, no date/clock overlap and
Markdown host spacing. Impeccable layout detector has no findings. No screenshots
or live-vault writes. CSS-only update; Node tests not rerun.
