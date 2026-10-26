# Dashboard avatar assets

`cat.jpg` is the original user-supplied sleeping-cat image, 1350 × 1350 JPEG,
copied unchanged. SHA-256:
`ae08a4a9ca6346f88b7122d375f11885b37f6f44a2ff123b0de22b9872ce8354`.

`build.cjs` embeds this JPEG into `main.js` as the default and fallback avatar.
Installing the plugin still requires only main.js, manifest.json and styles.css.
CSS supplies the square frame, rounded corners and responsive size.
Custom avatars chosen in Set up are copied to the installed plugin's `images/`
directory (`.obsidian/plugins/dashboard/images` for a standard vault).

`ryo.png` is the previous user-supplied 1000 × 1000 RGBA PNG, retained unchanged
as a historical asset and upload test fixture. SHA-256:
`c9074107ac487d08c42b45a95320da88a2c2b5f150f0f1725d19ee1431494411`.
