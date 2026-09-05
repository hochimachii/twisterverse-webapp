// src/services/progressService.js
//
// Per-student progress in Firestore at progress/{uid}. Guests use
// sessionStorage and never touch Firebase.
//
// Shape: { world1: { levels: [1,2,3], points: { "1": 150, "2": 120 } } }
// Older shape ({ world1: [1,2,3] }) is still read correctly — see
// normalizeWorld() — so existing saved progress isn't lost.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";

const GUEST_KEY = "progress";

function readGuestProgress() {
  try {
    return JSON.parse(sessionStorage.getItem(GUEST_KEY)) || {};
  } catch {
    return {};
  }
}

function writeGuestProgress(data) {
  sessionStorage.setItem(GUEST_KEY, JSON.stringify(data));
}

/** Accepts either the old array shape or the new object shape. */
function normalizeWorld(value) {
  if (Array.isArray(value)) return { levels: value, points: {} };
  if (value && typeof value === "object") {
    return { levels: value.levels || [], points: value.points || {} };
  }
  return { levels: [], points: {} };
}

export async function loadProgress(isGuest, uid) {
  const raw = isGuest || !uid
    ? readGuestProgress()
    : (await getDoc(doc(db, "progress", uid))).data() || {};

  const out = {};
  Object.keys(raw).forEach((key) => {
    out[key] = normalizeWorld(raw[key]);
  });
  return out;
}

export async function loadWorldProgress(isGuest, uid, worldId) {
  const progress = await loadProgress(isGuest, uid);
  return progress[`world${worldId}`]?.levels || [];
}

/** Marks a level complete and records its points (keeping the student's
 *  BEST score for that level, so replaying can improve but never lower
 *  what they already earned). */
export async function markLevelComplete(isGuest, uid, worldId, level, points = 0) {
  const progress = await loadProgress(isGuest, uid);
  const key = `world${worldId}`;
  const entry = progress[key] || { levels: [], points: {} };

  if (!entry.levels.includes(level)) entry.levels.push(level);
  const previous = entry.points[String(level)] || 0;
  entry.points[String(level)] = Math.max(previous, points);
  progress[key] = entry;

  if (isGuest || !uid) {
    writeGuestProgress(progress);
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
