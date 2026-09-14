// src/services/speechService.js
//
// Decides which speech engine to use, and why.
//
// The browser's Web Speech API is free and instant, and works well on
// Android Chrome and desktop — so it stays the default there. It does
// NOT work on iOS/Safari or inside in-app WebViews (Messenger,
// Facebook, Instagram), which reject it immediately with
// "service-not-allowed". Those platforms fall back to recording audio
// and sending it to the `transcribe` Cloud Function instead.

import { getFunctions, httpsCallable } from "firebase/functions";
import app from "../firebase";
import { FEATURES } from "../config";

// MUST match the REGION constant in functions/index.js. The Functions
// SDK defaults to us-central1, so omitting this silently calls a URL
// where nothing is deployed and fails as a CORS/404 error.
const FUNCTIONS_REGION = "asia-southeast1";

export function isIOS() {
  // iPadOS 13+ reports a Mac-like UA, so check touch support too.
  return (
    /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/** Facebook/Messenger/Instagram in-app browsers, which block the
 *  Web Speech API the same way iOS does. */
export function isInAppBrowser() {
  return /FBAN|FBAV|FB_IAB|Instagram|Line\/|Twitter/i.test(navigator.userAgent);
}

/** True when this platform CAN'T use the browser's Web Speech API. */
export function platformLacksBrowserSpeech() {
  return isIOS() || isInAppBrowser();
}

/** Phones and tablets, including iPadOS's Mac-like user agent. */
export function isMobileDevice() {
  return (
    /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    (/Macintosh/i.test(navigator.userAgent) && navigator.maxTouchPoints > 1)
  );
}

/** True when we should record + upload for server-side transcription.
 *  Always requires the Cloud Function to be deployed (Blaze plan) — on
 *  Spark this stays false and the UI shows an honest "not yet supported"
 *  message instead of failing with a misleading network error.
 *
 *  Two reasons to take the server path:
 *    1. The platform CAN'T use the Web Speech API (iOS, in-app browsers).
 *    2. The platform can, but we want the recording anyway — Android
 *       can't do both at once, so grading moves to the server to free
 *       the microphone. See FEATURES.mobileServerTranscription. */
export function needsServerTranscription() {
  if (!FEATURES.serverTranscription) return false;
  if (platformLacksBrowserSpeech()) return true;
  return isMobileDevice() && FEATURES.mobileServerTranscription;
}

/** True when the platform can't do speech at all right now. */
export function speechUnavailableOnPlatform() {
  return platformLacksBrowserSpeech() && !FEATURES.serverTranscription;
}

/** Picks a MediaRecorder mimeType the current browser actually supports,
 *  and reports the matching encoding for Google Cloud Speech. */
export function pickRecordingFormat() {
  const candidates = [
    { mimeType: "audio/webm;codecs=opus", encoding: "WEBM_OPUS" },
    { mimeType: "audio/webm", encoding: "WEBM_OPUS" },
    { mimeType: "audio/ogg;codecs=opus", encoding: "OGG_OPUS" },
    // iOS Safari records MP4/AAC; Google Cloud handles it without an
    // explicit encoding hint, so we leave encoding undefined and let
    // the service auto-detect.
    { mimeType: "audio/mp4", encoding: undefined }
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c.mimeType)) {
      return c;
    }
  }
  return { mimeType: "", encoding: undefined };
}

/**
 * True when a recording contains enough signal to plausibly be speech.
 *
 * WHY THIS EXISTS: the recognizer does not return "nothing" for silence
 * - it hallucinates, confidently. Measured against the deployed
 * function: one second of digital silence came back as "bibi", and
 * three seconds of noise as "bibo bibo" (the phrase hints bias the
 * hallucination toward the target words). Confidence does not help
 * either - non-speech scored up to 0.70 against real speech at 0.71, so
 * there is no threshold that separates them.
 *
 * Left unchecked, a student whose mic is muted gets scored as a WRONG
 * recitation and has a failed attempt logged against them. Returning an
 * empty transcript instead routes to finishAttempt's "Walang narinig na
 * boses" branch, which is explicitly not logged as a failure. It also
 * avoids paying for a transcription of silence.
 *
 * Thresholds are deliberately tight - they catch "no signal at all"
 * (a muted mic reads exactly 0.0), not "quiet". Measured reference
 * points: speech peaks at ~0.95 / RMS ~0.096; room-level noise sits
 * around peak 0.018 / RMS 0.011 and is intentionally let through, since
 * it can't be told apart from a very softly spoken child without
 * risking false rejections.
 *
 * Anything that can't be decoded is let through - failing open keeps a
 * decoder quirk from blocking gameplay.
 */
export async function hasAudibleAudio(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx || !blob || !blob.size) return true;

  let ctx;
  try {
    ctx = new Ctx();
    const buffer = await ctx.decodeAudioData(await blob.arrayBuffer());
    const samples = buffer.getChannelData(0);

    let peak = 0;
    let sumSquares = 0;
    for (let i = 0; i < samples.length; i++) {
      const amplitude = Math.abs(samples[i]);
      if (amplitude > peak) peak = amplitude;
      sumSquares += samples[i] * samples[i];
    }
    const rms = Math.sqrt(sumSquares / (samples.length || 1));

    return peak >= 0.01 || rms >= 0.002;
  } catch (err) {
    console.warn("Could not inspect recording for silence:", err);
    return true;
  } finally {
    if (ctx && ctx.state !== "closed") ctx.close();
  }
}

/**
 * Sends recorded audio to the Cloud Function for transcription.
 * @param {string} audioBase64 data: URL or bare base64
 * @param {string|undefined} encoding e.g. "WEBM_OPUS"
 * @param {string[]} phrases the target sentence's words, as recognition
 *        hints — the app always knows what the student is *supposed* to
 *        say, which measurably improves accuracy for Filipino.
 */
export async function transcribeOnServer(audioBase64, encoding, phrases = []) {
  const functionsInstance = getFunctions(app, FUNCTIONS_REGION);
  const transcribe = httpsCallable(functionsInstance, "transcribe");
  const result = await transcribe({ audioBase64, encoding, phrases });
  return (result && result.data && result.data.transcript) || "";
}
