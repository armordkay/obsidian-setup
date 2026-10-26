# Dashboard 1.4.7 — lower the date heading

Added 8px top margin to the date heading in normal layouts. Weekday, avatar and
clock row remain fixed; clock still aligns to avatar bottom. Compact panes
remove the added margin and retain natural flow.

Firefox checks pass in both themes at 1440/700/390/280px, including the new
margin assertion and existing clock alignment, date overlap and Markdown host
spacing assertions. No screenshots or real-vault writes. CSS-only update;
Node runtime tests were not rerun. Live Obsidian remains untested.
