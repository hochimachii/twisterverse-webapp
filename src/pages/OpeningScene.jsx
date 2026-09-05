import { useState } from "react";
import { useNavigate } from "react-router-dom";
import twistyNeutral from "../assets/twisty/twisty-neutral.PNG";
import twistyHappy from "../assets/twisty/twisty-happy.PNG";
import "../styles/OpeningScene.css";

// The opening scene, straight from the client's script (FTTEBA-Content,
// "Simula: Sa Mundo ng Keme-Keme"). Shown once, right after a new
// profile is created (ProfileSetup navigates here instead of straight
// to /dashboard) — see App.jsx for the /intro route.
//
// No dedicated library background or full-body Twisty art exists yet
// (no image-generation tool is available to produce those here either).
//
// Layout approach: the SVG <LibraryScene> below is a purely decorative
// backdrop (shelves/window/floor) — it's allowed to crop at screen
// edges without hurting anything. The desk, book, and Twisty are all
// plain CSS-positioned elements sharing one coordinate system (percent/
// flex, not SVG viewBox math), so they stay aligned with each other at
// any screen size. Twisty sits behind the desk panel via z-index, which
// hides however much of her sprite is cropped off — swap in real
// full-body art later by replacing the twisty-*.PNG imports below.
const BEATS = [
  {
    book: "closed",
    text:
      "Sa isang tahimik na hapon sa silid-aklatan ng paaralan, may isang batang masayahin at mausisa na nagngangalang Twisty.",
    sprite: "neutral"
  },
  {
    book: "closed",
    text:
      "Kilala siya sa kanilang klase bilang batang mahilig maglaro ng mga salita at magbaluktot ng dila sa kahit anong tongue twister.",
    sprite: "neutral"
  },
  {
    book: "glowing",
    text:
      "Habang naglalakad siya sa pagitan ng matataas na estante ng mga aklat, may napansin siyang kakaiba \u2014 isang lumang aklat na kumikislap, parang may sariling ilaw sa dilim ng silid.",
    sprite: "neutral"
  },
  {
    book: "glowing",
    speaker: "Twisty",
    text: "\u201CHmm\u2026 ano kaya ito?\u201D",
    sprite: "neutral"
  },
  {
    book: "map",
    text:
      "Dahan-dahan niyang binuksan ang aklat at, sa isang kisap-mata, lumitaw ang isang makulay at umiikot na mapa.",
    sprite: "happy"
  },
  {
    book: "map",
    text:
      "\u201CMaligayang pagdating sa Twisterverse! Handang-handa ka na bang harapin ang apat na mundo ng mga salita? Bawat hakbang ay may hamon\u2026 bawat salita ay may lihim\u2026 at bawat dila ay sinusubok.\u201D",
    sprite: "happy"
  },
  {
    book: "map",
    speaker: "Twisty",
    text:
      "\u201CSige, kaya ko \u2018to. Pero\u2026 kaya mo rin ba, kaibigan, ulitin ang bawat tunog nang mabilis at malinaw?\u201D",
    sprite: "happy"
  }
];

// Purely decorative backdrop — shelves, window, floor. Free to crop at
// the edges on odd aspect ratios since nothing story-critical lives
// here; the desk/book/Twisty are separate CSS elements, not part of
// this SVG, specifically so they never depend on its scaling.
function LibraryScene() {
  return (
    <svg
      className="library-scene"
      viewBox="0 0 360 640"
      preserveAspectRatio="xMidYMax slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="libSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1d14" />
          <stop offset="55%" stopColor="#4a3324" />
          <stop offset="100%" stopColor="#6e5340" />
        </linearGradient>
        <radialGradient id="libWindowGlow" cx="50%" cy="28%" r="45%">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.85" />
          <stop offset="60%" stopColor="#f4c430" stopOpacity="0.22" />
          <stop offset="100%" stopColor="#f4c430" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect x="0" y="0" width="360" height="640" fill="url(#libSky)" />
      <ellipse cx="180" cy="180" rx="200" ry="220" fill="url(#libWindowGlow)" />

      {/* Arched window */}
      <path
        d="M115 210 L115 90 Q180 30 245 90 L245 210 Z"
        fill="#2a1d14"
        opacity="0.4"
      />
      <path
        d="M115 210 L115 90 Q180 30 245 90 L245 210 Z"
        fill="none"
        stroke="#c98f10"
        strokeWidth="5"
      />
      <line x1="180" y1="42" x2="180" y2="210" stroke="#c98f10" strokeWidth="2.5" opacity="0.6" />
      <line x1="115" y1="150" x2="245" y2="150" stroke="#c98f10" strokeWidth="2.5" opacity="0.6" />

      {/* Left bookshelf, full height */}
      <g>
        <rect x="0" y="60" width="80" height="520" fill="#4a3324" stroke="#2a1d14" strokeWidth="2" />
        {[110, 165, 220, 275, 330, 385, 440, 495, 550].map((y) => (
          <line key={y} x1="0" y1={y} x2="80" y2={y} stroke="#2a1d14" strokeWidth="2" />
        ))}
        {Array.from({ length: 40 }).map((_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          const colors = ["#b5301f", "#4fc3c9", "#f4c430", "#58c26d", "#ff8a5c"];
          return (
            <rect
              key={i}
              x={6 + col * 17}
              y={64 + row * 55}
              width="13"
              height="42"
              fill={colors[(i + row) % colors.length]}
              opacity="0.9"
            />
          );
        })}
      </g>

      {/* Right bookshelf, full height */}
      <g>
        <rect x="280" y="60" width="80" height="520" fill="#4a3324" stroke="#2a1d14" strokeWidth="2" />
        {[110, 165, 220, 275, 330, 385, 440, 495, 550].map((y) => (
          <line key={y} x1="280" y1={y} x2="360" y2={y} stroke="#2a1d14" strokeWidth="2" />
        ))}
        {Array.from({ length: 40 }).map((_, i) => {
          const row = Math.floor(i / 4);
          const col = i % 4;
          const colors = ["#4fc3c9", "#b5301f", "#58c26d", "#f4c430", "#ff8a5c"];
          return (
            <rect
              key={i}
              x={286 + col * 17}
              y={64 + row * 55}
              width="13"
              height="42"
              fill={colors[(i + row) % colors.length]}
              opacity="0.9"
            />
          );
        })}
      </g>

      {/* Floor */}
      <rect x="0" y="580" width="360" height="60" fill="#5a4131" />
      <ellipse cx="180" cy="600" rx="150" ry="16" fill="#2a1d14" opacity="0.35" />
    </svg>
  );
}

// The magic map, floating above the desk — an independent overlay, not
// tied to the backdrop's coordinate system.
function MapIllustration() {
  return (
    <svg className="opening-map" viewBox="0 0 220 200" aria-hidden="true">
      <defs>
        <radialGradient id="mapGlow" cx="50%" cy="45%" r="65%">
          <stop offset="0%" stopColor="#fff3c4" stopOpacity="0.9" />
          <stop offset="60%" stopColor="#4fc3c9" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#4fc3c9" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="110" cy="95" r="95" fill="url(#mapGlow)" className="opening-glow-pulse" />
      <g className="opening-map-swirl" transform="translate(35,25)">
        <rect x="0" y="0" width="150" height="140" rx="10" fill="#f3e2b8" stroke="#c98f10" strokeWidth="4" />
        <path
          d="M20 100 Q45 40 75 70 T130 30"
          fill="none"
          stroke="#b5301f"
          strokeWidth="3"
          strokeDasharray="6 5"
        />
        <circle cx="20" cy="100" r="5" fill="#4fc3c9" stroke="#1f5c4d" strokeWidth="2" />
        <circle cx="75" cy="70" r="5" fill="#f4c430" stroke="#c98f10" strokeWidth="2" />
        <circle cx="130" cy="30" r="6" fill="#b5301f" stroke="#7a2013" strokeWidth="2" />
        <path d="M110 105 l8 -18 l8 18 l-8 -6 z" fill="#3b2a1e" opacity="0.6" />
      </g>
    </svg>
  );
}

export default function OpeningScene() {
  const navigate = useNavigate();
  const [beatIndex, setBeatIndex] = useState(0);
  const beat = BEATS[beatIndex];
  const isLastBeat = beatIndex === BEATS.length - 1;

  const goToDashboard = () => navigate("/dashboard");

  const handleNext = () => {
    if (isLastBeat) {
      goToDashboard();
    } else {
      setBeatIndex((i) => i + 1);
    }
  };

  return (
    <div className="opening-scene">
      <button className="opening-skip-btn" onClick={goToDashboard}>
        Laktawan {"\u23ED\uFE0F"}
      </button>

      <div className="opening-stage">
        <LibraryScene />

        <div className="opening-dust" aria-hidden="true">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className={`opening-dust-mote opening-dust-mote-${i + 1}`} />
          ))}
        </div>

        {beat.book === "map" && <MapIllustration />}

        {/* Desk + book + Twisty, all sharing this one coordinate system
            so they stay aligned regardless of viewport size */}
        <div className="reading-nook">
          <img
            src={beat.sprite === "happy" ? twistyHappy : twistyNeutral}
            alt=""
            aria-hidden="true"
            className="opening-twisty"
          />
          <div className="desk-front" />
          {beat.book !== "map" && (
            <div className={`book-prop ${beat.book === "glowing" ? "book-prop--glowing" : ""}`}>
              <span className="book-prop__pages" />
            </div>
          )}
        </div>
      </div>

      <div className="opening-dialogue">
        {beat.speaker && <span className="opening-speaker">{beat.speaker}</span>}
        <p className="opening-text">{beat.text}</p>

        <div className="opening-controls">
          <div className="opening-progress" aria-hidden="true">
            {BEATS.map((_, i) => (
              <span
                key={i}
                className={`opening-dot ${i === beatIndex ? "opening-dot--active" : ""}`}
              />
            ))}
          </div>
          <button className="opening-next-btn" onClick={handleNext}>
            {isLastBeat ? "Simulan ang Pakikipagsapalaran!" : "Susunod \u25B6\uFE0F"}
          </button>
        </div>
      </div>
    </div>
  );
}
