// src/services/teacherService.js
//
// Migrated from a plaintext-password localStorage array to real
// Firebase Auth accounts + a Firestore doc at teachers/{uid}. Firebase
// Auth never stores or exposes raw passwords — this also fixes the
// "plaintext passwords" issue flagged earlier in the project.

import { doc, getDoc, setDoc } from "firebase/firestore";
import { db } from "../firebase";
import { signUp, signIn } from "./authService";

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
  return { uid: user.uid, name: data.name, username: data.username, school: data.school || null };
}

export async function getTeacherByUid(uid) {
  if (!uid) return null;
  const snap = await getDoc(doc(db, "teachers", uid));
  return snap.exists() ? { uid, ...snap.data() } : null;
}
