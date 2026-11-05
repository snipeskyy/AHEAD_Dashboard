# Brand pack (local only)

Put your company's **approved** brand assets here to brand the dashboard. Everything in this folder except this
README and `brand.example.json` is git-ignored, so logos and trademarks stay on your machine and are never pushed to
the repository.

1. Get the official logo files and color values from your company's brand guidelines or marketing team. Don't
   recreate or trace a logo.
2. Copy the files into this folder, e.g. `logo.svg` (for light backgrounds), `logo-dark.svg` (for dark backgrounds)
   and `mark.svg` (a square icon, used when the sidebar is collapsed and as the browser-tab icon).
3. Copy `brand.example.json` to `brand.json` and fill it in.
4. Restart the app. Settings → Appearance shows the brand pack status and selects the **Brand** accent.

| Key                  | What it does                                                              |
| -------------------- | ------------------------------------------------------------------------- |
| `appName`, `tagline` | Sidebar title and subtitle, browser tab title                             |
| `wordmark`           | Short text mark (≤ 12 characters) used when there's no logo file          |
| `logo`, `logoDark`   | File names in this folder (.svg, .png, .webp or .jpg)                     |
| `mark`               | Square icon file name                                                     |
| `colors.primary`     | Main brand color (buttons, links, focus rings, active navigation)         |
| `colors.primaryDark` | Optional brand color for dark mode (otherwise a lighter shade is derived) |
| `footerNote`         | Optional short line, e.g. "Internal use only"                             |

Colors are checked against WCAG AA (4.5:1). If a brand color is too light or dark to read as text on the app's
background, a slightly adjusted shade of the same hue is used and Settings → Appearance says so. Chart series
colors never change: they stay on the fixed, colorblind-safe palette so each entity keeps its color.
