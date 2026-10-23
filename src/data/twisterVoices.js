// src/data/twisterVoices.js
//
// Recorded model readings of the tongue twisters. The activity plays a
// level's reading first and only then lets the student recite, so they
// hear how it should sound before trying it.
//
// FILES: src/assets/voices/twisters/mundo-{world}/antas-{level}.mp3
// They are found at BUILD time, so adding recordings means dropping files
// in with that naming - no code change. A level with no file yet simply
// skips the listening step and plays exactly as it did before.
//
// require.context rather than 80 imports: webpack still bundles each
// file with a hashed URL (immutable caching, like every other asset), and
// the set of levels that have audio is known without a network request.

const context = require.context(
  "../assets/voices/twisters",
  true,
  /^\.\/mundo-\d+\/antas-\d+\.mp3$/
);

const VOICES = {};
context.keys().forEach((key) => {
  const [, world, level] = key.match(/mundo-(\d+)\/antas-(\d+)\.mp3$/);
  VOICES[`${Number(world)}-${Number(level)}`] = context(key);
});

/** URL of the reading for a level, or null when none is recorded yet. */
export function twisterVoice(world, level) {
  return VOICES[`${world}-${level}`] || null;
}
