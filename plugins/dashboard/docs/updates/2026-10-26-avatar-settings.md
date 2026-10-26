# Configurable avatar and compact Set up — 1.3.0

User request: shorten Set up, choose avatar in that panel, and put selected images
in an images folder at the same level as the dashboard plugin directory.

The interpreted runtime location is VAULT/.obsidian/plugins/images beside
VAULT/.obsidian/plugins/dashboard, announced before implementation. The plugin
uses manifest.dir (or the vault's custom configDir fallback) to derive that path;
it does not depend on a development-machine path or require Node filesystem APIs.

Set up has a native file chooser accepting PNG/JPEG/WebP/GIF up to 20 MB, current
preview, filename, Use default and Save/Cancel. Imports occur only after valid
level rules and explicit Save. Image signatures are checked, filenames are cleaned
and uniquified, and imports are serialized to avoid overwriting prior images.
Original files are copied, not deleted. Saved relative paths are scoped to the
sibling images folder and resolved with the Obsidian adapter's getResourcePath.
No selected file is embedded into settings or loaded through a remote URL.

The selected path persists with existing version-1 settings and defaults to empty
for older installations. Existing Ryo remains the embedded fallback. If an image
is unavailable, a view falls back without retrying the same broken resource on
every repaint. A save failure keeps the active in-memory image and can retry
without copying again. Cancel does not import; default reset retains old files.
Closing during image reading does not create a file or persist stale UI state.

The green Set up control is content-sized again, with 14px horizontal padding,
36px minimum height and nowrap text. Avatar controls stack on narrow panes.

Validation: 11 avatar tests, 8 model tests, and 27 integration tests pass. Browser
checks use WebDriver to upload through the real file input, press Save, verify the
adapter's sibling destination and persisted setting, load the resource as an
image, update multiple views and reset to default. Eight theme/width combinations
verify compact control dimensions and no overflow with Set up expanded. Tests use
an in-memory Obsidian adapter, so no real vault was changed. No screenshots were
created. The live Obsidian/mobile adapter and OS picker remain outside this host
simulation's verification scope.
