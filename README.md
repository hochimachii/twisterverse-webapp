# Twisterverse

A Filipino tongue-twister diction game for Grade 7 students. Students travel
through four story worlds, listen to a recorded reading of each tongue
twister, then recite it; the app checks the recitation word by word and
awards points. Teachers follow each student's progress, listen to their
recordings and export the results for grading.

**Live:** https://playtwisterverse.web.app

## Features

- **Four worlds, 80 tongue twisters** (Mundo 1 to 4, 20 levels each), each
  with its own guide character, plus keys, ranks and a closing cinematic.
- **Listen first, then recite.** Each level plays a recorded model reading
  before the student speaks.
- **Speech recognition on every device.** Phones, tablets and in-app
  browsers (Messenger, Facebook) send the recording to Google Cloud
  Speech-to-Text (the Chirp 2 model, in Filipino) through a Cloud Function.
  Desktop Chrome uses the browser's built-in recognition.
- **Fair, predictable scoring.** Sound-alike spellings count as the same,
  small slips inside long words are forgiven, and every word counts. A
  silence check stops background noise from being scored. Each line's time
  limit grows with its length.
- **Teacher Dashboard.** Students by school, grade and section; every
  attempt with what the app heard and the recording; CSV exports; password
  resets. New teacher accounts wait for the administrator's approval, and
  the administrator can delete a student.
- **Background music** with an on/off switch on every screen.
- The interface is in Filipino.

## Built with

- React 19 (Create React App) and React Router 7
- Firebase: Authentication, Cloud Firestore, Cloud Storage, Hosting, and
  Cloud Functions (2nd gen, Node 22, `asia-southeast1`)
- Google Cloud Speech-to-Text v2

## Project layout

| Path | What is there |
|---|---|
| `src/pages/` | One component per screen: login, profile, story scenes, dashboard, map, activity, Teacher Dashboard |
| `src/components/` | Shared pieces: music player and toggle, tutorial, teacher approvals |
| `src/services/` | Everything that talks to Firebase: accounts, progress, attempts, speech, recordings |
| `src/utils/` | Scoring, recitation comparison, time limits, CSV export |
| `src/data/` | The worlds and tongue twisters, schools and sections, avatars, recorded readings |
| `functions/` | Cloud Functions: `transcribe`, `resetStudentPassword`, `deleteStudent` |
| `firestore.rules`, `storage.rules` | Security rules for the database and recordings |
| `FIREBASE-SETUP.md` | Firebase project setup, deployment notes and the reasons behind them |

## Running locally

Requires Node.js and access to a Firebase project.

```bash
npm install
cp .env.example .env.local   # then fill in the Firebase web config
npm start                    # http://localhost:3000
```

The app talks to whichever Firebase project `.env.local` points at; there
is no emulator setup. Server-side speech recognition also needs the
`transcribe` function deployed to that project.

To build for production:

```bash
npm run build
```

## Deploying

Deployment uses the Firebase CLI. **Read `FIREBASE-SETUP.md` before
deploying rules or functions**: it covers the Blaze plan, the
Speech-to-Text API, the required IAM grants, and why the live rules must be
compared with the repository first.

```bash
npm run build && firebase deploy --only hosting   # the website (both hosting sites)
firebase deploy --only firestore:rules,storage    # security rules
firebase deploy --only functions:transcribe       # one function at a time
```

## License

MIT. See [LICENSE](LICENSE).
