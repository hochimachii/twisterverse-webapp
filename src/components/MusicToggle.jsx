import { useMusic } from "../context/MusicContext";
import "../styles/MusicToggle.css";

/**
 * Switches the background music off and back on. Every screen that plays
 * music places its own copy at the top right (MusicToggle.css has the
 * placements), and all of them share the one setting in MusicContext.
 */
export default function MusicToggle({ className = "" }) {
  const { muted, toggleMuted } = useMusic();
  const label = muted ? "Buksan ang musika" : "Patayin ang musika";

  // The toggle keeps its events to itself: a tap on the story scenes
  // advances them, the ending also listens for Enter and Space, and
  // MusicPlayer starts the music on the first touch anywhere - which,
  // when that touch is a tap on "off", would play a burst of it first.
  const keepToSelf = (e) => e.stopPropagation();

  return (
    <button
      type="button"
      className={["music-toggle", muted && "music-toggle--off", className].filter(Boolean).join(" ")}
      onClick={(e) => {
        e.stopPropagation();
        toggleMuted();
      }}
      onTouchStart={keepToSelf}
      onKeyDown={keepToSelf}
      aria-label={label}
      title={label}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path
          d="M9 17.6V6.2l10-2.2v11.4"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="6.6" cy="17.6" r="2.5" fill="currentColor" />
        <circle cx="16.6" cy="15.4" r="2.5" fill="currentColor" />
        {muted && (
          <>
            {/* A band of the button's own colour under the slash, so it
                reads as cutting through the note. */}
            <line className="music-toggle__gap" x1="3.5" y1="3.5" x2="20.5" y2="20.5" />
            <line className="music-toggle__slash" x1="3.5" y1="3.5" x2="20.5" y2="20.5" />
          </>
        )}
      </svg>
    </button>
  );
}
