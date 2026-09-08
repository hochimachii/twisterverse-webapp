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
  sendPasswordResetEmail,
  signOut as firebaseSignOut,
  onAuthStateChanged
} from "firebase/auth";
import { auth } from "../firebase";

function usernameToEmail(identifier, role) {
  const trimmed = (identifier || "").trim().toLowerCase();

  // A real email address is used as-is. Teachers are adults who have one,
  // and it is the ONLY way Firebase's own password reset can deliver
  // anything: the .local domains below are invented and have no mail
  // server, so a reset sent there goes nowhere.
  //
  // Students keep using plain usernames - they have no email, and are
  // reset by their teacher instead.
  if (trimmed.includes("@")) return trimmed;

  const domain = role === "teacher" ? "twisterverse-teacher.local" : "twisterverse.local";
  return `${trimmed}@${domain}`;
}

/** True when this identifier can receive a reset link at all. A username
 *  maps to an invented domain, so Firebase would happily "send" a reset
 *  that could never arrive - better to say so than to show a success
 *  message for mail that does not exist. */
export function canResetPassword(identifier) {
  return (identifier || "").includes("@");
}

/** Sends Firebase's own password-reset email. Only meaningful for
 *  accounts registered with a real address. */
export async function sendPasswordReset(identifier, role = "teacher") {
  await sendPasswordResetEmail(auth, usernameToEmail(identifier, role));
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
