import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";
import { getWorld } from "../data/worlds";
import { useAuth } from "../context/AuthContext";
import { markLevelComplete, loadWorldProgress } from "../services/progressService";
import { logAttempt } from "../services/attemptsService";
import {
  needsServerTranscription,
  speechUnavailableOnPlatform,
  platformLacksBrowserSpeech,
  pickRecordingFormat,
  transcribeOnServer,
  hasAudibleAudio
} from "../services/speechService";
import { scoreRecitation, tierForSimilarity, tokenizeWords } from "../utils/speechScoring";
import { FEATURES } from "../config";
import { calculateScore } from "../utils/scoring";
import Tutorial, { hasSeenTutorial, markTutorialSeen } from "../components/Tutorial";
import "../styles/TwisterActivity.css";

import twistyHappy from "../assets/twisty/twisty-happy.PNG";
import twistySad from "../assets/twisty/twisty-sad.PNG";
import twistyMad from "../assets/twisty/twisty-mad.PNG";
import twistyNeutral from "../assets/twisty/twisty-neutral.PNG";

const TWISTY_SPRITES = {
  neutral: twistyNeutral,
  happy: twistyHappy,
  sad: twistySad,
  mad: twistyMad
};

const RECITE_SECONDS = 5;

export default function TwisterActivity() {
  const location = useLocation();
  const navigate = useNavigate();
  const { username, uid, isGuest } = useAuth();
  const { world, level } = location.state || { world: 1, level: 1 };

  const worldData = getWorld(world);
  const currentTwister = worldData?.twisters[level - 1];

  // Platforms where the browser's Web Speech API is unavailable
  // (iOS/Safari, Messenger/Facebook in-app browsers) record audio and
  // transcribe server-side instead.
  // Server transcription requires a signed-in user: the callable rejects
  // anonymous callers so a paid endpoint isn't open to the whole internet.
  // A guest therefore falls back to the browser recognizer, which still
  // works fine on Android and desktop.
  const signedIn = Boolean(uid) && !isGuest;
  const useServerMode = needsServerTranscription() && signedIn;
  // Whether to run MediaRecorder ALONGSIDE the browser's speech
  // recognition, purely to capture audio for the Teacher Dashboard.
  // On mobile this is gated behind a flag because two things holding
  // the mic at once previously appeared to break Android recognition —
  // see FEATURES.mobileAudioRecording in src/config.js.
  const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const captureAudioAlongside =
    !useServerMode &&
    FEATURES.audioRecordingUpload &&
    (!isMobile || FEATURES.mobileAudioRecording);
  // iOS/in-app browser with no server transcription available (Spark
  // plan). Say so honestly instead of letting them tap a mic button
  // that can't work and blaming their internet connection.
  const platformUnsupported = speechUnavailableOnPlatform();
  // iOS and in-app browsers have NO browser recognizer to fall back to, so
  // a guest there cannot play at all - the server is the only path and it
  // needs an account. Say so plainly rather than letting the attempt fail
  // as a misleading network error.
  const needsLoginForSpeech =
    !signedIn && platformLacksBrowserSpeech() && FEATURES.serverTranscription;

  const [feedback, setFeedback] = useState("");
  const [feedbackTier, setFeedbackTier] = useState("");
  const [showValidation, setShowValidation] = useState(false);
  const [checking, setChecking] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(RECITE_SECONDS);
  const [earnedKey, setEarnedKey] = useState(null);
  const [recording, setRecording] = useState(false);
  const [heardText, setHeardText] = useState("");
  const [lastScore, setLastScore] = useState(null);
  const [attempts, setAttempts] = useState(0);
  const [showTutorial, setShowTutorial] = useState(false);

  const awaitingResultRef = useRef(false);
  const attemptActiveRef = useRef(false);
  const wasListeningRef = useRef(false);
  const transcriptRef = useRef("");
  // Only the FINAL recognition result is graded; see the polling
  // effect below for why the interim one can't be trusted.
  const finalTranscriptRef = useRef("");
  // True once an attempt has been scored, which freezes the displayed
  // transcript so it always matches what the score was based on.
  const gradedRef = useRef(false);
  // Set when an attempt ends before its recording is worth
  // transcribing (a timeout). The recorder still has to shut down
  // cleanly, so this is a flag rather than dropping the onstop handler.
  const skipTranscriptionRef = useRef(false);
  // The live microphone stream. Both recorders release their own stream
  // in onstop, but onstop never runs if an attempt is abandoned - the
  // student leaves the page, or moves to the next level (same route, so
  // the component re-renders instead of unmounting). Without this the
  // old stream stays open and the next attempt opens a SECOND mic.
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const formatRef = useRef(pickRecordingFormat());
  const finishedAtSecondsRef = useRef(RECITE_SECONDS);
  // Resolves to a base64 data URL for the current attempt's recording,
  // or null when audio capture is off/unavailable.
  const audioPromiseRef = useRef(null);
  const audioResolveRef = useRef(null);

  const {
    transcript,
    finalTranscript,
    listening,
    resetTranscript,
    browserSupportsSpeechRecognition,
    isMicrophoneAvailable
  } = useSpeechRecognition();

  useEffect(() => {
    transcriptRef.current = transcript;
    // Stop updating the displayed text once the attempt has been graded.
    // The browser delivers its final result AFTER grading has already
    // happened, and letting it through replaced the text on screen with
    // something the score was never based on — a student saw a perfect
    // transcript sitting under "may mali sa pagbigkas".
    if (!useServerMode && transcript && !gradedRef.current) {
      setHeardText(transcript);
    }
  }, [transcript, useServerMode]);

  useEffect(() => {
    finalTranscriptRef.current = finalTranscript || "";
  }, [finalTranscript]);

  // First-time walkthrough
  useEffect(() => {
    if (!hasSeenTutorial(username)) setShowTutorial(true);
  }, [username]);

  /** Hard-releases the microphone: stops any live recorder, drops the
   *  stream, and aborts recognition. Safe to call when nothing is running.
   *  This is what guarantees the mic indicator goes away when a student
   *  abandons an attempt instead of finishing it. */
  const releaseMicrophone = useCallback(() => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      try {
        rec.onstop = null;
        rec.stop();
      } catch (err) {
        console.warn("Could not stop recorder:", err);
      }
    }
    mediaRecorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (audioResolveRef.current) {
      audioResolveRef.current(null);
      audioResolveRef.current = null;
    }
    try {
      if (SpeechRecognition.abortListening) SpeechRecognition.abortListening();
    } catch (err) {
      console.warn("Could not abort recognition:", err);
    }
  }, []);

  const resetForLevel = useCallback(() => {
    releaseMicrophone();
    if (resetTranscript) resetTranscript();
    setFeedback("");
    setFeedbackTier("");
    setShowValidation(false);
    setChecking(false);
    setSecondsLeft(RECITE_SECONDS);
    setEarnedKey(null);
    setHeardText("");
    setLastScore(null);
    setAttempts(0);
    awaitingResultRef.current = false;
    attemptActiveRef.current = false;
    wasListeningRef.current = false;
    transcriptRef.current = "";
    finalTranscriptRef.current = "";
    gradedRef.current = false;
  }, [resetTranscript, releaseMicrophone]);

  useEffect(() => {
    resetForLevel();
  }, [level, world, resetForLevel]);

  // Leaving the activity mid-attempt must not leave the mic open.
  useEffect(() => releaseMicrophone, [releaseMicrophone]);

  // ---------- Scoring / result handling ----------

  const finishAttempt = useCallback(
    async (spokenText, forcedTier) => {
      gradedRef.current = true;
      setChecking(false);
      setShowValidation(true);
      setHeardText(spokenText);

      const attemptNumber = attempts + 1;
      setAttempts(attemptNumber);

      // Timed out — automatic fail regardless of what was said.
      if (forcedTier === "timeout") {
        setFeedback("\u23F0 Ubos na ang oras! Subukan ulit nang mas mabilis.");
        setFeedbackTier("timeout");
        logAttempt({
          uid, username, world, level,
          twister: currentTwister,
          transcript: spokenText,
          similarity: 0,
          tier: "timeout",
          points: 0,
          audioDataUrl: await getCapturedAudio()
        });
        return;
      }

      // Nothing captured — a mic/engine failure, NOT a wrong recitation,
      // so it isn't logged as a failed attempt against the student.
      if (!spokenText || !spokenText.trim()) {
        setFeedback(
          "\u26A0\uFE0F Walang narinig na boses. Tiyaking pinayagan ang mic, tapos subukan ulit."
        );
        setFeedbackTier("error");
        return;
      }

      const similarity = scoreRecitation(currentTwister, spokenText);
      const tier = tierForSimilarity(similarity);
      setFeedbackTier(tier);

      let points = 0;
      if (tier === "perfect" || tier === "pass") {
        const scoreResult = calculateScore({
          secondsLeft: finishedAtSecondsRef.current,
          totalSeconds: RECITE_SECONDS,
          attempts: attemptNumber,
          tier
        });
        points = scoreResult.total;
        setLastScore(scoreResult);
        setFeedback(
          tier === "perfect"
            ? "\u2705 Perpekto! Ang linaw ng pagbigkas mo!"
            : "\u2705 Tama ang pagbigkas! Magaling!"
        );
        await saveProgress(points);
      } else if (tier === "close") {
        setFeedback("\u26A0\uFE0F Malapit na! Konting ayos pa sa pagbigkas.");
      } else {
        setFeedback("\u274C Ulitin mo, may mali sa pagbigkas.");
      }

      logAttempt({
        uid, username, world, level,
        twister: currentTwister,
        transcript: spokenText,
        similarity,
        tier,
        points,
        audioDataUrl: await getCapturedAudio()
      });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [attempts, currentTwister, uid, username, world, level]
  );

  const saveProgress = async (points) => {
    const prevCount = (await loadWorldProgress(isGuest, uid, world)).length;
    await markLevelComplete(isGuest, uid, world, level, points);
    const newCount = (await loadWorldProgress(isGuest, uid, world)).length;
    if (
      worldData &&
      prevCount < worldData.twisters.length &&
      newCount >= worldData.twisters.length
    ) {
      setEarnedKey(worldData);
    }
  };

  // ---------- Audio recording (server mode) ----------

  // Side-recorder: captures audio purely for teacher playback while the
  // browser's own SpeechRecognition does the grading. Entirely
  // best-effort — if the mic can't be opened, the attempt proceeds
  // normally with no recording.
  const startSideRecording = async () => {
    // NOTE: only ever called on desktop — see captureAudioAlongside and
    // the findings recorded in src/config.js. On Android, opening any
    // audio stream alongside SpeechRecognition starves the recognizer,
    // so mobile never takes this path.
    console.log("[audio] starting side recording");
    audioPromiseRef.current = new Promise((resolve) => {
      audioResolveRef.current = resolve;
    });

    if (!navigator.mediaDevices || !window.MediaRecorder) {
      audioResolveRef.current(null);
      return;
    }

    try {
      const { mimeType } = formatRef.current;
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        // Release the mic immediately so nothing holds it between
        // attempts.
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
        const blob = new Blob(audioChunksRef.current, {
          type: recorder.mimeType || "audio/webm"
        });
        console.log("[audio] captured blob:", blob.size, "bytes,", blob.type);
        audioResolveRef.current(blob);
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
    } catch (err) {
      console.warn("[audio] side capture unavailable:", err);
      audioResolveRef.current(null);
    }
  };

  const stopSideRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") {
      rec.stop();
    } else if (audioResolveRef.current) {
      audioResolveRef.current(null);
    }
  };

  /** Waits briefly for the side recording, then gives up so logging is
   *  never blocked by a slow encode. */
  const getCapturedAudio = async () => {
    if (!audioPromiseRef.current) {
      console.log("[audio] no recording for this attempt (captureAudioAlongside =", captureAudioAlongside, ")");
      return null;
    }
    return Promise.race([
      audioPromiseRef.current,
      new Promise((r) => setTimeout(() => r(null), 2000))
    ]);
  };

  const startRecording = async () => {
    audioChunksRef.current = [];
    skipTranscriptionRef.current = false;
    // The transcription recording doubles as the teacher's playback copy.
    // It's the same audio, already in hand — there's no reason to ask the
    // student's microphone to do the job twice (and on Android it can't:
    // see FEATURES.mobileAudioRecording).
    audioPromiseRef.current = new Promise((resolve) => {
      audioResolveRef.current = resolve;
    });
    const { mimeType } = formatRef.current;
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
    };

    recorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setRecording(false);
      setChecking(true);

      const blob = new Blob(audioChunksRef.current, {
        type: recorder.mimeType || "audio/webm"
      });

      // Hand the recording over for teacher playback before anything else
      // can return early — a timed-out or silent attempt is often the one
      // a teacher most wants to listen back to.
      if (audioResolveRef.current) audioResolveRef.current(blob);

      // Timed out: graded already, nothing to transcribe, but the stream
      // above still had to be released.
      if (skipTranscriptionRef.current) {
        skipTranscriptionRef.current = false;
        return;
      }

      // A silent recording must never reach the recognizer: it invents
      // confident nonsense from silence, which would then be scored as a
      // wrong recitation and logged against the student. An empty
      // transcript routes to the "Walang narinig na boses" branch below,
      // which correctly treats this as a mic failure rather than a
      // failed attempt. See hasAudibleAudio for the measurements.
      if (!(await hasAudibleAudio(blob))) {
        finishAttempt("");
        return;
      }

      const reader = new FileReader();
      reader.onloadend = async () => {
        try {
          const spoken = await transcribeOnServer(
            reader.result,
            formatRef.current.encoding,
            tokenizeWords(currentTwister || "")
          );
          finishAttempt(spoken);
        } catch (err) {
          console.error("Server transcription failed:", err);
          setChecking(false);
          setShowValidation(true);
          setFeedback(
            err?.code === "functions/unauthenticated"
              ? "\u26A0\uFE0F Kailangan mong mag-log in bago gumana ang pagbigkas dito."
              : "\u26A0\uFE0F Hindi ma-proseso ang boses. Tingnan ang internet mo, tapos subukan ulit."
          );
          setFeedbackTier("error");
        }
      };
      reader.onerror = () => {
        setChecking(false);
        setShowValidation(true);
        setFeedback("\u26A0\uFE0F May problema sa recording. Subukan ulit.");
        setFeedbackTier("error");
      };
      reader.readAsDataURL(blob);
    };

    mediaRecorderRef.current = recorder;
    recorder.start();
    setRecording(true);
  };

  const stopRecording = () => {
    const rec = mediaRecorderRef.current;
    if (rec && rec.state !== "inactive") rec.stop();
  };

  // ---------- Start / stop ----------

  const handleStart = async () => {
    setFeedback("");
    setFeedbackTier("");
    setShowValidation(false);
    setHeardText("");
    setSecondsLeft(RECITE_SECONDS);
    finishedAtSecondsRef.current = RECITE_SECONDS;

    if (useServerMode) {
      try {
        await startRecording();
      } catch (err) {
        console.error("Mic unavailable:", err);
        setShowValidation(true);
        setFeedback(
          "\u26A0\uFE0F Hindi ma-access ang mic. Payagan ang mikropono sa settings ng browser mo."
        );
        setFeedbackTier("error");
      }
      return;
    }

    resetTranscript();
    transcriptRef.current = "";
    finalTranscriptRef.current = "";
    gradedRef.current = false;
    audioPromiseRef.current = null;
    // Order matters: speech recognition starts FIRST and is never
    // awaited behind the recorder. Recognition is what grades the
    // attempt, so if the two ever contend for the microphone, the
    // grading path must be the one that wins. The recorder is purely
    // for teacher playback and is allowed to fail.
    SpeechRecognition.startListening({
      continuous: true,
      interimResults: true,
      language: "fil-PH"
    });
    if (captureAudioAlongside) {
      // Desktop only. Not awaited — recognition must never wait on the
      // recorder.
      startSideRecording();
    }
    attemptActiveRef.current = true;
  };

  const handleStop = () => {
    finishedAtSecondsRef.current = secondsLeft;
    if (useServerMode) {
      stopRecording();
      return;
    }
    if (captureAudioAlongside) stopSideRecording();
    try {
      if (listening) {
        awaitingResultRef.current = true;
        SpeechRecognition.stopListening();
      }
    } catch (err) {
      console.error("Error stopping recognition:", err);
      setShowValidation(true);
      setFeedback("\u26A0\uFE0F Nagkaroon ng error sa mic, subukan muli.");
      setFeedbackTier("error");
    }
  };

  const isActive = useServerMode ? recording : listening;

  // ---------- Countdown ----------

  useEffect(() => {
    if (!isActive) return undefined;
    const interval = setInterval(() => {
      setSecondsLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [isActive]);

  useEffect(() => {
    if (isActive && secondsLeft === 0) {
      finishedAtSecondsRef.current = 0;
      awaitingResultRef.current = false;
      attemptActiveRef.current = false;
      wasListeningRef.current = false;
      if (useServerMode) {
        const rec = mediaRecorderRef.current;
        if (rec && rec.state !== "inactive") {
          // Skip transcription — it's already a fail — but let onstop run,
          // so the microphone stream is released and the recording still
          // reaches the teacher's log. Dropping the handler here left the
          // mic open after every timed-out attempt.
          skipTranscriptionRef.current = true;
          rec.stop();
        } else if (audioResolveRef.current) {
          audioResolveRef.current(null);
        }
        setRecording(false);
      } else {
        try {
          SpeechRecognition.stopListening();
        } catch (err) {
          console.error(err);
        }
        // Also stop the side recorder — without this the mic stays open
        // after a timeout and its promise never resolves.
        if (captureAudioAlongside) stopSideRecording();
      }
      // Pass whatever was captured so far: the tier is a forced fail
      // regardless, but the student and the teacher's attempt log both
      // benefit from seeing how far they actually got.
      finishAttempt(
        finalTranscriptRef.current || transcriptRef.current || "",
        "timeout"
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft, isActive]);

  // ---------- Browser-API validation (non-server mode) ----------

  useEffect(() => {
    if (useServerMode) return undefined;
    if (listening) {
      wasListeningRef.current = true;
      return undefined;
    }
    if (!wasListeningRef.current) return undefined;
    if (!awaitingResultRef.current && !attemptActiveRef.current) return undefined;

    wasListeningRef.current = false;
    awaitingResultRef.current = false;
    attemptActiveRef.current = false;
    setChecking(true);

    const startedAt = Date.now();
    const poll = setInterval(() => {
      // Grade the FINAL result, never an interim one. With
      // interimResults enabled the browser streams partial text while
      // the student is still speaking, so taking the first non-empty
      // value graded a half-finished sentence: "Tala tikling tumalon sa
      // tulay" was scored as "Tala tikling" and failed, while the full
      // (correct) text appeared on screen a moment later.
      const settled = finalTranscriptRef.current.trim();
      const expired = Date.now() - startedAt >= 2500;
      if (settled || expired) {
        clearInterval(poll);
        // If no final result ever arrives, fall back to the interim text
        // — a partial grade beats reporting a mic failure.
        finishAttempt(settled || transcriptRef.current);
      }
    }, 150);
    return () => clearInterval(poll);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening, useServerMode]);

  // ---------- Render ----------

  const spriteKey = !showValidation
    ? "neutral"
    : feedbackTier === "perfect" || feedbackTier === "pass"
    ? "happy"
    : feedbackTier === "close"
    ? "sad"
    : "mad";

  const isSuccess = feedbackTier === "perfect" || feedbackTier === "pass";
  const isLastLevelInWorld = worldData ? level >= worldData.twisters.length : true;
  const micUnavailable =
    !useServerMode &&
    !platformUnsupported &&
    !needsLoginForSpeech &&
    (!browserSupportsSpeechRecognition || isMicrophoneAvailable === false);

  if (!currentTwister) {
    return (
      <div className="activity-scene" style={{ backgroundImage: worldData ? `url(${worldData.cover})` : undefined }}>
        <button className="activity-back-btn" onClick={() => navigate("/stages")}>
          {"\u2B05\uFE0F"} Bumalik sa Mundo
        </button>
        <div className="activity-empty">
          <h1>Wala pang laman dito</h1>
          <p>Wala pang tongue twister para sa antas na ito.</p>
          <button className="back-btn" onClick={() => navigate("/stages")}>
            Bumalik sa Mundo
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="activity-scene" style={{ backgroundImage: `url(${worldData.cover})` }}>
      <button className="activity-back-btn" onClick={() => navigate("/stages")}>
        {"\u2B05\uFE0F"} Bumalik sa Mundo
      </button>

      {!showValidation && !isActive && !checking ? (
        worldData.guideArt ? (
          <img src={worldData.guideArt} alt="" aria-hidden="true" className="activity-guide-standee" />
        ) : (
          <div className="activity-guide-standee activity-guide-standee--pending">
            <span aria-hidden="true">{worldData.icon}</span>
          </div>
        )
      ) : (
        <img
          src={TWISTY_SPRITES[spriteKey]}
          alt=""
          aria-hidden="true"
          className={`twisty-standee twisty-standee--${spriteKey} ${isActive ? "twisty-standee--listening" : ""}`}
        />
      )}

      <div className={`dialogue-box dialogue-box--${feedbackTier || "default"}`}>
        <span className="dialogue-tag">
          Mundo {world} &middot; Antas {level}
        </span>

        {!showValidation ? (
          <>
            <p className="dialogue-text">
              <span className="dialogue-speaker">{worldData.guide}: </span>
              {currentTwister}
            </p>

            {needsLoginForSpeech ? (
              <p className="dialogue-warning">
                {"\u26A0\uFE0F"} Kailangan mong <strong>mag-log in</strong> para
                makapaglaro sa iPhone o sa in-app browser. Bumalik sa simula at
                pumasok gamit ang iyong username.
              </p>
            ) : platformUnsupported ? (
              <p className="dialogue-warning">
                {"\u26A0\uFE0F"} Hindi pa suportado ang iPhone, Safari, at in-app
                browser (Messenger/Facebook) sa ngayon. Pakibuksan ang laro sa
                <strong> Google Chrome sa Android o computer</strong> para makapagsalita.
              </p>
            ) : micUnavailable ? (
              <p className="dialogue-warning">
                {"\u26A0\uFE0F"} Hindi suportado ng browser mo ang speech recognition.
                Subukan ang Google Chrome.
              </p>
            ) : checking ? (
              <p className="dialogue-checking">
                {"\u23F3"} Sinusuri ang pagbigkas mo{"\u2026"}
              </p>
            ) : (
              <div className="dialogue-controls">
                {!isActive ? (
                  <button className="mic-btn" onClick={handleStart}>
                    {"\uD83C\uDF99\uFE0F"} Simulan ang Pagbigkas
                  </button>
                ) : (
                  <>
                    <button className="mic-btn mic-btn--stop" onClick={handleStop}>
                      {"\uD83D\uDED1"} Itigil
                    </button>
                    <div className="recite-timer" role="timer">
                      <div
                        className={`recite-timer__bar ${secondsLeft <= 2 ? "recite-timer__bar--urgent" : ""}`}
                        style={{ width: `${(secondsLeft / RECITE_SECONDS) * 100}%` }}
                      />
                      <span className="recite-timer__label">{secondsLeft}s</span>
                    </div>
                  </>
                )}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="dialogue-text dialogue-text--feedback">
              <span className="dialogue-speaker">Twisty: </span>
              {feedback}
            </p>
            <p className="dialogue-sub">
              <strong>Narinig:</strong> {heardText || "\u2014"}
            </p>

            {lastScore && isSuccess && (
              <div className="score-breakdown">
                <div className="score-breakdown__stars" aria-hidden="true">
                  {"\u2B50".repeat(lastScore.stars)}
                </div>
                <div className="score-breakdown__total">+{lastScore.total} puntos</div>
                <div className="score-breakdown__rows">
                  <span>Base: +{lastScore.base}</span>
                  <span>Bilis: +{lastScore.speedBonus}</span>
                  {lastScore.accuracyBonus > 0 && <span>Perpekto: +{lastScore.accuracyBonus}</span>}
                  {lastScore.penalty > 0 && <span className="score-penalty">Ulit: -{lastScore.penalty}</span>}
                </div>
              </div>
            )}

            <div className="dialogue-controls">
              {isSuccess ? (
                <>
                  <button
                    onClick={() => navigate("/activity", { state: { world, level: level + 1 } })}
                    disabled={isLastLevelInWorld}
                  >
                    {"\u27A1\uFE0F"} Susunod na Antas
                  </button>
                  <button className="secondary" onClick={() => navigate("/stages")}>
                    {"\uD83C\uDFE0"} Bumalik sa Menu
                  </button>
                </>
              ) : (
                <button className="retry-btn" onClick={handleStart}>
                  {"\uD83D\uDD04"} {feedbackTier === "close" ? "Subukan Ulit" : "Ulitin ang Pagbigkas"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {earnedKey && (
        <div className="key-overlay" role="status" aria-live="polite">
          <div className="key-card">
            <div className="key-card__stripe" />
            {earnedKey.keyArt ? (
              <>
                <img src={earnedKey.keyArt} alt="" aria-hidden="true" className="key-card__art" />
                <h2>Susi Nakuha!</h2>
                <p className="key-card__name">{earnedKey.keyName}</p>
              </>
            ) : (
              <>
                <img src={TWISTY_SPRITES.happy} alt="" aria-hidden="true" className="key-card__art key-card__art--twisty" />
                <h2>Natapos ang Huling Hamon!</h2>
              </>
            )}
            <p className="key-card__line">{earnedKey.keyLine}</p>
            <button onClick={() => setEarnedKey(null)}>Magpatuloy</button>
          </div>
        </div>
      )}

      {showTutorial && (
        <Tutorial
          onFinish={() => {
            markTutorialSeen(username);
            setShowTutorial(false);
          }}
        />
      )}
    </div>
  );
}
