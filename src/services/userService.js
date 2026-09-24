// src/services/userService.js
//
// Migrated from localStorage to Firestore. Every function here is now
// async (returns a Promise) — this is the biggest behavior change from
// the old version, and every screen that calls these had to be updated
// to await them (LoginPage, ProfileSetup, Dashboard, TeacherDashboard).
//
// Auth (account creation/login) is handled by authService.js — this
// file only handles the STUDENT PROFILE document in Firestore, keyed
// by the Firebase Auth uid.

import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore";
import { db } from "../firebase";
import {
  signUp,
  signIn,
  signOutUser,
  getCurrentUser,
  usernameFromEmail
} from "./authService";

/** Creates a new student account (Auth) — profile is saved separately
 *  via saveUserProfile() once ProfileSetup completes. */
export async function createUser({ username, password }) {
  const user = await signUp(username, password, "student");
  // Store the username on the (still-empty) profile doc immediately, so
  // getAllStudents/search can find the account even before ProfileSetup
  // finishes.
  try {
    await setDoc(doc(db, "users", user.uid), { username, profile: null });
  } catch (err) {
    // Without this record the account is only half made, and its username
    // is already taken, so signing up again would fail. Remove it so the
    // student can simply try again. If even that fails, saveUserProfile
    // repairs the record when they log in.
    await user.delete().catch(() => {});
    await signOutUser().catch(() => {});
    throw err;
  }
  return user;
}

/** Logs a student in. Returns the Firebase user (has .uid) or throws. */
export async function validateUser(username, password) {
  return signIn(username, password, "student");
}

const GUEST_PROFILE_KEY = "guestProfile"; // sessionStorage, guest-only (no uid = no Firestore)

export async function getUserProfile(uid) {
  if (!uid) {
    try {
      return JSON.parse(sessionStorage.getItem(GUEST_PROFILE_KEY)) || null;
    } catch {
      return null;
    }
  }
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists() ? snap.data().profile || null : null;
}

export async function saveUserProfile(uid, profileData) {
  if (!uid) {
    sessionStorage.setItem(GUEST_PROFILE_KEY, JSON.stringify(profileData));
    return;
  }
  const ref = doc(db, "users", uid);
  const snap = await getDoc(ref);
  const record = { profile: profileData };

  // The username is written at sign-up, and merge leaves it in place. But
  // an account can exist without that record - the app closed between
  // creating the account and saving it, or the record was deleted in the
  // console. This used to send username: undefined, which Firestore
  // rejects outright, so every save failed and the student was stuck on
  // Profile Setup. Recover the username from the account's own login.
  if (!snap.exists() || !snap.data().username) {
    const user = getCurrentUser();
    const recovered = user && user.uid === uid ? usernameFromEmail(user.email) : "";
    if (recovered) record.username = recovered;
  }

  await setDoc(ref, record, { merge: true });
}

export function isProfileComplete(profile) {
  if (!profile) return false;
  const { fullName, nickname, school, avatar, grade, section, gender } = profile;
  // `nickname` is accepted as a fallback so profiles created before
  // full names were required aren't forced back through setup — see
  // displayName() for how those are shown.
  const hasName = Boolean(fullName || nickname);
  return Boolean(hasName && school && avatar && grade && section && gender);
}

/** The student's display name, tolerating pre-fullName profiles. */
export function displayName(profile) {
  if (!profile) return "";
  return profile.fullName || profile.nickname || "";
}

/** Every registered student with a completed profile — used by the
 *  Teacher Dashboard to list/filter/search students. */
export async function getAllStudents() {
  const snap = await getDocs(collection(db, "users"));
  const students = [];
  snap.forEach((docSnap) => {
    const data = docSnap.data();
    if (isProfileComplete(data.profile)) {
      students.push({ uid: docSnap.id, username: data.username, profile: data.profile });
    }
  });
  return students;
}
