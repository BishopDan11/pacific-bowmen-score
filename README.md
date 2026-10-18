# Pacific Bowmen — Two-Arrow Scorecard v1.3.1

A mobile-friendly, locally stored, installable web app (PWA) for iPhone, iPad and Android. There are **no accounts, database, login or external scoring service**, and no build step.

## Scoring
- 20 rounds per archer, with 2 arrows per round (40 arrows)
- A = 20, B = 18, C = 16, Miss = 0, for either arrow
- Maximum score: **800** per archer
- Add as many archers as needed for the group; each has a separate scorecard and a live leaderboard
- Shoot in fixed archer order: each person scores Arrow 1 then Arrow 2; the app switches to the next archer. After everyone completes their two arrows, it advances to the next round, starting again with the first archer. Undo mistakes or select earlier rounds to correct scores

## What's new in v1.3.1

- **New shoot starts empty:** pressing New shoot clears the entire current archer list, including names, photos and scores. A confirmation warns you to export or back up first. Saved backup files remain unaffected.

- Finishing the final archer's Arrow 2 automatically completes the round and advances to the next round, or ends Round 20 and displays shoot completion.
- Stabilised scoring controls, arrow boxes and correction controls so changing labels and incomplete/complete status do not shift their positions.
- Retains local storage and existing scores; no cloud service.

## Previously in v1.2.0
- **Round-robin shooting order:** Score Archer 1 Arrow 1 and Arrow 2, then Archer 2 Arrow 1 and Arrow 2, etc. When the last archer finishes, the app goes to Round 2 Archer 1. The order stays consistent regardless of scores.
- **Mobile layout rebuilt:** Bigger scoring controls, 2×2 score buttons, legible labels, no page-wide sideways scrolling, compact roster and touch-friendly actions on smaller iPhones and Android phones.
- **Score correction:** Editing a previously scored arrow doesn't jump to a different archer. Undo returns you to the correct archer and arrow even after automatic switching.
- **Resume after reopening:** The app opens at the next unscored arrow instead of returning to an already-scored Arrow 1.
- **Safe upgrade from v1.1:** Keeps the original local storage key and scorecard format. An existing roster, scores and photos on the same device/browser and URL will remain available after updating the site. Back up before changes as a precaution.
- **Offline updates:** Updated the service worker cache version and network-first navigation so a newly deployed app can replace a previously installed one while retaining offline availability.

## Features introduced in v1.1.0
- **Email results:** Select **Email results** in the top bar. On supported iPhone and Android browsers, the device's native **Share** sheet opens with the CSV **file attached**, and the user can select Mail/Gmail to send. The app does **not** send email automatically. The file contains a row for each of the 20 rounds of each archer; the share message includes a quick leaderboard.
- **Fallback when file sharing is unavailable:** A CSV downloads and a `mailto:` email draft opens with the leaderboard. You must **attach the downloaded CSV manually** if you want the round-by-round results in the email. The app clearly advises of this. The email draft might not open on devices without a configured email app; the CSV will still be downloaded.
- **Optional archer headshots:** Select an archer and tap **+ Photo**. You can **Take a photo** with your phone's camera or **Choose photo** from the gallery. Images are scaled down and stored only on this device. They appear in the archer list and on the scorer's screen, and can be replaced or removed. Photos are **excluded** from CSV/email exports.
- **Backup/Restore:** JSON backups **include photos** alongside scores. Restore also accepts version 1.0 scorecards without photos. Please back up after a shoot, especially before clearing browser/app data.
- **Club branding:** Colours and header use Pacific Bowmen's navy/gold theme, and the header loads the club's official logo at https://pacificbowmen.org.au/Sys/Branding/Logo. The logo is requested only on the first online load and cached for subsequent offline use where supported; a local target icon is shown if it's unavailable. No user scores or photos are transmitted to the club site.

## Deploy on HTTPS (required to install as an app)

1. Create an empty GitHub repository (e.g. `pacific-bowmen-score`).
2. Upload the **contents** of this folder (`index.html`, `app.js`, `styles.css`, `sw.js`, manifest and `icons`) to the repository root (or copy them into a static website's root).
3. In GitHub **Settings → Pages**, choose **Deploy from a branch → main / (root)** and Save. It will provide a `https://USERNAME.github.io/pacific-bowmen-score/` URL.
4. Open that HTTPS link once while online on each device.
   - **iPhone:** Open in **Safari**, Share → **Add to Home Screen**.
   - **Android:** Open in **Chrome**, menu → **Install app** or **Add to Home screen**.
5. After the first visit, scoring works offline, even with no reception on the range. Email sharing, of course, needs the selected email app and a connection to send.

Also works with Azure Static Web Apps, Cloudflare Pages, Netlify or any static HTTPS host. It does not require Azure SQL, API functions, or paid services.

## Data handling / privacy / limitations

- Scores and headshots are kept in browser/app **localStorage** for that origin. Headshots are downscaled before being stored, and can be removed. People should consent before having a photo taken or shared.
- Data **does not automatically sync between phones**, and each device has its own roster and scorecard.
- Photos are **included in a JSON backup**, so treat JSON files with appropriate care, especially if they include minors. The CSV/email export deliberately excludes photos.
- Clearing website data, switching browsers, uninstalling, or running the app on a different website/domain can lose access to stored scores. Save a JSON backup to prevent data loss.
- For a local desktop preview, open `index.html`, but rely on an HTTPS site for reliable persistent storage, offline use and mobile file sharing.
- This app is an independent club scorekeeping utility and is not connected to Pacific Bowmen's membership database.

## Updating GitHub Pages

If the repository is already live on GitHub Pages, **do not create a new repository or change Pages settings**. Extract the ZIP and upload the changed `index.html`, `app.js`, `styles.css`, `sw.js`, and `README.md` into the repository root using **Add file → Upload files → Commit changes**. You can re-upload the complete folder contents; unchanged icon and manifest assets are safe to retain. The site address stays the same.

Wait until GitHub's **Actions** page shows the Pages deployment succeeded, then reload the phone app. The previous service worker may require closing the installed app, reopening and reloading a second time to load the updated UI. A small `v1.3.1` label at the page bottom confirms the new version. Do not clear browser/site data just to force an upgrade, or stored scorecards may be lost.

## Version history
- v1.0.0 — original two-arrow scoring, leaderboard, CSV export, backup/restore, installable PWA.
- v1.1.0 — optional photos, local photo storage, emailed CSV via share sheet, branded colours and official logo, privacy notes.

- v1.3.1 — mobile layout rebuild, fixed shooting order across archers, stable roster/ranking, edit and undo handoff, cache update.


## v1.4.1 — On-device Shoot History
- New Shoot automatically snapshots the current active shoot before clearing all archers. If the archive cannot be written (for example due to local storage limits), New Shoot is cancelled.
- Save Shoot stores/updates a historical snapshot; History views results without changing active scoring.
- Files exports JSON using mobile share sheet (Save to Files on iPhone) or downloads when unavailable. Load from Files imports a JSON backup into history without overwriting active scores.
- Restoring a historical shoot for editing requires confirmation and first archives the current shoot.
- The archive exists only inside this particular browser/device; deleting website data may erase it. Export JSON files to Files/iCloud for durable backups. History is not synchronised between the two scorers.

## v1.4.1 — Email subject
- Email results now proposes a shoot-date subject such as `October Club shoot - 18/10/2026`.
- The mailto fallback sets the exact subject. When sharing an attached CSV through the native iOS/Android share sheet, the title is passed to the receiving app, but some mail apps may ignore it; check the subject before sending.

## v1.4.3 — Shoot types and email improvements
- New Shoot now prompts for Club Shoot or Casual Shoot and archives the active shoot before clearing archers.
- Dynamic heading and short date. Shoot type persists in backups and History (legacy shoots default to Club).
- Participants footer shows only Save Shoot, History, Backup and Restore.
- Email Results offers a mailto draft with guaranteed subject but manual CSV attachment, or native Share for automatic attachment with an unreliable subject on iOS mail clients.


## v1.4.3 changes
- Email Results now launches the file-sharing sheet directly with its CSV already attached, with no two-choice popup. iOS email apps may ignore the suggested subject.
- On phones with an existing scorecard, the app initially scrolls to Now Scoring; adding the first archer does likewise. Scoring itself does not trigger automatic scrolling.
- Gentle native scroll snapping near Now Scoring and reduced root overscroll, without locking access to other sections. iOS browser bounce remains partly browser-controlled.

## v1.4.4 — Clear History

- History includes a Clear History button, disabled when empty.
- Confirmation identifies how many archived shoots will be deleted.
- The active shoot and exported JSON backups are unaffected.

## v1.4.5 — Archer entry scrolling

- Adding the first archer no longer scrolls the page down to Now Scoring. You can enter the entire team without the page jumping.
- Retains the existing mobile scroll snapping, overscroll controls, and returning-shoot scoring focus.


## v1.4.6 — Archer add controls cleanup

- Removed the duplicate + button in the Participants header; use the inline Add button.
- Removed the redundant Add an archer button in the empty scoring panel.
- No scoring, history, local storage, or scrolling behaviour changed.
