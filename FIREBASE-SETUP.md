# Enabling server-side speech (Blaze)

`twisterverse-8d5eb` is on the Blaze plan, so the existing project stays as it
is — same project ID, same Auth users, same Firestore data, same hosting URL.
Nothing is migrated. `.env.local` and `.firebaserc` already point at it
correctly and need no changes.

**STATUS: working and verified on a real iPhone, 2026-09-05.** Two Filipino
twisters transcribed at 100% ("bibo bumulong bago bumangon", "popoy pato ay
pumapadyak sa putik", confidence 0.76-0.84), a third at 80%, and the audio for
all three plays back in the Teacher Dashboard. Speech-to-Text API enabled,
`transcribe` running in `asia-southeast1` (Node 22, 2nd gen), Artifact Registry
cleanup at 3 days, `serverTranscription` and `mobileServerTranscription` on,
hosting released to two sites.

Still untested: **a signed-in Android student**, which now takes the same server
path. Steps 1-4 below are done and kept as a record of how.

**Why this work exists:** iOS/Safari and the Facebook/Messenger/Instagram in-app
browsers reject the Web Speech API, so those students currently can't play at
all. Server-side transcription is the only fix, and it needs a Cloud Function,
which is why Blaze was needed.

---

## 1. Enable the Speech-to-Text API

This one lives in the Google Cloud console, not Firebase:

<https://console.cloud.google.com/apis/library/speech.googleapis.com?project=twisterverse-8d5eb>

Click **Enable**. The function will deploy fine without this and then fail at
runtime, so don't skip it.

## 2. Set a budget alert

This is the first thing in the app that costs money per use, so do this before
deploying.

Google Cloud console > Billing > Budgets & alerts > Create budget. Something
small (₱500 / $10), alerts at 50/90/100%.

Know what a budget alert is and isn't: it **emails you, it does not stop
spending**. There is no hard spend cap in Google Cloud. The real protections are
built into `functions/index.js` — sign-in required, a 4 MB payload cap, and
`maxInstances: 10`.

Cost scales with mobile use. Speech-to-Text gives 60 minutes free per month,
then about $0.016/min; Cloud Functions gives 2M invocations free.

Since `FEATURES.mobileServerTranscription` was turned on, **every attempt from a
phone calls Speech-to-Text** - that is what buys Android audio recordings. The
free tier covers roughly 400-700 recitations a month depending on length; past
that a 10-second attempt costs about $0.003, so ~1,000 extra attempts is a few
dollars. Desktop attempts stay free: they never call the API.

## 3. Deploy the function

Dependencies are already installed in `functions/`. From `twisterverse-client/`:

```bash
firebase deploy --only functions
```

First 2nd-gen deploy takes a few minutes and will ask to enable Cloud Functions,
Cloud Build, Artifact Registry and Eventarc — say yes. (`firebase functions:list`
failing before this point is expected; the API isn't on yet.)

## 4. Turn the feature on

In `src/config.js`:

```js
serverTranscription: true,
```

Then:

```bash
npm run build && firebase deploy --only hosting
```

iOS and in-app browsers now record audio and send it to the function instead of
showing "not yet supported".

Leave `mobileAudioRecording: false`. That flag is about Android's Web Speech API
fighting `getUserMedia` for the microphone — unrelated to this change, and the
test results are in the `src/config.js` comment. Once server transcription is
proven, moving Android to the server path too is a separate, deliberate change.

## Test results (2026-09-05, synthetic audio)

The pipeline was tested end to end against the deployed function using a
throwaway auth account (created and deleted; no residue in Auth) and
TTS-generated audio.

**Working:** `chirp_2` does serve `fil-PH` from `asia-southeast1`, v2
auto-decoding read the audio, round trip ~1.0-1.5s, callable returns a real
transcript.

**Phrase hints measurably help.** Identical audio, hints on vs off:

| hints | transcript |
| --- | --- |
| on  | `bibo` give me a long bag of `bumangon` |
| off | `bebo` give me a long bag of `boom again` |

Both corrections moved toward the real target words. Keep the adaptation.

**The recognizer hallucinates on non-speech, confidently.** This was the
significant find:

| input | confidence | transcript |
| --- | --- | --- |
| 1s digital silence | 0.08 | `bibi` |
| 3s quiet noise | 0.59 | `bibo bibo` |
| 3s 200Hz hum | 0.70 | `0 1 2 3 4 5 6 7 8 9 10` |
| real speech | 0.71 | `bibo give me a long bag of bumangon` |

Two consequences. First, **a confidence threshold cannot filter this** - 0.70
non-speech against 0.71 speech leaves no separating value, so don't try it.
Second, the hallucinations are biased toward the phrase hints, so silence from
an iOS student would have been scored as a wrong recitation and logged as a
failed attempt - losing the deliberate "mic failure is not a failed attempt"
behaviour in `finishAttempt`. Fixed by screening silence on the client before
sending: `hasAudibleAudio` in `src/services/speechService.js`.

**Scoring is robust.** `src/utils/speechScoring.js` was checked against the
real transcripts: v/b and o/u drift, and word-boundary splits, all still score
100%; genuinely wrong recitations score 0%. Hallucinated fragments like `bibo`
score 25% and fail, so no student can pass by staying silent.

**Not tested, and it matters:** a real Filipino child's voice. Every result
above used a robotic en-US voice reading Tagalog, which is close to worst-case
input and says nothing reliable about real-world accuracy. That is what step 5
is for.

## 5. Verify

- [ ] Desktop Chrome still completes a twister (browser speech, untouched)
- [ ] **An iPhone completes a twister** — this is the whole point
- [x] `firebase functions:log --only transcribe` shows the call
- [ ] Teacher dashboard shows the attempt
- [ ] Cloud console > Billing shows near-zero spend after a few days

---

## Firestore rules — read before deploying them

`firebase deploy --only firestore:rules` **overwrites whatever is live** with
`firestore.rules` from this repo. Only Hosting has ever been deployed from here,
so the live rules may have been edited directly in the console and may not match
this file.

Compare them first: Firebase console > Firestore Database > Rules. If they
match, deploy freely. If they don't, reconcile before deploying — a mismatch
either locks students out or opens data up, and neither is obvious afterwards.

Nothing in this speech work requires a rules deploy. Leave it alone if in doubt.

## Hosting caching - don't remove the headers block

Firebase Hosting's default is `Cache-Control: max-age=3600` on **everything**,
including `index.html`. Since `index.html` is what names the content-hashed JS
bundle, a cached copy pins a device to an old build for up to an hour. This
caused real confusion during testing: a phone kept running two-deploys-old code
while the server had the new one, and the symptoms looked like application bugs.

`firebase.json` now sets:

- `**` -> `no-cache, max-age=0, must-revalidate`
- `/static/**` -> `public, max-age=31536000, immutable` (safe: the build
  content-hashes these filenames)

Order matters and is easy to get backwards: Firebase applies header rules in
order with the **last match winning**, so the broad rule goes first and
`/static/**` overrides it afterwards. Putting the catch-all last silently makes
every asset uncacheable.

To confirm after a deploy:

```bash
curl -sI https://playtwisterverse.web.app/ | grep -i cache-control
```

## Hosting: two sites, one build

`firebase.json` deploys the same `build/` to two Hosting sites, so
`firebase deploy --only hosting` keeps both in sync:

- **https://playtwisterverse.web.app** - the one to share
- https://twisterverse-8d5eb.web.app - the original default, kept alive so
  links shared before the rename don't break

Plain `twisterverse` was unavailable (reserved by an unrelated project).
Adding extra Hosting sites requires Blaze, so this only became possible with
the plan upgrade.

Note that a name being unclaimed can't be confirmed by loading it - an
unclaimed site and a claimed-but-never-deployed one both return the same 404.
`firebase hosting:sites:create <name>` is the only real test.

Auth is unaffected: the app uses email/password, and Firebase's authorized-
domains list only gates OAuth and email-link sign-in, neither of which this
app uses.

## Cloud Storage is not set up, deliberately

`firebase.json` has no `storage` block. The project has no Storage bucket and no
default resource location, so deploying storage rules would fail — and the app
doesn't need it, because recitation audio goes to Cloudinary
(`src/services/audioStorage.js`).

`storage.rules` stays in the repo, unused and ready. To adopt Firebase Storage
later: create the bucket in the console, then add back:

```json
"storage": { "rules": "storage.rules" },
```

---

## Things worth knowing

**Region has to match in two places.** `REGION` in `functions/index.js` and
`FUNCTIONS_REGION` in `src/services/speechService.js`, both `asia-southeast1`.
The Functions SDK defaults to `us-central1`, so a mismatch appears as a CORS or
404 error that says nothing about regions.

**The recognition model is the most likely thing to need adjusting.**
`functions/index.js` uses `chirp_2` for its Filipino coverage, but model
availability varies by language *and* region and Google changes it over time. If
the first real call errors on model or language, check what's offered for
`fil-PH` in `asia-southeast1` in the Cloud console — it's a one-constant fix, not
a code bug.

**Speech-to-Text v2, not v1, is deliberate.** iOS Safari records MP4/AAC, which
v1 cannot decode at all. v2's auto-decoding handles iOS MP4 and Android
WEBM/Opus through one path. Don't "simplify" it back to v1.

**App Check is the next hardening step.** `transcribe` requires sign-in, but a
signed-in student could still call it in a loop. Once reCAPTCHA Enterprise is
registered and App Check is initialized on the client, set
`ENFORCE_APP_CHECK = true` in `functions/index.js`. In that order — reversed, it
locks out every real user.

---

## Appendix: moving to a different Firebase project

Not needed now, kept in case it ever is. `scripts/migrate-firestore.js` copies
the `users`, `progress`, `teachers` and `attempts` collections between projects,
preserving document IDs.

**Auth users must be imported before Firestore** — the profile documents are
keyed by Auth UID, and importing the other way orphans every one of them.

```bash
firebase auth:export users.json --format=json --project twisterverse-8d5eb
```

Passwords only survive if the old project's SCRYPT parameters are passed
explicitly (Authentication > Users > three-dot menu > **Password hash
parameters**):

```bash
firebase auth:import users.json --hash-algo=SCRYPT --hash-key <base64_signer_key> --salt-separator <base64_salt_separator> --rounds <rounds> --mem-cost <mem_cost> --project <new-project-id>
```

Without those flags every account arrives with an unusable password — and since
logins map usernames to fake domains, there is no email reset path.

Then, with `firebase-admin` installed (`npm install --no-save firebase-admin`)
and a service-account key per project:

```bash
node scripts/migrate-firestore.js export --key old-serviceaccount.json
```

```bash
node scripts/migrate-firestore.js import --key new-serviceaccount.json --dry-run
```

Drop `--dry-run` once the counts look right. Delete the key files afterwards —
they are full-access credentials that bypass `firestore.rules` entirely.
