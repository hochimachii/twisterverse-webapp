import { useEffect, useRef } from "react";

const TARGET_VOLUME = 0.8;
// Under recorded narration (the opening scene): low enough for the voices
// to carry, loud enough that the scene doesn't drop into silence between
// lines.
const DUCKED_VOLUME = 0.2;
const FADE_STEP = 0.05;
const FADE_INTERVAL_MS = 100;

// iOS Safari ignores audio.volume entirely - the hardware buttons own the
// level, and the property always reads back 1 - so a lower level cannot
// be set there. Pausing is the only way to keep the music off the
// narration on those devices.
const CAN_SET_VOLUME = (() => {
  try {
    const probe = document.createElement("audio");
    probe.volume = 0.5;
    return probe.volume !== 1;
  } catch {
    return false;
  }
})();

/**
 * Background music player with crossfading between tracks.
 *
 * Mobile browsers deliberately keep <audio> playing when the tab is
 * backgrounded or the browser is closed — that's the behavior music and
 * podcast sites rely on, so it has to be explicitly opted out of. This
 * pauses on every "the user has left" signal and resumes when they
 * return:
 *
 *   visibilitychange → tab hidden/shown (backgrounding, tab switching,
 *                      locking the phone)
 *   pagehide         → the iOS-reliable version of unload; mobile Safari
 *                      often does NOT fire "beforeunload"/"unload"
 *   freeze           → Chrome discarding a backgrounded tab
 *
 * `ducked` lowers the music under voice-over (see App.jsx), gliding
 * rather than jumping - or pauses it where the volume can't be set.
 */
export default function MusicPlayer({ src, ducked = false }) {
  const audioRef = useRef(null);
  const fadeTimerRef = useRef(null);
  // Whether music *should* be playing — so returning to the tab doesn't
  // resume audio that was paused because the user backgrounded the app
  // mid-fade, and so background-pause survives a crossfade.
  const shouldPlayRef = useRef(true);
  // The level fades head for. A ref, not a constant, so a fade already in
  // flight lands on the ducked level when ducking starts partway through.
  const targetVolumeRef = useRef(ducked ? DUCKED_VOLUME : TARGET_VOLUME);
  // True while ducking has had to fall back to pausing (no volume control).
  // Every path that starts playback checks it, so returning to the tab or
  // tapping the page can't bring the music back over the narration.
  const silencedRef = useRef(ducked && !CAN_SET_VOLUME);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const clearFade = () => {
      if (fadeTimerRef.current) {
        clearInterval(fadeTimerRef.current);
        fadeTimerRef.current = null;
      }
    };

    const safePlay = () => {
      if (silencedRef.current) return;
      const attempt = audio.play();
      if (attempt && typeof attempt.catch === "function") {
        attempt.catch(() => {
          // Autoplay blocked until first interaction — handled below.
        });
      }
    };

    const fadeIn = () => {
      clearFade();
      let vol = 0;
      audio.volume = 0;
      fadeTimerRef.current = setInterval(() => {
        if (!shouldPlayRef.current) {
          clearFade();
          return;
        }
        // Read every tick: ducking may have changed the target mid-fade.
        const target = targetVolumeRef.current;
        if (vol + FADE_STEP < target) {
          vol += FADE_STEP;
          audio.volume = vol;
        } else {
          audio.volume = target;
          clearFade();
        }
      }, FADE_INTERVAL_MS);
    };

    const fadeOutAndSwap = () => {
      clearFade();
      let vol = audio.volume;
      fadeTimerRef.current = setInterval(() => {
        if (vol > 0) {
          vol -= FADE_STEP;
          audio.volume = Math.max(vol, 0);
        } else {
          clearFade();
          audio.pause();
          audio.src = src;
          audio.load();
          if (shouldPlayRef.current && !document.hidden && !silencedRef.current) {
            const attempt = audio.play();
            if (attempt && typeof attempt.then === "function") {
              attempt.then(fadeIn).catch((err) => {
                console.warn("Autoplay blocked:", err);
              });
            } else {
              fadeIn();
            }
          }
        }
      }, FADE_INTERVAL_MS);
    };

    // --- Background / foreground handling ---
    const pauseForBackground = () => {
      clearFade();
      audio.pause();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseForBackground();
      } else if (shouldPlayRef.current) {
        safePlay();
      }
    };

    const handleFirstInteraction = () => {
      if (shouldPlayRef.current && !document.hidden) safePlay();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("pagehide", pauseForBackground);
    window.addEventListener("freeze", pauseForBackground);
    document.addEventListener("click", handleFirstInteraction, { once: true });
    document.addEventListener("touchstart", handleFirstInteraction, { once: true });

    // --- Start or crossfade ---
    if (!audio.src || audio.src.endsWith(src)) {
      audio.volume = targetVolumeRef.current;
      if (!document.hidden) safePlay();
    } else {
      fadeOutAndSwap();
    }

    return () => {
      // Clearing the fade timer here is what stops an in-flight fade
      // from continuing to write to an audio element that's already
      // been unmounted or had its src swapped.
      clearFade();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("pagehide", pauseForBackground);
      window.removeEventListener("freeze", pauseForBackground);
      document.removeEventListener("click", handleFirstInteraction);
      document.removeEventListener("touchstart", handleFirstInteraction);
    };
  }, [src]);

  // --- Ducking under voice-over ---
  // Declared after the effect above so that, when a route change swaps the
  // track AND the duck together, the crossfade has already started by the
  // time this runs.
  useEffect(() => {
    const audio = audioRef.current;
    targetVolumeRef.current = ducked ? DUCKED_VOLUME : TARGET_VOLUME;
    if (!audio) return;

    if (!CAN_SET_VOLUME) {
      silencedRef.current = ducked;
      if (ducked) {
        audio.pause();
      } else if (!fadeTimerRef.current && shouldPlayRef.current && !document.hidden) {
        // Resume - unless a crossfade is under way, which starts the
        // next track itself when it finishes.
        audio.play().catch(() => {});
      }
      return;
    }

    // A crossfade in flight reads targetVolumeRef on every tick, so it
    // already lands on the new level. Cutting it short here would also
    // cancel the track swap it ends with.
    if (fadeTimerRef.current) return;

    const glide = setInterval(() => {
      const target = targetVolumeRef.current;
      const diff = target - audio.volume;
      if (Math.abs(diff) <= FADE_STEP) {
        audio.volume = target;
        clearInterval(glide);
        if (fadeTimerRef.current === glide) fadeTimerRef.current = null;
      } else {
        audio.volume = Math.min(1, Math.max(0, audio.volume + Math.sign(diff) * FADE_STEP));
      }
    }, FADE_INTERVAL_MS);
    // Shares the fade slot, so a track change clears it like any fade.
    fadeTimerRef.current = glide;
  }, [ducked]);

  return <audio ref={audioRef} src={src} loop hidden preload="auto" />;
}
