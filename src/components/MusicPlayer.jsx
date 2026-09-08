import { useEffect, useRef } from "react";

const TARGET_VOLUME = 0.8;
const FADE_STEP = 0.05;
const FADE_INTERVAL_MS = 100;

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
 */
export default function MusicPlayer({ src }) {
  const audioRef = useRef(null);
  const fadeTimerRef = useRef(null);
  // Whether music *should* be playing — so returning to the tab doesn't
  // resume audio that was paused because the user backgrounded the app
  // mid-fade, and so background-pause survives a crossfade.
  const shouldPlayRef = useRef(true);

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
        if (vol < TARGET_VOLUME) {
          vol += FADE_STEP;
          audio.volume = Math.min(vol, TARGET_VOLUME);
        } else {
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
          if (shouldPlayRef.current && !document.hidden) {
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
      audio.volume = TARGET_VOLUME;
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

  return <audio ref={audioRef} src={src} loop hidden preload="auto" />;
}
