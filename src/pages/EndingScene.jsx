import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import endingArt from "../assets/twisty/ending_sequence.PNG";
import "../styles/EndingScene.css";

// The closing sequence, shown once a student clears the final level of
// Mundo 4. Until now that moment produced only a small card, which is a
// thin payoff for eighty tongue twisters.
//
// CAMERA APPROACH: there is one piece of art, so the "cinematography" is
// a virtual camera moving across it - scale plus transform-origin, with
// a long transition, which reads as a slow push-in and pan. The origin
// percentages below are focal points measured against
// ending_sequence.PNG: the crown sits high and slightly left of centre,
// Twisty's face just below it, and the glowing book to the right.
// If the artwork is ever replaced, these four numbers are what to
// re-measure.
//
// SCRIPT: beats 1 and 2 are the client's own closing line from
// worlds.js (Mundo 4 keyLine), split in two so the camera has time to
// travel. Beat 3 carries NO text on purpose - the pan to the book is
// the beat, and inventing narration for the client's story is not ours
// to do. Beat 4's line reuses "Master ng Diksiyon", the phrase Haring
// Kiko Kwela already uses in his Mundo 4 greeting.
const BEATS = [
  {
    // Push in on the crown.
    scale: 2.6,
    x: 40,
    y: 24,
    hold: 5000,
    text:
      "Sa huling hakbang, bumubuo ng korona ng diksiyon si Twisty…"
  },
  {
    // Pull back to Twisty herself.
    scale: 1.7,
    x: 40,
    y: 36,
    hold: 5000,
    text: "…at nagtagumpay sa lahat ng hamon."
  },
  {
    // Pan across to the glowing book. Silent by design.
    scale: 2.1,
    x: 81,
    y: 41,
    hold: 3500,
    text: ""
  },
  {
    // Settle on the full scene.
    scale: 1,
    x: 50,
    y: 50,
    hold: null, // waits for the student
    title: "Master ng Diksiyon",
    text: "Ikaw na ngayon ang Master ng Diksiyon!"
  }
];

export default function EndingScene() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const timerRef = useRef(null);

  const beat = BEATS[index];
  const isLast = index === BEATS.length - 1;

  const advance = useCallback(() => {
    setIndex((i) => Math.min(i + 1, BEATS.length - 1));
  }, []);

  // Auto-advance, but every beat is also tappable - a child who wants to
  // read at their own pace should never be waiting on a timer.
  useEffect(() => {
    clearTimeout(timerRef.current);
    if (beat.hold) {
      timerRef.current = setTimeout(advance, beat.hold);
    }
    return () => clearTimeout(timerRef.current);
  }, [index, beat.hold, advance]);

  const finish = () => navigate("/dashboard");

  return (
    <div
      className="ending-scene"
      onClick={isLast ? undefined : advance}
      role={isLast ? undefined : "button"}
      tabIndex={isLast ? undefined : 0}
      onKeyDown={(e) => {
        if (!isLast && (e.key === "Enter" || e.key === " ")) advance();
      }}
    >
      <div className="ending-scene__stage">
        <img
          src={endingArt}
          alt="Si Twisty na suot ang Korona ng Diksiyon"
          className="ending-scene__art"
          style={{
            transform: `scale(${beat.scale})`,
            transformOrigin: `${beat.x}% ${beat.y}%`
          }}
        />
        <div className="ending-scene__vignette" aria-hidden="true" />
      </div>

      <div className="ending-scene__caption">
        {beat.title && <h1 className="ending-scene__title">{beat.title}</h1>}
        {beat.text && (
          // Keyed so React remounts the node each beat and the fade-in
          // replays instead of the text swapping silently.
          <p key={index} className="ending-scene__text">
            {beat.text}
          </p>
        )}

        {isLast ? (
          <button className="ending-scene__btn" onClick={finish}>
            {"🏠"} Bumalik sa Dashboard
          </button>
        ) : (
          <span className="ending-scene__hint">Pindutin para magpatuloy</span>
        )}
      </div>

      {!isLast && (
        <button
          className="ending-scene__skip"
          onClick={(e) => {
            e.stopPropagation();
            setIndex(BEATS.length - 1);
          }}
        >
          Laktawan
        </button>
      )}

      <div className="ending-scene__progress" aria-hidden="true">
        {BEATS.map((_, i) => (
          <span
            key={i}
            className={`ending-scene__dot ${i <= index ? "is-on" : ""}`}
          />
        ))}
      </div>
    </div>
  );
}
