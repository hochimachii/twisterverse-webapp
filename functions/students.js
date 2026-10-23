// functions/students.js
//
// Deleting a student, for the admin's Teacher Dashboard - see the
// deleteStudent callable in index.js. Kept apart from index.js so the
// logic can be tested against stand-ins for the Admin SDK.

const { HttpsError } = require("firebase-functions/v2/https");

// Firestore's cap on writes in one batch.
const BATCH_LIMIT = 500;

/** Throws unless callerUid is the admin: an approved teacher with master
 *  access. Records from before verification have no status and count as
 *  approved, as they do in firestore.rules. */
async function assertIsAdmin(db, callerUid) {
  const snap = await db.doc(`teachers/${callerUid}`).get();
  const caller = snap.exists ? snap.data() : null;
  const approved = caller !== null && (caller.status || "approved") === "approved";
  if (!approved || caller.isMaster !== true) {
    throw new HttpsError(
      "permission-denied",
      "Ang admin lamang ang makakapagbura ng mag-aaral."
    );
  }
}

/**
 * Deletes a student and everything they have: their login, recordings,
 * attempts, progress and, last, the users record that lists them.
 *
 * The order makes a failure safe to retry. The login goes first, so the
 * student can't sign back in and add data partway through. The users
 * record goes last, so a student whose delete failed partway is still on
 * the dashboard and can simply be deleted again; the parts already gone
 * are skipped.
 */
async function deleteStudentData({ db, auth, bucket }, studentUid) {
  // A teacher's account is never removed from here. Teachers are
  // reviewed and revoked in the admin's teacher list instead.
  if ((await db.doc(`teachers/${studentUid}`).get()).exists) {
    throw new HttpsError(
      "permission-denied",
      "Account ng guro ito, hindi ng mag-aaral."
    );
  }

  const userRef = db.doc(`users/${studentUid}`);
  const userSnap = await userRef.get();
  if (!userSnap.exists) {
    throw new HttpsError("not-found", "Walang nakitang mag-aaral.");
  }

  try {
    await auth.deleteUser(studentUid);
  } catch (err) {
    // Already gone: an earlier try got this far.
    if (err.code !== "auth/user-not-found") throw err;
  }

  const [files] = await bucket.getFiles({ prefix: `attempts/${studentUid}/` });
  await Promise.all(files.map((file) => file.delete({ ignoreNotFound: true })));

  const attempts = await db.collection("attempts").where("uid", "==", studentUid).get();
  for (let i = 0; i < attempts.docs.length; i += BATCH_LIMIT) {
    const batch = db.batch();
    attempts.docs.slice(i, i + BATCH_LIMIT).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }

  await db.doc(`progress/${studentUid}`).delete();
  await userRef.delete();

  return {
    username: userSnap.data().username || null,
    attempts: attempts.size,
    recordings: files.length
  };
}

module.exports = { assertIsAdmin, deleteStudentData };
