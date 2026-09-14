// src/config.js
//
// Feature switches and third-party settings.

export const FEATURES = {
  // Server-side speech-to-text (Firebase Cloud Functions + Google
  // Speech-to-Text). Required for iOS/Safari and in-app browsers.
  // BLAZE PLAN ONLY — leave false on the free Spark plan.
  serverTranscription: true,

  // Route ALL mobile devices through server transcription, not only the
  // platforms that can't use the Web Speech API at all.
  //
  // This is the ONLY way to get audio recordings from Android. The
  // browser recognizer refuses to share the microphone with
  // MediaRecorder (see mobileAudioRecording below), so on Android it is
  // one or the other: browser grading with no recording, or server
  // grading with a recording. This flag picks the second.
  //
  // What it costs:
  //   - Every mobile attempt now calls Speech-to-Text. 60 minutes per
  //     month are free, then ~$0.016/min - a 10-second recitation is
  //     about $0.003.
  //   - Grading takes ~1-1.5s instead of being instant, and needs a
  //     working connection.
  //   - Android grading moves off the browser recognizer onto chirp_2.
  //     Compare accuracy after switching: if Filipino recognition gets
  //     WORSE for your students, set this back to false and accept
  //     losing Android recordings again.
  //
  // Desktop is unaffected - it already records alongside the browser
  // recognizer without contention.
  mobileServerTranscription: true,

  // Upload recitation audio so teachers can listen back.
  // Uses Cloudinary (no backend, works on the free Spark plan) — see
  // src/services/audioStorage.js for setup.
  audioRecordingUpload: true,

  // Record audio on MOBILE devices.
  //
  // KEEP THIS FALSE. Tested three ways on real Android hardware:
  //   1. No recording                  -> speech detection works
  //   2. Recording started mid-attempt -> audio AND transcript truncated
  //   3. Mic stream held from page load-> detection receives NOTHING
  //
  // Android's Web Speech API cannot share the microphone with
  // getUserMedia/MediaRecorder. Holding an audio stream starves the
  // recognizer, so enabling this trades working gameplay for
  // recordings. Desktop browsers handle concurrent mic access fine and
  // still record normally.
  //
  // To get mobile recordings, the only real path is server-side
  // transcription: mobile stops using the browser recognizer entirely
  // and instead records + uploads the audio for transcription. That is
  // now implemented and enabled - see mobileServerTranscription above.
  // This flag stays false because the thing it describes (recording
  // ALONGSIDE the browser recognizer) is still broken on Android and
  // always will be.
  mobileAudioRecording: false
};

// Cloudinary — fill these in from your account (see audioStorage.js).
export const CLOUDINARY = {
  cloudName: "k1oewkfv",      // from your Cloudinary dashboard
  uploadPreset: "twisterverse"  // must be an UNSIGNED preset
};
