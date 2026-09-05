#!/usr/bin/env node
/**
 * scripts/migrate-firestore.js
 *
 * Copies Firestore documents from the old project to the new one.
 *
 * WHY A SCRIPT AND NOT `gcloud firestore export`: the managed export
 * writes to a Cloud Storage bucket, which the OLD project doesn't have —
 * it's on Spark, which is the whole reason we're moving. This reads
 * through the Admin SDK instead, which works fine on the free plan.
 *
 * DOCUMENT IDS ARE PRESERVED, and they matter: /users/{uid},
 * /progress/{uid} and /teachers/{uid} are all keyed by Firebase Auth
 * UID. Migrate the Auth users FIRST (see FIREBASE-SETUP.md) — a
 * `firebase auth:import` keeps the original UIDs, so these documents
 * still line up afterwards. Import Firestore before Auth and every
 * profile will be orphaned.
 *
 * SETUP:
 *   npm install --no-save firebase-admin
 *   Download a service-account key for each project:
 *     Firebase console > Project settings > Service accounts >
 *     Generate new private key
 *   Save them as old-serviceaccount.json / new-serviceaccount.json
 *   (both are gitignored).
 *
 * USAGE:
 *   node scripts/migrate-firestore.js export --key old-serviceaccount.json
 *   node scripts/migrate-firestore.js import --key new-serviceaccount.json
 *
 * Add --dry-run to the import to see counts without writing anything.
 */

const fs = require("fs");
const path = require("path");

let admin;
try {
  admin = require("firebase-admin");
} catch {
  console.error(
    "firebase-admin is not installed. Run:\n  npm install --no-save firebase-admin"
  );
  process.exit(1);
}

// Every collection the app uses. Sourced from src/services/*.js — if you
// add a collection there, add it here too.
const COLLECTIONS = ["users", "progress", "teachers", "attempts"];

const DEFAULT_DIR = "migration-data";
const BATCH_LIMIT = 500; // Firestore's hard cap on writes per batch

function parseArgs(argv) {
  const args = { command: argv[2], dir: DEFAULT_DIR, dryRun: false };
  for (let i = 3; i < argv.length; i++) {
    if (argv[i] === "--key") args.key = argv[++i];
    else if (argv[i] === "--dir") args.dir = argv[++i];
    else if (argv[i] === "--dry-run") args.dryRun = true;
  }
  return args;
}

/**
 * Firestore values don't all survive JSON.stringify. Timestamps are the
 * ones this app actually stores (attempt times, progress updates); left
 * alone they'd serialize to {_seconds, _nanoseconds} and come back as
 * plain objects, quietly breaking every date sort in the teacher
 * dashboard. Tag them on the way out, rebuild them on the way in.
 */
function encode(value) {
  if (value instanceof admin.firestore.Timestamp) {
    return { __type__: "timestamp", value: value.toDate().toISOString() };
  }
  if (value instanceof Date) {
    return { __type__: "timestamp", value: value.toISOString() };
  }
  if (Array.isArray(value)) return value.map(encode);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, encode(v)])
    );
  }
  return value;
}

function decode(value) {
  if (value && typeof value === "object" && value.__type__ === "timestamp") {
    return admin.firestore.Timestamp.fromDate(new Date(value.value));
  }
  if (Array.isArray(value)) return value.map(decode);
  if (value && typeof value === "object" && value.constructor === Object) {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, decode(v)])
    );
  }
  return value;
}

function connect(keyPath) {
  if (!keyPath) {
    console.error("Missing --key <service-account.json>");
    process.exit(1);
  }
  const resolved = path.resolve(keyPath);
  if (!fs.existsSync(resolved)) {
    console.error(`Service-account key not found: ${resolved}`);
    process.exit(1);
  }
  const credential = require(resolved);
  admin.initializeApp({ credential: admin.credential.cert(credential) });
  console.log(`Connected to project: ${credential.project_id}\n`);
  return admin.firestore();
}

async function exportData({ key, dir }) {
  const db = connect(key);
  fs.mkdirSync(dir, { recursive: true });

  for (const name of COLLECTIONS) {
    const snapshot = await db.collection(name).get();
    const docs = snapshot.docs.map((doc) => ({
      id: doc.id,
      data: encode(doc.data())
    }));
    const file = path.join(dir, `${name}.json`);
    fs.writeFileSync(file, JSON.stringify(docs, null, 2));
    console.log(`${name}: ${docs.length} document(s) -> ${file}`);
  }

  console.log(`\nDone. Review the JSON in ${dir}/ before importing.`);
}

async function importData({ key, dir, dryRun }) {
  const db = connect(key);

  for (const name of COLLECTIONS) {
    const file = path.join(dir, `${name}.json`);
    if (!fs.existsSync(file)) {
      console.log(`${name}: no export file, skipping`);
      continue;
    }
    const docs = JSON.parse(fs.readFileSync(file, "utf8"));

    if (dryRun) {
      console.log(`${name}: would write ${docs.length} document(s)`);
      continue;
    }

    for (let i = 0; i < docs.length; i += BATCH_LIMIT) {
      const batch = db.batch();
      for (const doc of docs.slice(i, i + BATCH_LIMIT)) {
        batch.set(db.collection(name).doc(doc.id), decode(doc.data));
      }
      await batch.commit();
    }
    console.log(`${name}: wrote ${docs.length} document(s)`);
  }

  console.log(
    dryRun ? "\nDry run complete - nothing written." : "\nImport complete."
  );
}

async function main() {
  const args = parseArgs(process.argv);
  if (args.command === "export") await exportData(args);
  else if (args.command === "import") await importData(args);
  else {
    console.error(
      "Usage:\n" +
        "  node scripts/migrate-firestore.js export --key old-serviceaccount.json\n" +
        "  node scripts/migrate-firestore.js import --key new-serviceaccount.json [--dry-run]"
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
