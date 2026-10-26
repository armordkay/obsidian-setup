# Dashboard 1.4.6 — normal-layout clock alignment

User clarified that only the normal layout needs the clock row and avatar
bottoms aligned. Compact panes may wrap naturally. Existing source CSS was
1.4.4 on entry; retained its type sizes and avatar positions.

Changed the date column to three grid rows with an explicit height derived from
the same variable as avatar width. The final clock row ends at the portrait
bottom. Clock line-height is 1. Direct-child margin/padding resets prevent
Markdown host spacing from shifting the clock or heading. At 600px container
content width or below, height and grid rows are automatic; text is no longer
shrunk to match the image height. No runtime or palette changes.

Validation: impeccable layout detector reports no findings before/after.
Firefox checks pass in both themes at explicit host widths 1440/700/390/280px,
including all seven weekdays and representative dates. Normal panes assert
matching avatar/clock bottoms; compact panes assert readable type and no
heading/clock overlap. Extra Markdown host margin/padding fixture also passes.
Search, rules, avatar imports/default reset and cleanup checks pass. No
screenshots or real-vault writes. Node tests not rerun for this CSS-only change;
live Obsidian remains untested.
