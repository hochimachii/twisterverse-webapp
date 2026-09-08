// src/services/teacherService.js
//
// Migrated from a plaintext-password localStorage array to real
// Firebase Auth accounts + a Firestore doc at teachers/{uid}. Firebase
// Auth never stores or exposes raw passwords — this also fixes the
// "plaintext passwords" issue flagged earlier in the project.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../firebase";
import { signUp, signIn } from "./authService";

// MUST match REGION in functions/index.js. The Functions SDK defaults to
// us-central1, so a mismatch fails as an opaque CORS error that mentions
// nothing about regions.
const FUNCTIONS_REGION = "asia-southeast1";

export async function createTeacher({ name, username, password, school }) {
  const user = await signUp(username, password, "teacher");
  // `school` scopes which students this teacher can see — see
  // TeacherDashboard.
  await setDoc(doc(db, "teachers", user.uid), { name, username, school });
  return user;
}

/** Logs a teacher in. Returns { uid, name, username } or throws. */
export async function validateTeacher(username, password) {
  const user = await signIn(username, password, "teacher");
  const snap = await getDoc(doc(db, "teachers", user.uid));
  const data = snap.exists() ? snap.data() : { name: username, username, school: null };
  return {
    uid: user.uid,
    name: data.name,
    username: data.username,
    school: data.school || null,
    // Master access sees every school. Granted by setting isMaster on
    // the teacher document, never inferred from a name or email.
    isMaster: data.isMaster === true
  };
}

export async function getTeacherByUid(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "teachers", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}

/** Sets a student's password. Students have no email, so Firebase's own
 *  reset cannot reach them - a teacher does it instead, which is what
 *  happens in a classroom anyway.
 *
 *  All the authorization lives in the Cloud Function: only a teacher may
 *  call it, only for a student in their own school, and never for
 *  another teacher's account. None of that can be enforced from here. */
export async function resetStudentPassword(studentUid, newPassword) {
  const fns = getFunctions(app, FUNCTIONS_REGION);
  const call = httpsCallable(fns, "resetStudentPassword");
  const res = await call({ studentUid, newPassword });
  return res.data;
}
