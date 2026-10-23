// src/services/audioStorage.js
//
// Recitation audio, stored in Firebase Storage.
//
// HISTORY: this used Cloudinary because Firebase Storage requires the
// Blaze plan and the project was on Spark. That constraint is gone, and
// Cloudinary had a real cost: its URLs are public and unauthenticated,
// so anyone holding a link could play a child's recording forever, and
// uploads used an unsigned preset visible in the JS bundle.
//
// WHY A PATH AND NOT A URL: getDownloadURL() returns a tokenised link
// that works for anyone who has it - the same weakness we are leaving
// behind. So only the object PATH is stored, and the audio is fetched
// through the SDK with the caller's own credentials. That is what makes
// storage.rules actually enforce "a student hears only their own
// recordings, a teacher only their school's".
//
// Attempts written before this change still carry a Cloudinary audioUrl.
// The attempts collection is append-only by firestore.rules, so those
// can never be rewritten - the dashboard falls back to that URL when no
// path is present, and both keep working.

import { getStorage, ref, uploadBytes, getBlob } from "firebase/storage";
import app from "../firebase";

const storage = getStorage(app);

/** Extension matching what MediaRecorder produced, so the stored object
 *  carries a sensible content type for playback. iOS Safari records
 *  MP4/AAC; everything else here records WebM/Opus. */
function extensionFor(blob) {
  const type = (blob && blob.type) || "";
  if (type.includes("mp4") || type.includes("aac")) return "mp4";
  if (type.includes("ogg")) return "ogg";
  return "webm";
}

/**
 * Uploads a recitation and returns its STORAGE PATH, or null on failure.
 * Never throws - a failed upload must not break the student's attempt.
 *
 * The path shape is dictated by storage.rules:
 *   attempts/{studentUid}/{fileName}
 * A student may only write under their own uid, so the uid here has to
 * be the signed-in student's.
 *
 * @param {Blob} audio       recording from MediaRecorder
 * @param {string} uid       the student's uid - also the folder name
 * @param {string} name      stable file name without extension
 */
export async function uploadAudio(audio, uid, name) {
  if (!audio || !uid) return null;

  try {
    const blob =
      audio instanceof Blob ? audio : await (await fetch(audio)).blob();

    const path = `attempts/${uid}/${name}.${extensionFor(blob)}`;
    await uploadBytes(ref(storage, path), blob, {
      contentType: blob.type || "audio/webm"
    });
    return path;
  } catch (err) {
    console.error("Audio upload failed:", err);
    return null;
  }
}

/**
 * Fetches a stored recording as an object URL the browser can play.
 *
 * Uses getBlob rather than getDownloadURL deliberately: this request
 * carries the caller's auth, so Storage rules decide whether they are
 * allowed to hear it. A download URL would hand back a link that works
 * for anyone, which is the property this migration exists to remove.
 *
 * The caller owns the returned URL and must revokeObjectURL it.
 */
export async function audioObjectUrl(path) {
  if (!path) return null;
  try {
    const blob = await getBlob(ref(storage, path));
    return URL.createObjectURL(blob);
  } catch (err) {
    // Most often a permission denial - a teacher from another school, or
    // a student opening someone else's attempt. Not worth breaking the
    // page over.
    console.warn("Could not load recording:", err);
    return null;
  }
}
