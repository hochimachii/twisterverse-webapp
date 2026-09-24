// src/utils/speechScoring.js
//
// Scoring for tongue-twister recitations.
//
// Filipino is highly phonetic, but speech-to-text engines return
// inconsistent SPELLINGS for identical sounds ("vivo"/"bibo",
// "quico"/"kiko", "lumelipad"/"lumilipad"). Comparing raw spellings was
// causing correct recitations to be flagged wrong. Everything is
// normalized to a phonetic form first, so words that SOUND the same
// count as the same.
//
// Verified against real STT variance cases: v/b merge, f/p merge,
// c/qu/k spellings, e/i and o/u drift, and doubled letters all score
// as correct, while genuinely wrong recitations still fail.

/** Collapses a word to a rough Filipino phonetic form. */
export function phoneticNormalize(word) {
  let w = word.toLowerCase().replace(/[^a-z]/g, "");
  w = w.replace(/qu/g, "k");
  w = w.replace(/c([eiy])/g, "s$1");
  w = w.replace(/c/g, "k");
  w = w.replace(/z/g, "s");
  w = w.replace(/v/g, "b");   // v/b merge — very common in Filipino speech
  w = w.replace(/f/g, "p");   // f/p merge — likewise
  w = w.replace(/j/g, "h");
  w = w.replace(/x/g, "ks");
  w = w.replace(/ph/g, "p");
  w = w.replace(/ng/g, "N");  // treat digraphs as single units
  w = w.replace(/ny/g, "N");
  w = w.replace(/ll/g, "l");
  w = w.replace(/e/g, "i");   // e/i drift
  w = w.replace(/o/g, "u");   // o/u drift
  w = w.replace(/(.)\1+/g, "$1"); // collapse doubled letters
  return w;
}

function charLevenshtein(a, b) {
  const m = Array(a.length + 1)
    .fill(null)
    .map(() => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}

/** Two words match if identical, phonetically identical, or within a
 *  length-scaled edit distance of each other phonetically. Short words
 *  get zero tolerance so "lara"/"laro" don't wrongly count as a match. */
export function wordsMatch(a, b) {
  if (a === b) return true;
  const pa = phoneticNormalize(a);
  const pb = phoneticNormalize(b);
  if (pa === pb) return true;
  const len = Math.max(pa.length, pb.length);
  const tolerance = len <= 4 ? 0 : len <= 7 ? 1 : 2;
  return charLevenshtein(pa, pb) <= tolerance;
}

/**
 * Strict match used ONLY when comparing a MERGED pair of words.
 *
 * wordsMatch's edit tolerance is right for comparing one word to one
 * word, but wrong once two words are joined: a long word could absorb a
 * short neighbour within tolerance, so "lumilipad" matched
 * "lumilipad" + "ang" and an omitted word cost nothing. In practice
 * "Popoy pato ay pumapadyak sa putik" recited without the "sa" scored
 * 100% "Perpekto".
 *
 * Genuine boundary noise joins to text that is phonetically IDENTICAL
 * ("bibo" + "bumulong" == "bibobumulong"), so no tolerance is needed
 * here to keep that working - and removing it stops omitted function
 * words (sa, ng, at, ay, ang) from being free.
 */
function wordsMatchExact(a, b) {
  return a === b || phoneticNormalize(a) === phoneticNormalize(b);
}

export function tokenizeWords(text) {
  return text
    .toLowerCase()
    .trim()
    // Punctuation is a word BOUNDARY, not something to delete. Deleting
    // it glued words together: the server recognizer returns comma-
    // separated output for fragmented speech ("pato,pato,putik"), which
    // collapsed into the single nonsense token "patopatoputik" and
    // scored 0% for a student who had said three correct words.
    // Hyphenated targets ("tuloy-tuloy") split the same way on both
    // sides, and alignmentDistance's merge rules absorb the difference
    // at zero cost if the recognizer glues them back together.
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Alignment-based distance between what was spoken and the target.
 *
 * Beyond ordinary insert/delete/substitute, this allows word-BOUNDARY
 * differences, which speech recognizers produce constantly:
 *   - one target word heard as two ("pato" -> "pa" + "'to")
 *   - two target words heard as one ("bibo bumulong" -> "bibobumulong")
 *
 * Without this, a perfectly-spoken twister could be marked wrong purely
 * because the recognizer put a space in a different place. Merges cost
 * 0 when the joined text matches, so they fix boundary noise without
 * making genuinely wrong recitations any easier to pass.
 */
function alignmentDistance(originalWords, spokenWords) {
  const n = originalWords.length;
  const m = spokenWords.length;
  const INF = Number.MAX_SAFE_INTEGER;
  const dp = Array(m + 1)
    .fill(null)
    .map(() => Array(n + 1).fill(INF));
  dp[0][0] = 0;

  for (let i = 0; i <= m; i++) {
    for (let j = 0; j <= n; j++) {
      const cur = dp[i][j];
      if (cur === INF) continue;

      // extra spoken word / missed target word
      if (i < m) dp[i + 1][j] = Math.min(dp[i + 1][j], cur + 1);
      if (j < n) dp[i][j + 1] = Math.min(dp[i][j + 1], cur + 1);

      // straight 1:1 comparison
      if (i < m && j < n) {
        dp[i + 1][j + 1] = Math.min(
          dp[i + 1][j + 1],
          cur + (wordsMatch(spokenWords[i], originalWords[j]) ? 0 : 1)
        );
      }
      // two spoken words == one target word
      if (i + 1 < m && j < n) {
        dp[i + 2][j + 1] = Math.min(
          dp[i + 2][j + 1],
          cur + (wordsMatchExact(spokenWords[i] + spokenWords[i + 1], originalWords[j]) ? 0 : 2)
        );
      }
      // one spoken word == two target words
      if (i < m && j + 1 < n) {
        dp[i + 1][j + 2] = Math.min(
          dp[i + 1][j + 2],
          cur + (wordsMatchExact(spokenWords[i], originalWords[j] + originalWords[j + 1]) ? 0 : 2)
        );
      }
    }
  }
  return dp[m][n];
}

/** Returns 0..1 similarity of a spoken recitation against the target. */
export function scoreRecitation(original, spoken) {
  const originalWords = tokenizeWords(original);
  const spokenWords = tokenizeWords(spoken);
  if (!originalWords.length) return 0;
  const distance = alignmentDistance(originalWords, spokenWords);
  return Math.max(0, 1 - distance / originalWords.length);
}

/** Maps a similarity score to a feedback tier. */
export function tierForSimilarity(similarity) {
  if (similarity >= 0.999) return "perfect";
  if (similarity >= 0.8) return "pass";
  if (similarity >= 0.55) return "close";
  return "fail";
}
