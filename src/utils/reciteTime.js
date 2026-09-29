// src/utils/reciteTime.js
//
// How long a student gets to recite a twister.
//
// It used to be a flat five seconds, but the lines grow from about 10
// syllables in Mundo 1 to 42 in Mundo 3. Five seconds for the longest
// meant 8.4 syllables a second - more than fluent adult speech. In the
// first week of classroom use, 0.4% of 9,033 tries at that line passed,
// and 65 students were stuck on it after a median of 67 tries.
//
// The limit now grows with the line, so every level asks for about the
// same pace. Short lines keep exactly five seconds: nothing got easier.
// Scoring needs no change, because the speed bonus is already a share of
// the time allowed (see calculateScore).

export const MIN_RECITE_SECONDS = 5;

// The pace every line is sized for: brisk, but within reach of a Grade 7
// student. Lower it to make every long line more forgiving.
export const SYLLABLES_PER_SECOND = 3.5;

/** Syllables in a Tagalog line. Every vowel is its own syllable
 *  (ba-o, bu-bu-yog), so counting vowels counts syllables. */
export function countSyllables(text) {
  return ((text || "").toLowerCase().match(/[aeiou]/g) || []).length;
}

/** Seconds allowed to recite this line. */
export function reciteSecondsFor(text) {
  return Math.max(
    MIN_RECITE_SECONDS,
    Math.ceil(countSyllables(text) / SYLLABLES_PER_SECOND)
  );
}
