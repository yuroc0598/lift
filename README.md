# Lift

Lift is a private, offline-first powerlifting log built for one person and optimized for an iPhone home screen. It has no account, analytics, ads, or server-side workout storage.

## Program library

- Personal Powerlifting: 5×5 primary barbell work, 3×5 deadlifts, accessories, paused work, and alternating feet-up/incline bench
- Classic 5×5: alternating full-body linear progression
- Texas Method: volume, recovery, and intensity days with alternating press emphasis
- Madcow 5×5: ramped work, a light middle day, and Friday triples/back-offs
- 5/3/1 Rolling: percentage-based 5s, 3s, 5/3/1, and deload waves that continue across three weekly sessions
- Custom builder: add workout days, choose exercises, and edit sets and rep ranges

Plans keep separate progression weights and cycle positions. Switching plans never removes workout history.

## Progression

- Successful fixed-rep lifts add 5 lb. Two consecutive misses cause a rounded 7.5% deload.
- Rep-range exercises add weight only after every set reaches the top of its range at or below target RPE.
- 5/3/1 training maxes increase by 10 lb for squat/deadlift and 5 lb for bench/press after a full wave.

## Data

Workout state and history are stored locally in IndexedDB. Every in-progress change is autosaved, with a synchronous local recovery draft protecting the active workout if iOS closes the app before an IndexedDB write finishes. Reopening Lift restores the session, completed sets, edited values, notes, and rest timer at the next incomplete set.

Settings provides two portable formats. Full app backup is a validated JSON file containing history, program progression, custom programs, settings, and any in-progress workout; use it to restore everything after reinstalling. CSV remains a history-only export for spreadsheets and analysis. Removing the app or clearing Safari website data can remove both browser stores, so save a full backup periodically to Files or iCloud Drive.

Barbell workouts include editable, checkable warm-up sets. Completed warm-ups are saved in history and CSV exports and are included in the post-workout total-volume summary. For pull-ups, dips, knee raises, and other bodyweight movements, volume includes bodyweight plus any added load.

## Development

```sh
npm install
npm run dev
npm run phone
npm test
npm run build
npm run test:e2e
```

The production site is generated in `dist/`.

### Test directly on an iPhone

Connect the Mac and iPhone to the same Wi-Fi network, then run:

```sh
npm run phone
```

Vite prints a `Network` address such as `http://10.0.0.138:4173`. Open that address in iPhone Safari. Keep the terminal running while testing; press Control-C when finished. This tests the complete interface and local tracking. Because a LAN address uses HTTP, installation and offline caching still require the HTTPS deployment described below.

## Install on iPhone

The production files must be served over HTTPS. A static host such as Cloudflare Pages or Netlify is sufficient:

1. Configure `npm run build` as the build command and `dist` as the output directory.
2. Open the resulting HTTPS address in Safari on the iPhone.
3. Tap **Share**, then **Add to Home Screen**.
4. Open Lift once while online so its offline files are cached.

All subsequent workout data remains on that iPhone. Hosting serves only the application files.

## Verification

Unit and DOM integration tests cover plan switching, custom-plan creation, program cycles, progression and deload rules, plate and warm-up calculations, IndexedDB migration/persistence, and CSV round trips. Playwright uses iPhone WebKit for the mobile workflow and production builds for reload persistence, complete program rotation, plan switching, CSV download, and offline loading.
