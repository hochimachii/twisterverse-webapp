// src/services/teacherService.js
//
// Migrated from a plaintext-password localStorage array to real
// Firebase Auth accounts + a Firestore doc at teachers/{uid}. Firebase
// Auth never stores or exposes raw passwords — this also fixes the
// "plaintext passwords" issue flagged earlier in the project.
//
// VERIFICATION: signing up no longer makes someone a teacher. It files a
// request - the teacher document is created with status "pending" - and
// the account stays locked out of the dashboard until the admin (a
// teacher with isMaster) approves it. firestore.rules enforce this, not
// this file: a pending or rejected teacher cannot read student data
// however they call Firestore.

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp
} from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import app, { db } from "../firebase";
import { signUp, signIn, signOutUser, getCurrentUser } from "./authService";

// MUST match REGION in functions/index.js. The Functions SDK defaults to
// us-central1, so a mismatch fails as an opaque CORS error that mentions
// nothing about regions.
const FUNCTIONS_REGION = "asia-southeast1";

export const TEACHER_STATUS = {
  pending: "pending",
  approved: "approved",
  rejected: "rejected"
};

/** A teacher record's approval status. Accounts created before
 *  verification existed carry no status and were already in use, so
 *  they count as approved - firestore.rules make the same assumption.
 *  The admin can still revoke any of them. */
export function teacherStatus(teacher) {
  return teacher?.status || TEACHER_STATUS.approved;
}

/** "First Middle Last", skipping a blank middle name. Older records only
 *  have the single `name` they signed up with. */
export function teacherFullName(teacher) {
  if (!teacher) return "";
  const parts = [teacher.firstName, teacher.middleName, teacher.lastName]
    .map((p) => (p || "").trim())
    .filter(Boolean);
  return parts.length ? parts.join(" ") : teacher.name || teacher.username || "";
}

function teacherAccessError(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

/**
 * Files a teacher's sign-up request. The account is created, but it
 * cannot open the dashboard until the admin approves it, so the new
 * session is signed out straight away.
 */
export async function createTeacher({
  firstName,
  middleName,
  lastName,
  username,
  password,
  school,
  grade,
  section
}) {
  const user = await signUp(username, password, "teacher");
  const request = { firstName, middleName, lastName };

  try {
    await setDoc(doc(db, "teachers", user.uid), {
      ...request,
      // Kept alongside the parts: the dashboard greeting, the CSV export
      // and every record from before the split all read `name`.
      name: teacherFullName(request),
      username,
      // `school` scopes which students this teacher can see - see
      // TeacherDashboard. Grade and section are what the admin checks the
      // request against.
      school,
      grade,
      section,
      status: TEACHER_STATUS.pending,
      createdAt: serverTimestamp()
    });
  } catch (err) {
    // Without its request document the account could never be approved,
    // yet its username would stay taken. Remove it so the teacher can
    // simply try again.
    await user.delete().catch(() => {});
    await signOutUser().catch(() => {});
    throw err;
  }

  await signOutUser();
  return user;
}

/**
 * Logs a teacher in. Returns { uid, name, username, school, isMaster }
 * or throws. Accounts still waiting for approval, and rejected ones, are
 * signed back out and rejected with a code of teacher/pending or
 * teacher/rejected, so the login screen can say which.
 */
export async function validateTeacher(username, password) {
  const user = await signIn(username, password, "teacher");
  const snap = await getDoc(doc(db, "teachers", user.uid));

  if (!snap.exists()) {
    await signOutUser();
    throw teacherAccessError(
      "teacher/not-found",
      "Walang nakitang account ng guro para rito."
    );
  }

  const data = snap.data();
  const status = teacherStatus(data);

  if (status === TEACHER_STATUS.pending) {
    await signOutUser();
    throw teacherAccessError(
      "teacher/pending",
      "Naghihintay pa ng pag-apruba ng admin ang iyong account. Makakapag-login ka kapag naaprubahan na ito."
    );
  }
  if (status !== TEACHER_STATUS.approved) {
    await signOutUser();
    throw teacherAccessError(
      "teacher/rejected",
      "Hindi pinahintulutan ang account na ito. Makipag-ugnayan sa admin."
    );
  }

  return {
    uid: user.uid,
    name: teacherFullName(data),
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

/** Every teacher record, requests included. Only the admin may list
 *  them - firestore.rules refuse anyone else. */
export async function getAllTeachers() {
  const snap = await getDocs(collection(db, "teachers"));
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }));
}

/**
 * Approves or rejects a teacher - also how the admin revokes an approved
 * account (status back to "rejected") or reverses a rejection. Records
 * who decided and when; the rules insist those match the caller and the
 * server clock, and refuse the admin's own record and any master record.
 */
export async function reviewTeacher(uid, status) {
  const reviewer = getCurrentUser();
  if (!reviewer) {
    throw teacherAccessError("teacher/signed-out", "Kailangan mong maka-login.");
  }
  await updateDoc(doc(db, "teachers", uid), {
    status,
    reviewedBy: reviewer.uid,
    reviewedAt: serverTimestamp()
  });
}

/** Sets a student's password. Students have no email, so Firebase's own
 *  reset cannot reach them - a teacher does it instead, which is what
 *  happens in a classroom anyway.
 *
 *  All the authorization lives in the Cloud Function: only an approved
 *  teacher may call it, only for a student in their own school, and
 *  never for another teacher's account. None of that can be enforced
 *  from here. */
export async function resetStudentPassword(studentUid, newPassword) {
  const fns = getFunctions(app, FUNCTIONS_REGION);
  const call = httpsCallable(fns, "resetStudentPassword");
  const res = await call({ studentUid, newPassword });
  return res.data;
}
