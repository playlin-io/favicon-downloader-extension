# Favicon Downloader

A Chrome extension that finds and allows you to easily download a favicon from any website you're visiting. Browse to a site, open the extension, and save the highest-quality icon available without having to hunt through network requests or source code.

Open-sourced by [Playlin](https://playlin.io).

---

## Features

- **Automatic detection**: Opens directly to the favicon(s) of your current tab the moment you click the extension icon.
- **Multiple sources**: Scans the page's `<link>` tags, common favicon paths (`/favicon.ico`, `/favicon.png`, `/apple-touch-icon.png`), and falls back to Google's favicon service to ensure something is always found.
- **All sizes, side by side**: When multiple icons are discovered, they are displayed as a scrollable thumbnail list sorted by resolution (largest first), so you can pick the one you want.
- **SVG favicons**: Detects linked SVG icons and `/favicon.svg`, offering a labeled 512×512 PNG option with the artwork centered on a white background.
- **PNG conversion**: Raster icons keep their native resolution, padded to a square on white; SVG icons are rendered at 512×512 before download.
- **Smart filename**: The download filename is pre-filled from the site's title (e.g. `github-favicon.png`) and can be edited before saving.
- **Keyboard friendly**: Press Enter in the filename field to trigger the download without reaching for the mouse.
- **Copy PNG**: Use the copy button above any icon to copy its PNG image directly to the clipboard.

## Installation

This extension is not published to the Chrome Web Store. Load it as an unpacked extension:

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions`.
3. Enable **Developer mode** (toggle in the top-right corner).
4. Click **Load unpacked** and select the repository folder.
5. The Favicon Downloader icon will appear in your toolbar.

> **Generating the extension icon:** Open `icon.html` in your browser and click **Download icon.png**, then place the downloaded file in the repository root. This step is only needed if `icon.png` is not already present.

## Usage

1. Navigate to any website.
2. Click the **Favicon Downloader** toolbar icon.
3. The extension automatically searches for favicons and displays a preview.
4. If multiple icons were found, click any thumbnail to select it.
5. Edit the filename slug if desired.
6. Click **Download** (or press Enter) to save the icon as a PNG.

## Permissions

| Permission | Reason |
|---|---|
| `activeTab` | Read the URL of the current tab to search for its favicons. |
| `scripting` | Inject a script into the page to extract `<link rel="icon">` tags. |
| `downloads` | Save the selected icon to disk. |
| `clipboardWrite` | Copy a selected PNG image to the clipboard. |
| `host_permissions: <all_urls>` | Fetch favicon images from any origin. |

## Project Structure

```
manifest.json   # Extension manifest (Manifest V3)
popup.html      # Extension popup UI
popup.js        # Favicon discovery, preview, and download logic
icon.html       # Utility page for generating the extension's own icon.png
```

## License

See [LICENSE](LICENSE) for details.
