import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getUserProfile, isProfileComplete, displayName } from "../services/userService";
import { useAuth } from "../context/AuthContext";
import { loadProgress, totalPointsFrom } from "../services/progressService";
import { WORLDS, totalLevelCount } from "../data/worlds";
import "../styles/Dashboard.css";
import backgroundImg from "../assets/login/background.PNG";
import { avatarSrc } from "../data/avatars";

// Thematic rank titles, topping out with "Master ng Diksiyon" — matching
// the title Twisty earns at the end of the client's story script.
const RANK_TIERS = [
  { min: 100, label: "Master ng Diksiyon" },
  { min: 75, label: "Eksperto sa Dila" },
  { min: 50, label: "Sanay na Manlalaro" },
  { min: 25, label: "Nag-uumpisa" },
  { min: 0, label: "Baguhan" }
];

async function computeProgress(isGuest, uid) {
  const progress = await loadProgress(isGuest, uid);
  const total = totalLevelCount();

  let completed = 0;
  let worldsCompleted = 0;

  WORLDS.forEach((world) => {
    const done = progress[`world${world.id}`]?.levels?.length || 0;
    completed += Math.min(done, world.twisters.length);
    if (done >= world.twisters.length) worldsCompleted += 1;
  });

  const percent = total ? Math.round((completed / total) * 100) : 0;
  const rank =
    RANK_TIERS.find((tier) => percent >= tier.min)?.label || "Baguhan";

  // One slot per world, for the "Mga Susi ng Diksiyon" key rack —
  // worlds 1-3 have real key art from the script; world 4's reward
  // (the crown) is part of the deferred ending, so it's marked pending
  // even once earned.
  const keys = WORLDS.map((world) => {
    const done = progress[`world${world.id}`]?.levels?.length || 0;
    return { world, earned: done >= world.twisters.length };
  });

  return {
    completed,
    total,
    percent,
    xp: totalPointsFrom(progress),
    worldsCompleted,
    worldsTotal: WORLDS.length,
    rank,
    keys
  };
}

/** Gender is now stored in Filipino. Records created before that change
 *  hold the old English values, so those are mapped on the way out;
 *  anything already Filipino passes straight through. */
const LEGACY_GENDER = { Male: "Lalaki", Female: "Babae", Other: "Iba pa" };

export default function Dashboard() {
  const navigate = useNavigate();
  const { username, uid, isGuest, logout } = useAuth();
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    if (!username) {
      navigate("/login");
      return;
    }

    let cancelled = false;

    (async () => {
      const userProfile = await getUserProfile(uid);
      if (cancelled) return;

      if (!isProfileComplete(userProfile)) {
        navigate("/profilesetup");
        return;
      }

      const progressStats = await computeProgress(isGuest, uid);
      if (cancelled) return;

      setProfile(userProfile);
      setStats(progressStats);
    })();

    return () => {
      cancelled = true;
    };
  }, [username, uid, isGuest, navigate]);

  const handleSignOut = async () => {
    await logout();
    navigate("/login");
  };

  if (!profile || !stats) {
    return (
      <div
        className="dashboard-bg dashboard-bg--loading"
        style={{ backgroundImage: `url(${backgroundImg})` }}
      >
        <p className="loading-text">Naglo-load ang profile...</p>
      </div>
    );
  }

  return (
    <div
      className="dashboard-bg"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <div className="dashboard-wrapper">
        {isGuest && (
          <div className="guest-banner dashboard-guest-banner">
            <span className="guest-banner__icon" aria-hidden="true">
              {"\u26A0\uFE0F"}
            </span>
            <span>
              Naglalaro ka bilang Guest — hindi permanenteng naka-save ang
              iyong progreso.
            </span>
          </div>
        )}

        {/* HEADER SECTION */}
        <header className="dashboard-header">
          <h1 className="dashboard-title">Welcome, {displayName(profile)}!</h1>
          <button className="header-btn header-btn--signout" onClick={handleSignOut}>
            {"\uD83D\uDEAA"} Sign Out
          </button>
        </header>

        {/* PROFILE CARD */}
        <section className="profile-card">
          <img
            src={avatarSrc(profile.avatar)}
            alt="Avatar"
            className="profile-avatar"
            
          />
          <div className="profile-info">
            <p><strong>Baitang:</strong> {profile.grade}</p>
            <p><strong>Seksyon:</strong> {profile.section}</p>
            <p><strong>Kasarian:</strong> {LEGACY_GENDER[profile.gender] || profile.gender}</p>
          </div>
        </section>

        {/* OVERALL PROGRESS */}
        <section className="progress-card">
          <div className="progress-card__header">
            <span>Pangkalahatang Progreso</span>
            <span>{stats.completed}/{stats.total} na Antas</span>
          </div>
          <div className="progress-bar">
            <div
              className="progress-bar__fill"
              style={{ width: `${stats.percent}%` }}
            />
          </div>
        </section>

        {/* STATS PANEL */}
        <section className="stats-panel">
          <div className="stat-box">
            <h3>XP / Puntos</h3>
            <p>{stats.xp}</p>
          </div>
          <div className="stat-box">
            <h3>Mga Tagumpay</h3>
            <p>{stats.worldsCompleted}/{stats.worldsTotal} Mundo</p>
          </div>
          <div className="stat-box">
            <h3>Ranggo</h3>
            <p>{stats.rank}</p>
          </div>
        </section>

        {/* KEYS OF THE DICTIONARY */}
        <section className="keys-card">
          <h3 className="keys-card__title">Mga Susi ng Diksiyon</h3>
          <div className="keys-row">
            {stats.keys.map(({ world, earned }) =>
              world.keyArt && !world.keyHiddenInDashboard ? (
                <div
                  key={world.id}
                  className={`key-slot ${earned ? "key-slot--earned" : "key-slot--locked"}`}
                  title={earned ? world.keyName : `Tapusin ang Mundo ${world.id}`}
                >
                  <img src={world.keyArt} alt={earned ? world.keyName : ""} />
                  {!earned && <span className="key-slot__lock">{"\uD83D\uDD12"}</span>}
                </div>
              ) : (
                <div
                  key={world.id}
                  className="key-slot key-slot--pending"
                  title={
                    earned
                      ? "Natapos ang Huling Hamon — ang Korona ay malapit na!"
                      : `Tapusin ang Mundo ${world.id}`
                  }
                >
                  <span className="key-slot__pending-icon">
                    {earned ? "\u2728" : "\uD83D\uDD12"}
                  </span>
                </div>
              )
            )}
          </div>
          <p className="keys-card__hint">
            {stats.worldsCompleted < 3
              ? "Tapusin ang bawat mundo para makuha ang Susi ng Diksiyon!"
              : "Ang huling gantimpala — ang Korona ng Diksiyon — ay malapit na!"}
          </p>
        </section>

        {/* MAIN ACTION */}
        <section className="main-actions">
          <button className="action-btn play-btn" onClick={() => navigate("/stages")}>
            {"\u25B6\uFE0F"} Maglaro
          </button>
          <button
            className="action-btn settings-btn"
            disabled
            title="Malapit na — hindi pa available"
          >
            {"\u2699\uFE0F"} Mga Setting
            <span className="coming-soon-badge">Malapit Na</span>
          </button>
        </section>
      </div>
    </div>
  );
}
