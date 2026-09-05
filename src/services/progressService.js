// src/services/progressService.js
//
// Per-student progress in Firestore at progress/{uid}.
//
// The sessionStorage path below is a defensive fallback for the brief
// window before a uid is known - it is NOT a feature. Guest mode was
// removed at the client's request, so in practice every caller has a
// uid and progress always lands in Firestore.
//
// Shape: { world1: { levels: [1,2,3], points: { "1": 150, "2": 120 } } }
// Older shape ({ world1: [1,2,3] }) is still read correctly — see
// normalizeWorld() — so existing saved progress isn't lost.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const LOCAL_KEY = "progress";

function readLocalProgress() {
  try {
    return JSON.parse(sessionStorage.getItem(LOCAL_KEY)) || {};
  } catch {
    return {};
  }
}

function writeLocalProgress(data) {
  sessionStorage.setItem(LOCAL_KEY, JSON.stringify(data));
}

/** Accepts either the old array shape or the new object shape. */
function normalizeWorld(value) {
  if (Array.isArray(value)) return { levels: value, points: {} };
  if (value && typeof value === "object") {
    return { levels: value.levels || [], points: value.points || {} };
  }
  return { levels: [], points: {} };
}

export async function loadProgress(uid) {
  const raw = !uid
    ? readLocalProgress()
    : (await getDoc(doc(db, "progress", uid))).data() || {};

  const out = {};
  Object.keys(raw).forEach((key) => {
    // Only world entries get normalized. Anything else on the document
    // is metadata (endingSeen) and has to pass through untouched:
    // normalizeWorld would turn it into an empty world object, and
    // markLevelComplete writes this whole object straight back, so the
    // flag would be destroyed the next time the student cleared a level.
    out[key] = key.startsWith("world") ? normalizeWorld(raw[key]) : raw[key];
  });
  return out;
}

/** Whether the student has already watched the closing cinematic.
 *
 *  Lives on the progress document rather than in localStorage so it
 *  follows the ACCOUNT: a student who finishes on a classroom tablet
 *  does not get the ending again when they log in at home.
 *
 *  Reads are best-effort - if Firestore is unreachable the caller falls
 *  back to its local cache rather than blocking the student. */
export async function hasSeenEnding(uid) {
  if (!uid) return readLocalProgress().endingSeen === true;
  const snap = await getDoc(doc(db, "progress", uid));
  return snap.data()?.endingSeen === true;
}

export async function markEndingSeen(uid) {
  if (!uid) {
    const progress = readLocalProgress();
    progress.endingSeen = true;
    writeLocalProgress(progress);
    return;
  }
  // merge:true so this never disturbs the world entries alongside it.
  await setDoc(doc(db, "progress", uid), { endingSeen: true }, { merge: true });
}

export async function loadWorldProgress(uid, worldId) {
  const progress = await loadProgress(uid);
  return progress[`world${worldId}`]?.levels || [];
}

/** Marks a level complete and records its points (keeping the student's
 *  BEST score for that level, so replaying can improve but never lower
 *  what they already earned). */
export async function markLevelComplete(uid, worldId, level, points = 0) {
  const progress = await loadProgress(uid);
  const key = `world${worldId}`;
  const entry = progress[key] || { levels: [], points: {} };

  if (!entry.levels.includes(level)) entry.levels.push(level);
  const previous = entry.points[String(level)] || 0;
  entry.points[String(level)] = Math.max(previous, points);
  progress[key] = entry;

  if (!uid) {
    writeLocalProgress(progress);
  } else {
    await setDoc(doc(db, "progress", uid), progress);
  }
  return progress;
}

/** Total points across every world — used for the Dashboard XP stat. */
export function totalPointsFrom(progress) {
  return Object.values(progress || {}).reduce((sum, world) => {
    const pts = world?.points || {};
    return sum + Object.values(pts).reduce((a, b) => a + (b || 0), 0);
  }, 0);
}
