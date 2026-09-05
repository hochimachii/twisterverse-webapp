// src/utils/exportStudentData.js
//
// CSV export for the Teacher Dashboard, so recitation data can be graded
// in Excel or Google Sheets instead of read off the screen.
//
// WHY CSV AND NOT XLSX: a real .xlsx needs a library and a build-size
// hit, and teachers only need something that opens in a spreadsheet.
// CSV does that everywhere, including on a phone.
//
// Two exports, because they answer different questions:
//   - BUOD (summary): one row per student, for entering grades.
//   - PAGSUBOK (detail): one row per attempt, for checking a specific
//     recitation or listening back to the audio.

import { totalLevelCount } from "../data/worlds";
import { schoolName } from "../data/schools";
import { displayName } from "../services/userService";

const TIER_TEXT = {
  perfect: "Perpekto",
  pass: "Pumasa",
  close: "Malapit na",
  fail: "Mali",
  timeout: "Ubos ang Oras",
  error: "Problema sa Mic"
};

const PASSING = new Set(["perfect", "pass"]);

function attemptTimeMs(a) {
  return a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
}

/**
 * Escapes one value for CSV.
 *
 * The leading apostrophe on =, +, - and @ is not cosmetic: transcripts
 * are whatever the recognizer heard, so a recitation starting with "="
 * would otherwise be interpreted as a FORMULA when the teacher opens the
 * file. That is the standard CSV-injection problem, and a spreadsheet
 * full of student speech is exactly the place to guard against it.
 */
function cell(value) {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  if (/[",\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
  return s;
}

function toCsv(headers, rows) {
  return [headers, ...rows].map((r) => r.map(cell).join(",")).join("\r\n");
}

function dateTime(ms) {
  if (!ms) return "";
  try {
    return new Date(ms).toLocaleString("en-PH", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return "";
  }
}

/** Per-student figures a teacher would actually grade on. */
export function summarizeForExport(student, allAttempts) {
  const attempts = allAttempts
    .filter((a) => a.uid === student.uid)
    .sort((a, b) => attemptTimeMs(a) - attemptTimeMs(b));

  const passedLevels = new Set();
  let passed = 0;
  let perfect = 0;
  let similaritySum = 0;
  let similarityCount = 0;

  attempts.forEach((a) => {
    if (PASSING.has(a.tier)) {
      passed += 1;
      passedLevels.add(`${a.world}-${a.level}`);
    }
    if (a.tier === "perfect") perfect += 1;
    if (typeof a.similarity === "number") {
      similaritySum += a.similarity;
      similarityCount += 1;
    }
  });

  const total = attempts.length;
  const completed = passedLevels.size;
  const totalLevels = totalLevelCount();

  return {
    attempts,
    completed,
    totalLevels,
    progressPercent: totalLevels ? Math.round((completed / totalLevels) * 100) : 0,
    totalAttempts: total,
    passed,
    failed: total - passed,
    perfect,
    passRate: total ? Math.round((passed / total) * 100) : 0,
    // Mean similarity across every attempt: how ACCURATE the recitations
    // are, independent of how many tries it took.
    avgAccuracy: similarityCount
      ? Math.round((similaritySum / similarityCount) * 100)
      : 0,
    // Attempts spent per level actually cleared: the efficiency figure.
    // 1.0 means every level was passed first try. Blank when nothing has
    // been cleared yet, because 0 completed levels is not "infinitely
    // inefficient" - there is simply nothing to measure.
    attemptsPerLevel: completed ? (total / completed).toFixed(2) : "",
    firstAttempt: total ? attemptTimeMs(attempts[0]) : 0,
    lastAttempt: total ? attemptTimeMs(attempts[total - 1]) : 0
  };
}

/** One row per student — the grading sheet. */
export function buildSummaryCsv(students, allAttempts) {
  const headers = [
    "Pangalan",
    "Username",
    "Paaralan",
    "Baitang",
    "Seksyon",
    "Kasarian",
    "Natapos na Antas",
    "Kabuuang Antas",
    "Progreso (%)",
    "Kabuuang Pagsubok",
    "Pumasa",
    "Hindi Pumasa",
    "Perpekto",
    "Bahagdan ng Pagpasa (%)",
    "Katamtamang Katumpakan (%)",
    "Pagsubok Bawat Natapos na Antas",
    "Unang Pagsubok",
    "Huling Pagsubok"
  ];

  const rows = students.map((s) => {
    const m = summarizeForExport(s, allAttempts);
    return [
      displayName(s.profile),
      s.username,
      schoolName(s.profile.school) || s.profile.school,
      s.profile.grade,
      s.profile.section,
      s.profile.gender,
      m.completed,
      m.totalLevels,
      m.progressPercent,
      m.totalAttempts,
      m.passed,
      m.failed,
      m.perfect,
      m.passRate,
      m.avgAccuracy,
      m.attemptsPerLevel,
      dateTime(m.firstAttempt),
      dateTime(m.lastAttempt)
    ];
  });

  return toCsv(headers, rows);
}

/** One row per attempt — the evidence behind the summary. */
export function buildAttemptsCsv(students, allAttempts) {
  const byUid = new Map(students.map((s) => [s.uid, s]));

  const headers = [
    "Petsa at Oras",
    "Pangalan",
    "Username",
    "Baitang",
    "Seksyon",
    "Mundo",
    "Antas",
    "Hamon",
    "Narinig",
    "Katumpakan (%)",
    "Resulta",
    "Link ng Audio"
  ];

  const rows = allAttempts
    .filter((a) => byUid.has(a.uid))
    .sort((a, b) => attemptTimeMs(a) - attemptTimeMs(b))
    .map((a) => {
      const s = byUid.get(a.uid);
      return [
        dateTime(attemptTimeMs(a)),
        displayName(s.profile),
        s.username,
        s.profile.grade,
        s.profile.section,
        a.world,
        a.level,
        a.twister,
        a.transcript,
        typeof a.similarity === "number" ? Math.round(a.similarity * 100) : "",
        TIER_TEXT[a.tier] || a.tier || "",
        a.audioUrl || ""
      ];
    });

  return toCsv(headers, rows);
}

/**
 * Saves CSV text as a file.
 *
 * The BOM matters: without it Excel on Windows reads the file as the
 * local codepage and mangles every accented character and peso sign in
 * the Filipino column headers.
 */
export function downloadCsv(filename, csv) {
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on the next tick so the download has certainly started.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Stamps the filename so repeated exports don't overwrite each other. */
export function exportFilename(prefix) {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `twisterverse-${prefix}-${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}.csv`;
}
