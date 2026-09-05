// src/services/authService.js
//
// Thin wrapper around Firebase Auth's email/password provider, adapted
// for this app's username-based login (students/teachers type a
// username, not an email). Firebase Auth requires an email-shaped
// identifier, so each username is deterministically mapped to a fake
// address under a domain that's never actually emailed. Students and
// teachers use SEPARATE fake domains so a student and a teacher could
// never collide by picking the same username.

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebase";

function usernameToEmail(username, role) {
  const domain = role === "teacher" ? "twisterverse-teacher.local" : "twisterverse.local";
  return `${username.trim().toLowerCase()}@${domain}`;
}

/** Creates a new Firebase Auth account for a username/password/role. */
export async function signUp(username, password, role = "student") {
  const email = usernameToEmail(username, role);
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  return cred.user; // has .uid
}

/** Signs in an existing username/password/role. Throws on bad credentials. */
export async function signIn(username, password, role = "student") {
  const email = usernameToEmail(username, role);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  return cred.user;
}

export async function signOutUser() {
  await firebaseSignOut(auth);
}

/** Subscribes to auth state changes. Returns an unsubscribe function. */
export function subscribeToAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export function getCurrentUser() {
  return auth.currentUser;
}

/** Translates Firebase Auth's raw error codes into short, friendly
 *  messages — used by LoginPage and TeacherLogin so users don't see
 *  "Firebase: Error (auth/invalid-credential)." */
export function friendlyAuthError(err) {
  const code = err?.code || "";
  if (code.includes("invalid-credential") || code.includes("wrong-password") || code.includes("user-not-found")) {
    return "Mali ang username o password.";
  }
  if (code.includes("email-already-in-use")) {
    return "May gumagamit na ng username na ito.";
  }
  if (code.includes("weak-password")) {
    return "Masyadong maikli ang password (kailangan ng 6+ na karakter).";
  }
  if (code.includes("network-request-failed")) {
    return "Walang koneksyon sa internet. Subukan ulit.";
  }
  return err?.message || "May naganap na error. Subukan ulit.";
}
