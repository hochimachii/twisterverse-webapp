// src/services/audioStorage.js
//
// Uploads recitation audio to Cloudinary so teachers can play it back.
//
// WHY NOT FIREBASE STORAGE: it requires the paid Blaze plan.
// WHY NOT GOOGLE DRIVE: Drive's API can't accept anonymous uploads. To
//   write into a shared account you need OAuth credentials, and a client
//   secret can't live in browser code — that requires a backend, which
//   is the Blaze dependency we're avoiding. Having each student sign in
//   with their own Google account is poor UX for young learners.
// WHY CLOUDINARY: unsigned upload presets are designed for uploading
//   straight from the browser with no server and no secret. The free
//   tier (25 credits/month, 1 credit = 1GB) covers roughly 600,000
//   five-second clips.
//
// SETUP (one time, ~2 minutes):
//   1. Create a free account at cloudinary.com
//   2. Console > Settings > Upload > Upload presets > Add upload preset
//   3. Set Signing Mode to "Unsigned"
//   4. Set the folder to e.g. "twisterverse"
//   5. Copy the Cloud name (dashboard) and the preset name into
//      src/config.js
//
// SECURITY NOTE: an unsigned preset means anyone who reads your
// JavaScript can find the cloud name and preset and upload files to
// your account. Cloudinary limits the damage (uploads can't overwrite
// existing assets), and you can restrict allowed formats and max file
// size in the preset itself — worth setting both to audio-only and a
// small size cap. This is an accepted trade-off for having no backend;
// if it ever becomes a problem, the fix is signed uploads via a server.

import { CLOUDINARY } from "../config";

/**
 * Uploads a recording and returns its playable URL, or null on failure.
 * Never throws — a failed upload must not break the student's attempt.
 *
 * Accepts either a Blob (preferred) or a base64 data: URL.
 *
 * NOTE ON DATA URLS: MediaRecorder produces MIME types like
 * "audio/webm;codecs=opus", which makes FileReader emit
 * "data:audio/webm;codecs=opus;base64,...". Cloudinary rejects that
 * with "Unsupported source URL" because of the extra codecs parameter,
 * so any data URL is normalized down to a bare "data:<type>;base64,"
 * before sending. Passing a Blob avoids the issue altogether and is
 * about a third smaller on the wire, so that's the preferred path.
 *
 * @param {Blob|string} audio  recording Blob, or a base64 data: URL
 * @param {string} publicId    stable id, e.g. "uid_world1_level3_timestamp"
 */
export async function uploadAudio(audio, publicId) {
  if (!CLOUDINARY.cloudName || !CLOUDINARY.uploadPreset) {
    console.warn("Cloudinary not configured — skipping audio upload.");
    return null;
  }
  if (!audio) return null;

  try {
    let filePart;
    if (typeof audio === "string") {
      // Strip any MIME parameters (e.g. ";codecs=opus") that Cloudinary
      // can't parse, keeping only "data:<type>;base64,<payload>".
      const match = audio.match(/^data:([^;,]+)[^,]*?,(.*)$/s);
      filePart = match ? `data:${match[1]};base64,${match[2]}` : audio;
    } else {
      // Blob — send as a real file upload.
      const ext = (audio.type || "").includes("mp4") ? "mp4" : "webm";
      filePart = new File([audio], `${publicId || "recording"}.${ext}`, {
        type: (audio.type || "audio/webm").split(";")[0]
      });
    }

    const form = new FormData();
    form.append("file", filePart);
    form.append("upload_preset", CLOUDINARY.uploadPreset);
    if (publicId) form.append("public_id", publicId);

    // "video" is correct for audio too — Cloudinary handles audio under
    // its video resource type.
    const endpoint = `https://api.cloudinary.com/v1_1/${CLOUDINARY.cloudName}/video/upload`;

    const res = await fetch(endpoint, { method: "POST", body: form });
    if (!res.ok) {
      const detail = await res.text();
      console.error("Cloudinary upload failed:", res.status, detail);
      return null;
    }
    const data = await res.json();
    return data.secure_url || null;
  } catch (err) {
    console.error("Cloudinary upload error:", err);
    return null;
  }
}
