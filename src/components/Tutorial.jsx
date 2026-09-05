import { useState } from "react";
import "../styles/Tutorial.css";

// Shown once, the first time a student reaches the activity screen.
// "Seen" is tracked per-user in localStorage so it doesn't reappear on
// every level, but a student on a new device gets it again (harmless,
// and better than never showing it).
const SEEN_KEY = "seenActivityTutorial";

export function hasSeenTutorial(username) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || [];
    return seen.includes(username || "guest");
  } catch {
    return false;
  }
}

export function markTutorialSeen(username) {
  try {
    const seen = JSON.parse(localStorage.getItem(SEEN_KEY)) || [];
    const key = username || "guest";
    if (!seen.includes(key)) {
      seen.push(key);
      localStorage.setItem(SEEN_KEY, JSON.stringify(seen));
    }
  } catch {
    // Storage unavailable (private mode) — the tutorial just shows again.
  }
}

const STEPS = [
  {
    icon: "\uD83D\uDC42",
    title: "Makinig muna",
    body:
      "Babasahin ng kaibigan mo sa mundong ito ang hamon sa pagbigkas. Basahin at intindihin muna ito bago magsimula."
  },
  {
    icon: "\uD83C\uDF99\uFE0F",
    title: "Pindutin ang mikropono",
    body:
      "Pindutin ang \u201CSimulan ang Pagbigkas\u201D kapag handa ka na. Papayagan mo muna ang mic sa browser mo \u2014 isang beses lang ito."
  },
  {
    icon: "\u23F1\uFE0F",
    title: "May 5 segundo ka",
    body:
      "Bigkasin ang buong pangungusap nang mabilis at malinaw bago maubos ang oras. Kapag naubos ang oras, kailangan mong ulitin."
  },
  {
    icon: "\u2B50",
    title: "Kumita ng puntos",
    body:
      "Mas mabilis kang matapos, mas mataas ang puntos mo. Ang bawat pag-ulit ay may kaunting bawas \u2014 kaya subukang tamaan agad!"
  }
];

export default function Tutorial({ onFinish }) {
  const [step, setStep] = useState(0);
  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  return (
    <div className="tutorial-overlay" role="dialog" aria-modal="true">
      <div className="tutorial-card">
        <div className="tutorial-card__stripe" />
        <span className="tutorial-card__icon" aria-hidden="true">
          {current.icon}
        </span>
        <h2 className="tutorial-card__title">{current.title}</h2>
        <p className="tutorial-card__body">{current.body}</p>

        <div className="tutorial-card__dots" aria-hidden="true">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`tutorial-dot ${i === step ? "tutorial-dot--active" : ""}`}
            />
          ))}
        </div>

        <div className="tutorial-card__actions">
          <button className="tutorial-skip" onClick={onFinish}>
            Laktawan
          </button>
          <button
            className="tutorial-next"
            onClick={() => (isLast ? onFinish() : setStep((s) => s + 1))}
          >
            {isLast ? "Handa na ako!" : "Susunod"}
          </button>
        </div>
      </div>
    </div>
  );
}
