# Pacific Bowmen — Archery Scorecard v1.5.1

An offline-first, installable web app for Pacific Bowmen. All scores, optional archer photos and archived shoots remain on the user's device. No accounts, database, login or build process are required.

## Competition formats

All formats are **one round with 20 targets**:

| Format | Rules | Maximum |
| --- | --- | ---: |
| 1-arrow Pacific Bowmen | One arrow per archer per target; A=20, B=18, C=16, Miss=0 | 400 |
| 2-arrow Pacific Bowmen | Two arrows per archer per target; both count equally | 800 |
| 3-arrow ABA | Arrow 1: 20/18/16; Arrow 2: 14/12/10; Arrow 3: 8/6/4; stop at first hit | 400 |

Select Club or Casual Shoot, then the scoring format. The app advances through archers, then targets, automatically.

## Changes in v1.5.1

- New **1-arrow Pacific Bowmen** format.
- The interface and CSV exports now use **target** terminology instead of incorrectly referring to 20 rounds.
- **Protected target selection:** tap does not change the active target; press and hold a target or previous/next navigation button for approximately one second. Desktop users can right-click, or use Shift+Enter with keyboard focus. Normal scoring still advances automatically.
- Completed shoots offer **View Scorecards**, with an individual read-only scorecard for each archer, showing all target/arrow results, running totals, arrow totals and grand total.
- Individual scorecards are also accessible through History and can be **emailed/shared as an A4 PDF**, generated locally with no internet service. On compatible phones, the share sheet includes the PDF attachment; when unsupported, the PDF downloads for manual sharing.
- Existing scores, JSON backups and older shoots remain compatible with the same storage keys. Older shoot files without a format are treated as 2-arrow Pacific Bowmen.

## Deployment to GitHub Pages

1. Unzip this package.
2. Upload **all files and folders inside** this directory to the root of the `pacific-bowmen-score` GitHub repository, replacing existing versions. Make sure `index.html`, `app.js`, `pdf.js`, `styles.css`, `sw.js`, the `manifest.webmanifest` and `icons/` are all present.
3. Commit the changes; GitHub Pages builds and deploys the site.
4. Open the GitHub Pages link on your phone and close/reopen the installed home-screen app to pick up the updated service worker. If the old version remains, reconnect to the internet and reload a second time. **Do not clear website data**; local scores/history might be lost.

## Score preservation

Use **Save Shoot** to archive a shoot on this device. **History** allows reviewing old scores and restoring a previous shoot. **Backup** exports JSON containing complete scores and optional photos. **Restore** imports JSON. **Email results** shares a CSV of all archers. PDF scorecards are individual exports for completed shoots.

**Important:** GitHub Pages only hosts the application code; it does not store any scores or photos. Keep copies of JSON backups in iPhone Files, iCloud Drive or another separate location.

## Technical details

This is a plain static PWA. `pdf.js` is a small, bundled, dependency-free offline PDF writer. `sw.js` caches the application code and icons. No external PDF service or API is used. iOS share targets (Apple Mail, Outlook, etc.) decide whether to apply the proposed message subject; the app only guarantees that the PDF file is made available for sharing.
