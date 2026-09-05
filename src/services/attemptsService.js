// src/services/attemptsService.js
//
// Attempt metadata lives in Firestore; the audio itself goes to
// Cloudinary (see audioStorage.js), because Firebase Storage requires
// the paid Blaze plan. Attempts are visible to a teacher on a
// completely different device, which is the whole point.
//
// Guest attempts are never logged, consistent with guests not having
// persistent progress either.

import { collection, addDoc, getDocs, query, where, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase";
import { uploadAudio } from "./audioStorage";
import { FEATURES } from "../config";

/**
 * Logs one attempt. `audioDataUrl` accepts a Blob from MediaRecorder
 * or a base64 data URL; it is uploaded to Cloudinary and only the
 * resulting URL is stored in Firestore, so raw audio never lives in
 * the database. It may be null when recording wasn't available.
 */
export async function logAttempt({
  uid,
  username,
  world,
  level,
  twister,
  transcript,
  similarity,
  tier,
  points,
  audioDataUrl
}) {
  if (!uid) {
    // Guests have no account, so nothing is logged for them — including
    // recordings. If audio seems to be "missing", check you're signed in
    // as a real student rather than using Continue as Guest.
    console.log("[audio] guest session — attempt not logged");
    return;
  }

  let audioUrl = null;
  // Audio goes to Cloudinary (no backend needed, works on Firebase's
  // free Spark plan). A failed upload never blocks the attempt from
  // being logged — the transcript and score are the important part.
  if (audioDataUrl && FEATURES.audioRecordingUpload) {
    const publicId = `twisterverse/${uid}_w${world}_l${level}_${Date.now()}`;
    audioUrl = await uploadAudio(audioDataUrl, publicId);
    console.log("[audio] upload result:", audioUrl || "FAILED (see error above)");
  } else {
    console.log(
      "[audio] skipped upload — hasAudio:", Boolean(audioDataUrl),
      "uploadEnabled:", FEATURES.audioRecordingUpload
    );
  }

  await addDoc(collection(db, "attempts"), {
    uid,
    username,
    world,
    level,
    twister,
    transcript,
    similarity,
    tier,
    // TwisterActivity has always passed this; it was simply never
    // destructured above, so every attempt was stored without its score.
    // Older records have no points field - treat missing as unknown
    // rather than zero when reading them back.
    points: typeof points === "number" ? points : null,
    audioUrl,
    timestamp: serverTimestamp()
  });
}

/** Every attempt across every student — used by the Teacher Dashboard's
 *  student list to compute summaries. Requires a teacher-role account
 *  per firestore.rules. */
export async function getAllAttempts() {
  const snap = await getDocs(collection(db, "attempts"));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

/** One student's attempts, newest first. */
export async function getAttemptsForStudent(uid) {
  const q = query(collection(db, "attempts"), where("uid", "==", uid));
  const snap = await getDocs(q);
  const attempts = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  return attempts.sort((a, b) => {
    const at = a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
    const bt = b.timestamp?.toMillis ? b.timestamp.toMillis() : 0;
    return bt - at;
  });
}
