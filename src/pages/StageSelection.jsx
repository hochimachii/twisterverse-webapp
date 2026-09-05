import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "../styles/StageSelection.css";
import pageBg from "../assets/login/background.PNG";
import { WORLDS, getWorld } from "../data/worlds";
import { useAuth } from "../context/AuthContext";
import { loadProgress } from "../services/progressService";

const SEEN_UNLOCKS_KEY = "seenUnlockedWorldCount";
const SEEN_INTROS_KEY = "seenWorldIntros";

function countUnlockedWorlds(progress) {
  let count = 0;
  for (const world of WORLDS) {
    const prevWorld = getWorld(world.id - 1);
    const prevLevels = progress[`world${world.id - 1}`]?.levels || [];
    const unlocked =
      world.id === 1 || (prevWorld && prevLevels.length >= prevWorld.twisters.length);
    if (unlocked) count += 1;
    else break;
  }
  return count;
}

// Fixed positions for each world's node on the map (viewBox units,
// 400x560). Node 1 starts low, the route winds upward to Node 4 —
// mirrors the "ascending toward the final challenge" shape of the
// story itself.
const NODE_POS = {
  1: { x: 95, y: 485 },
  2: { x: 300, y: 375 },
  3: { x: 100, y: 235 },
  4: { x: 300, y: 90 }
};

function routeSegment(a, b) {
  const midX = (a.x + b.x) / 2;
  return `M${a.x},${a.y} C ${midX},${a.y} ${midX},${b.y} ${b.x},${b.y}`;
}

function TwisterverseMap({ progress, selectedWorld, onSelectWorld }) {
  const NODE_SIZE = 128;

  return (
    <div className="twisterverse-map">
      <svg
        viewBox="0 0 400 560"
        preserveAspectRatio="xMidYMid meet"
        className="twisterverse-map__svg"
      >
        <defs>
          <linearGradient id="mapParchment" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7ecd0" />
            <stop offset="100%" stopColor="#e8d29e" />
          </linearGradient>
        </defs>

        {/* Parchment backdrop */}
        <rect
          x="4" y="4" width="392" height="552" rx="26"
          fill="url(#mapParchment)"
          stroke="#c98f10"
          strokeWidth="5"
        />
        {/* subtle inner border, like an aged map edge */}
        <rect
          x="16" y="16" width="368" height="528" rx="18"
          fill="none"
          stroke="#c98f10"
          strokeWidth="1.5"
          strokeDasharray="3 6"
          opacity="0.6"
        />

        {/* Compass flourish */}
        <g transform="translate(340,45)" opacity="0.55">
          <circle r="22" fill="none" stroke="#b5301f" strokeWidth="2" />
          <path d="M0,-18 L5,0 L0,18 L-5,0 Z" fill="#b5301f" />
          <circle r="2.5" fill="#b5301f" />
        </g>

        {/* Route between consecutive worlds */}
        {WORLDS.slice(1).map((world) => {
          const prevWorld = getWorld(world.id - 1);
          const prevLevels = progress[`world${world.id - 1}`]?.levels || [];
          const traveled =
            !prevWorld || prevLevels.length >= prevWorld.twisters.length;
          return (
            <path
              key={world.id}
              d={routeSegment(NODE_POS[world.id - 1], NODE_POS[world.id])}
              fill="none"
              stroke={traveled ? "#c98f10" : "#a89a86"}
              strokeWidth={traveled ? 5 : 4}
              strokeDasharray={traveled ? "2 11" : "6 8"}
              strokeLinecap="round"
              opacity={traveled ? 1 : 0.55}
            />
          );
        })}

        {/* World nodes — real HTML buttons inside the SVG, positioned
            in the exact same coordinate space as the route above */}
        {WORLDS.map((world) => {
          const pos = NODE_POS[world.id];
          const prevWorld = getWorld(world.id - 1);
          const prevLevels = progress[`world${world.id - 1}`]?.levels || [];
          const unlocked =
            world.id === 1 ||
            (prevWorld && prevLevels.length >= prevWorld.twisters.length);
          const doneCount = progress[`world${world.id}`]?.levels?.length || 0;
          const completed = doneCount >= world.twisters.length;
          const isActive = world.id === selectedWorld;

          return (
            <foreignObject
              key={world.id}
              x={pos.x - NODE_SIZE / 2}
              y={pos.y - NODE_SIZE / 2}
              width={NODE_SIZE}
              height={NODE_SIZE}
            >
              <div xmlns="http://www.w3.org/1999/xhtml" className="map-node-wrap">
                <button
                  type="button"
                  className={`map-node ${unlocked ? "" : "map-node--locked"} ${
                    isActive ? "map-node--active" : ""
                  } ${completed ? "map-node--completed" : ""}`}
                  style={unlocked ? { backgroundImage: `url(${world.cover})` } : undefined}
                  onClick={() => unlocked && onSelectWorld(world.id)}
                  disabled={!unlocked}
                  aria-label={`Mundo ${world.id}: ${world.title}`}
                >
                  <span className="map-node__overlay" aria-hidden="true" />
                  <span className="map-node__icon" aria-hidden="true">
                    {unlocked ? world.icon : "\uD83D\uDD12"}
                  </span>
                  {completed && (
                    <span className="map-node__check" aria-hidden="true">
                      {"\u2705"}
                    </span>
                  )}
                </button>
                <span className={`map-node__label ${unlocked ? "" : "map-node__label--locked"}`}>
                  Mundo {world.id}
                </span>
              </div>
            </foreignObject>
          );
        })}
      </svg>
    </div>
  );
}

export default function StageSelection() {
  const navigate = useNavigate();
  const { uid } = useAuth();
  const [selectedWorld, setSelectedWorld] = useState(1);
  const [progress, setProgress] = useState({});
  const [newlyUnlocked, setNewlyUnlocked] = useState(null); // world object or null
  const [introWorld, setIntroWorld] = useState(null); // world object or null

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const saved = await loadProgress(uid);
      if (cancelled) return;
      setProgress(saved);

      // Celebrate a newly-unlocked world regardless of how the player
      // got here (finishing a world, or just coming back later) —
      // compare against the last count we've already shown a
      // celebration for.
      const unlockedCount = countUnlockedWorlds(saved);
      const seenCount = Number(sessionStorage.getItem(SEEN_UNLOCKS_KEY) || 1);
      if (unlockedCount > seenCount) {
        const justUnlocked = getWorld(unlockedCount);
        if (justUnlocked) setNewlyUnlocked(justUnlocked);
      }
      sessionStorage.setItem(SEEN_UNLOCKS_KEY, String(Math.max(unlockedCount, seenCount)));
    })();

    return () => {
      cancelled = true;
    };
  }, [uid]);

  // Show each world's guide-greeting scene the first time it's viewed
  // this session (including world 1 on a brand-new visit).
  useEffect(() => {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_INTROS_KEY) || "[]");
    if (!seen.includes(selectedWorld)) {
      setIntroWorld(getWorld(selectedWorld));
    }
  }, [selectedWorld]);

  const dismissIntro = () => {
    const seen = JSON.parse(sessionStorage.getItem(SEEN_INTROS_KEY) || "[]");
    if (introWorld && !seen.includes(introWorld.id)) {
      seen.push(introWorld.id);
      sessionStorage.setItem(SEEN_INTROS_KEY, JSON.stringify(seen));
    }
    setIntroWorld(null);
  };

  const completedLevels = progress[`world${selectedWorld}`]?.levels || [];
  const currentWorld = getWorld(selectedWorld);
  const levelCount = currentWorld.twisters.length;

  const isUnlocked = (level) => {
    if (level === 1) return true; // always unlock first stage
    return completedLevels.includes(level - 1);
  };

  const handleStageClick = (level) => {
    if (isUnlocked(level)) {
      navigate("/activity", { state: { world: selectedWorld, level } });
    }
  };

  const handleWorldSelect = (world) => {
    const prevWorld = getWorld(world - 1);
    const prevWorldLevels = progress[`world${world - 1}`]?.levels || [];
    const prevComplete = !prevWorld || prevWorldLevels.length >= prevWorld.twisters.length;
    if (world === 1 || prevComplete) {
      setSelectedWorld(world);
    }
  };

  return (
    <div className="stage-bg" style={{ backgroundImage: `url(${pageBg})` }}>
      <div className="stage-wrapper">

        <h1>Mapa ng Twisterverse</h1>

        {/* World Selection — the map Twisty found in the opening scene,
            now interactive. Nodes use <foreignObject> so the clickable
            buttons share the exact same coordinate space as the drawn
            path — no risk of them drifting apart like the opening
            scene's original layout did. */}
        <TwisterverseMap
          progress={progress}
          selectedWorld={selectedWorld}
          onSelectWorld={handleWorldSelect}
        />

        {/* Level Selection */}
        <h2>
          Mga Antas sa Mundo {selectedWorld}
          <span className="world-guide"> — kasama si {currentWorld.guide}</span>
        </h2>
        <div className="level-grid">
          {Array.from({ length: levelCount }, (_, i) => {
            const level = i + 1;
            const unlocked = isUnlocked(level);
            const completed = completedLevels.includes(level);
            return (
              <button
                key={level}
                className={`level-card ${unlocked ? "" : "locked"} ${
                  completed ? "completed" : ""
                }`}
                onClick={() => handleStageClick(level)}
                disabled={!unlocked}
              >
                Antas {level} {completed && "\u2705"}
              </button>
            );
          })}
        </div>

        {/* Back Button */}
        <button className="back-btn" onClick={() => navigate("/dashboard")}>
          Bumalik sa Menu
        </button>
      </div>

      {/* New-world-unlocked celebration */}
      {newlyUnlocked && (
        <div className="unlock-overlay" role="status" aria-live="polite">
          <div className="unlock-card">
            <div className="unlock-card__stripe" />
            <span className="unlock-card__icon">{newlyUnlocked.icon}</span>
            <h2>Bagong Mundo Bukas Na!</h2>
            <p className="unlock-card__title">
              Mundo {newlyUnlocked.id}: {newlyUnlocked.title}
            </p>
            <p className="unlock-card__guide">
              Makikilala mo si {newlyUnlocked.guide}
            </p>
            <button
              onClick={() => {
                setSelectedWorld(newlyUnlocked.id);
                setNewlyUnlocked(null);
              }}
            >
              Tara, Tignan Natin!
            </button>
          </div>
        </div>
      )}

      {/* Meet-the-guide scene — shown once per world per session, after
          any unlock celebration has been dismissed. Same visual
          language as TwisterActivity: full-scene background with the
          guide standing on it, dialogue box docked at the bottom. */}
      {!newlyUnlocked && introWorld && (
        <div
          className="guide-scene"
          style={{ backgroundImage: `url(${introWorld.cover})` }}
          role="status"
          aria-live="polite"
        >
          {introWorld.guideArt ? (
            <img
              src={introWorld.guideArt}
              alt=""
              aria-hidden="true"
              className="guide-scene__standee"
            />
          ) : (
            <div className="guide-scene__standee guide-scene__standee--pending">
              <span aria-hidden="true">{introWorld.icon}</span>
            </div>
          )}

          <div className="guide-dialogue">
            <span className="guide-dialogue__tag">
              Mundo {introWorld.id}: {introWorld.title}
            </span>
            {introWorld.greeting.map((line, i) => (
              <p key={i} className="guide-dialogue__line">
                {line.speaker && (
                  <span className="guide-dialogue__speaker">{line.speaker}: </span>
                )}
                {line.line}
              </p>
            ))}
            <div className="guide-dialogue__controls">
              <button onClick={dismissIntro}>Simulan ang Hamon!</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
