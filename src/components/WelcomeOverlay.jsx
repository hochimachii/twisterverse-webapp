import { useEffect, useState } from "react";
import twistyImg from "../assets/login/twisty.PNG";
import "../styles/WelcomeOverlay.css";

export default function WelcomeOverlay({ onFinish, duration = 1900 }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const exitTimer = setTimeout(() => setLeaving(true), duration - 400);
    const doneTimer = setTimeout(() => {
      setVisible(false);
      if (onFinish) onFinish();
    }, duration);

    return () => {
      clearTimeout(exitTimer);
      clearTimeout(doneTimer);
    };
  }, [onFinish, duration]);

  if (!visible) return null;

  const title = "Twister";
  const subtitle = "Verse";

  return (
    <div
      className={`welcome-overlay ${leaving ? "welcome-overlay--leaving" : ""}`}
      role="status"
      aria-live="polite"
    >
      <div className="welcome-overlay__glow" />

      {/* Bunting flags drifting/swaying like the fiesta banners in the art */}
      <div className="welcome-overlay__bunting" aria-hidden="true">
        {Array.from({ length: 9 }).map((_, i) => (
          <span key={i} className={`bunting-flag bunting-flag-${i + 1}`} />
        ))}
      </div>

      <div className="welcome-overlay__content">
        {/* Mascot hops/runs in from the side, matching her running pose */}
        <img
          src={twistyImg}
          alt=""
          aria-hidden="true"
          className="welcome-overlay__mascot"
        />

        <h1 className="welcome-overlay__title">
          <span className="welcome-overlay__word welcome-overlay__word--twister">
            {title.split("").map((char, i) => (
              <span
                key={`t-${i}`}
                className="welcome-overlay__letter"
                style={{ animationDelay: `${0.35 + i * 0.045}s` }}
              >
                {char}
              </span>
            ))}
          </span>
          <span className="welcome-overlay__word welcome-overlay__word--verse">
            {subtitle.split("").map((char, i) => (
              <span
                key={`v-${i}`}
                className="welcome-overlay__letter"
                style={{
                  animationDelay: `${0.35 + (title.length + i) * 0.045}s`
                }}
              >
                {char}
              </span>
            ))}
          </span>
        </h1>

        <div className="welcome-overlay__underline" />
      </div>
    </div>
  );
}
