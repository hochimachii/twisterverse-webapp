// functions/index.js
//
// The `transcribe` callable — server-side speech-to-text for platforms
// the browser's Web Speech API refuses to serve (iOS/Safari and the
// Facebook/Messenger/Instagram in-app WebViews). See
// src/services/speechService.js for the client half and the decision of
// when this gets called at all.
//
// WHY SPEECH-TO-TEXT V2 AND NOT V1: iOS Safari's MediaRecorder produces
// MP4/AAC audio. The v1 API's encoding list doesn't include AAC at all
// (LINEAR16, FLAC, MULAW, AMR, OGG_OPUS, WEBM_OPUS, MP3...), so v1
// physically cannot read the recordings from the exact platform this
// function exists to support. V2's auto-decoding handles M4A/MP4 audio
// alongside WEBM/OGG Opus, so one code path covers both iOS and the
// Android/desktop fallback case.
//
// COST: this is the only thing in the app that spends money per use.
// Guards, in order of importance:
//   1. Sign-in required — no anonymous callers.
//   2. Hard cap on payload size (a five-second clip is ~15-40 KB).
//   3. maxInstances caps how much can be burned concurrently.
// Consider also enabling App Check once you've registered reCAPTCHA —
// see ENFORCE_APP_CHECK below.

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const speech = require("@google-cloud/speech");

// Region for BOTH the function and the Speech API. Keep them the same:
// the audio travels function -> Speech, so co-locating avoids a
// cross-continent hop on every attempt. asia-southeast1 (Singapore) is
// the closest region to the Philippines.
//
// IMPORTANT: the client must ask for this same region. See
// getFunctions(app, FUNCTIONS_REGION) in src/services/speechService.js —
// the SDK defaults to us-central1 and will 404 if the two disagree.
const REGION = "asia-southeast1";

// Recognition model. Availability varies by model, language AND region,
// and Google changes the matrix over time — verify yours under
// Speech-to-Text in the Cloud console before assuming a failure is a bug
// in this file. "chirp_2" has the broadest language coverage (Filipino
// included); "short" is a cheaper, lower-latency option where offered.
const MODEL = "chirp_2";

const LANGUAGE = "fil-PH";

// Roughly 4 MB of base64 — vastly more than a five-second clip needs,
// while staying under the v2 sync-recognize inline limit (10 MB / 60s).
const MAX_AUDIO_BYTES = 4 * 1024 * 1024;

// Flip to true after registering an App Check provider (reCAPTCHA
// Enterprise for web) AND shipping a client that initializes App Check.
// Turning it on before both are done locks out every real user.
const ENFORCE_APP_CHECK = false;

setGlobalOptions({
  region: REGION,
  maxInstances: 10,
  memory: "512MiB",
  timeoutSeconds: 60
});

// Regional endpoint is required for v2 outside the global location.
// Constructed once at cold start and reused across warm invocations.
const client = new speech.v2.SpeechClient({
  apiEndpoint: `${REGION}-speech.googleapis.com`
});

let cachedRecognizerPath = null;
async function recognizerPath() {
  if (!cachedRecognizerPath) {
    const projectId = await client.getProjectId();
    // "_" is the inline recognizer: config travels with the request, so
    // there's no recognizer resource to create or keep in sync.
    cachedRecognizerPath = `projects/${projectId}/locations/${REGION}/recognizers/_`;
  }
  return cachedRecognizerPath;
}

/**
 * Strips a data: URL wrapper down to bare base64.
 *
 * The client sends FileReader.readAsDataURL output, which looks like
 * "data:audio/webm;codecs=opus;base64,<payload>". Everything before the
 * comma is metadata the Speech API neither needs nor accepts — and the
 * ";codecs=opus" parameter in particular has already caused trouble
 * elsewhere in this app (see the Cloudinary note in audioStorage.js).
 */
function toBareBase64(input) {
  const comma = input.indexOf(",");
  return input.startsWith("data:") && comma !== -1
    ? input.slice(comma + 1)
    : input;
}

exports.transcribe = onCall(
  { enforceAppCheck: ENFORCE_APP_CHECK },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError(
        "unauthenticated",
        "Kailangan mong maka-login bago gamitin ito."
      );
    }

    const { audioBase64, phrases } = request.data || {};

    if (typeof audioBase64 !== "string" || audioBase64.length === 0) {
      throw new HttpsError("invalid-argument", "Walang natanggap na audio.");
    }

    const content = toBareBase64(audioBase64);

    // base64 is 4 chars per 3 bytes; compare on the encoded length so we
    // reject before allocating a decoded buffer.
    if (content.length > MAX_AUDIO_BYTES) {
      throw new HttpsError(
        "invalid-argument",
        "Masyadong mahaba ang recording."
      );
    }

    // The app always knows what the student is SUPPOSED to say, so the
    // target words go in as recognition hints. This measurably improves
    // Filipino accuracy — without them the recognizer tends to snap
    // unfamiliar twister words toward common English ones.
    const adaptation =
      Array.isArray(phrases) && phrases.length
        ? {
            phraseSets: [
              {
                inlinePhraseSet: {
                  phrases: phrases
                    .filter((p) => typeof p === "string" && p.trim())
                    .slice(0, 500) // API caps the phrase count
                    .map((value) => ({ value, boost: 15 }))
                }
              }
            ]
          }
        : undefined;

    try {
      const [response] = await client.recognize({
        recognizer: await recognizerPath(),
        // Let the service read the container/codec from the audio header.
        // This is the whole reason for v2 — it is what makes iOS's
        // MP4/AAC and Android's WEBM_OPUS work through one code path.
        // (The client still sends an `encoding` hint; v2 doesn't need it,
        // and ignoring it means one less thing to keep in sync.)
        config: {
          autoDecodingConfig: {},
          model: MODEL,
          languageCodes: [LANGUAGE],
          features: { enableAutomaticPunctuation: false },
          adaptation
        },
        content
      });

      // Results arrive per utterance; a short recitation is usually one,
      // but joining is correct if the student pauses mid-sentence.
      const results = response.results || [];
      const transcript = results
        .map((r) => r.alternatives?.[0]?.transcript || "")
        .join(" ")
        .trim();

      // DON'T add a confidence threshold here to filter out silence.
      // It was measured and it does not work: non-speech inputs scored
      // up to 0.70 confidence (three seconds of 200Hz hum transcribed
      // as "0 1 2 3 4 5 6 7 8 9 10") against real speech at 0.71. There
      // is no separating value. Silence is screened on the client
      // instead, before the audio is ever sent - see hasAudibleAudio in
      // src/services/speechService.js.
      const confidence = results
        .map((r) => r.alternatives?.[0]?.confidence)
        .find((c) => typeof c === "number");

      console.log(
        `transcribe: results=${results.length} confidence=${confidence} ` +
          `transcript=${JSON.stringify(transcript)}`
      );

      return { transcript };
    } catch (err) {
      // Log the real cause for us, return something the student can read.
      console.error("Speech-to-Text failed:", err);
      throw new HttpsError(
        "internal",
        "Hindi ma-proseso ang boses. Subukan ulit."
      );
    }
  }
);
