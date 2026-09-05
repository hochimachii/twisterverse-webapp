import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllStudents, displayName } from "../services/userService";
import { schoolName } from "../data/schools";
import { getAllAttempts } from "../services/attemptsService";
import { getTeacherByUid } from "../services/teacherService";
import { subscribeToAuthState, signOutUser } from "../services/authService";
import { WORLDS, totalLevelCount } from "../data/worlds";
import "../styles/Dashboard.css";
import "../styles/TeacherDashboard.css";
import backgroundImg from "../assets/login/background.PNG";
import { avatarSrc } from "../data/avatars";

const TIER_LABELS = {
  perfect: { label: "Perpekto", className: "tier-badge--perfect" },
  pass: { label: "Pumasa", className: "tier-badge--pass" },
  close: { label: "Malapit na", className: "tier-badge--close" },
  fail: { label: "Mali", className: "tier-badge--fail" },
  timeout: { label: "Ubos ang Oras", className: "tier-badge--timeout" },
  error: { label: "Mic Error", className: "tier-badge--fail" }
};

function attemptTimeMs(a) {
  return a.timestamp?.toMillis ? a.timestamp.toMillis() : 0;
}

// A student's progress summary, derived from THEIR OWN attempts
// (already fetched once via getAllAttempts and filtered here) rather
// than the separate progress collection — this stays accurate even
// while an attempt is mid-flight, and avoids an extra Firestore query
// per student card.
function summarizeStudent(uid, allAttempts) {
  const attempts = allAttempts
    .filter((a) => a.uid === uid)
    .sort((a, b) => attemptTimeMs(b) - attemptTimeMs(a));

  const passedLevels = new Set();
  let failedAttempts = 0;

  attempts.forEach((a) => {
    if (a.tier === "perfect" || a.tier === "pass") {
      passedLevels.add(`${a.world}-${a.level}`);
    } else {
      failedAttempts += 1;
    }
  });

  const total = totalLevelCount();
  const completed = passedLevels.size;
  const percent = total ? Math.round((completed / total) * 100) : 0;

  return {
    attempts,
    totalAttempts: attempts.length,
    failedAttempts,
    completed,
    total,
    percent
  };
}

function formatTimestamp(a) {
  const ms = attemptTimeMs(a);
  if (!ms) return "\u2014";
  try {
    return new Date(ms).toLocaleString("en-PH", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit"
    });
  } catch {
    return "\u2014";
  }
}

export default function TeacherDashboard() {
  const navigate = useNavigate();
  const [teacher, setTeacher] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [students, setStudents] = useState([]);
  const [allAttempts, setAllAttempts] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState("");
  const [gradeFilter, setGradeFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedUid, setSelectedUid] = useState(null);

  // Confirm this is a real, signed-in teacher — reads the actual
  // Firebase Auth session rather than a separate flag, since Firebase
  // Auth already tracks who's currently signed in.
  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (!firebaseUser) {
        navigate("/teacher-login");
        return;
      }
      const t = await getTeacherByUid(firebaseUser.uid);
      if (!t) {
        // Signed in, but not a teacher account (e.g. a student session) —
        // not authorized for this screen.
        navigate("/teacher-login");
        return;
      }
      setTeacher(t);
      setAuthChecked(true);
    });
    return unsubscribe;
  }, [navigate]);

  // Fetch students + every attempt once the teacher is confirmed.
  useEffect(() => {
    if (!authChecked) return;
    let cancelled = false;

    (async () => {
      setDataLoading(true);
      setDataError("");
      try {
        const [studentList, attemptList] = await Promise.all([
          getAllStudents(),
          getAllAttempts()
        ]);
        if (cancelled) return;
        setStudents(studentList);
        setAllAttempts(attemptList);
      } catch (err) {
        console.error(err);
        if (!cancelled) setDataError("Hindi ma-load ang datos. Subukan ulit.");
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authChecked]);

  const handleSignOut = async () => {
    await signOutUser();
    navigate("/teacher-login");
  };

  const grades = useMemo(
    () => [...new Set(students.map((s) => s.profile.grade).filter(Boolean))].sort(),
    [students]
  );

  const sections = useMemo(() => {
    const pool = gradeFilter
      ? students.filter((s) => s.profile.grade === gradeFilter)
      : students;
    return [...new Set(pool.map((s) => s.profile.section).filter(Boolean))].sort();
  }, [students, gradeFilter]);

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      // A teacher only sees students from their own school. Teachers
      // created before schools existed have no school set — they see
      // everyone rather than an empty dashboard.
      if (teacher?.school && s.profile.school !== teacher.school) return false;
      if (gradeFilter && s.profile.grade !== gradeFilter) return false;
      if (sectionFilter && s.profile.section !== sectionFilter) return false;
      if (q) {
        const nickname = displayName(s.profile).toLowerCase();
        const username = (s.username || "").toLowerCase();
        if (!nickname.includes(q) && !username.includes(q)) return false;
      }
      return true;
    });
  }, [students, gradeFilter, sectionFilter, search, teacher]);

  const selectedStudent = students.find((s) => s.uid === selectedUid) || null;
  const selectedSummary = selectedStudent
    ? summarizeStudent(selectedStudent.uid, allAttempts)
    : null;

  if (!authChecked) {
    return (
      <div className="dashboard-bg dashboard-bg--loading" style={{ backgroundImage: `url(${backgroundImg})` }}>
        <p className="loading-text">Sinusuri ang sesyon...</p>
      </div>
    );
  }

  return (
    <div className="dashboard-bg" style={{ backgroundImage: `url(${backgroundImg})` }}>
      <div className="dashboard-wrapper teacher-wrapper">
        {/* HEADER */}
        <header className="dashboard-header">
          <h1 className="dashboard-title">
            Kumusta, {teacher?.name || "Guro"}!
            {teacher?.school && (
              <span className="teacher-school-tag">{schoolName(teacher.school)}</span>
            )}
          </h1>
          <button className="header-btn header-btn--signout" onClick={handleSignOut}>
            {"\uD83D\uDEAA"} Sign Out
          </button>
        </header>

        {dataLoading ? (
          <p className="loading-text">Naglo-load ng mga mag-aaral...</p>
        ) : dataError ? (
          <p className="teacher-empty">{dataError}</p>
        ) : (
          <>
            {/* FILTERS + SEARCH */}
            <section className="teacher-filters">
              <div className="teacher-filters__row">
                <select
                  value={gradeFilter}
                  onChange={(e) => {
                    setGradeFilter(e.target.value);
                    setSectionFilter("");
                  }}
                  className="teacher-select"
                >
                  <option value="">Lahat ng Baitang</option>
                  {grades.map((g) => (
                    <option key={g} value={g}>{g}</option>
                  ))}
                </select>

                <select
                  value={sectionFilter}
                  onChange={(e) => setSectionFilter(e.target.value)}
                  className="teacher-select"
                >
                  <option value="">Lahat ng Seksyon</option>
                  {sections.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <input
                type="text"
                className="teacher-search"
                placeholder="Maghanap sa pangalan ng mag-aaral..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </section>

            {/* STUDENT LIST */}
            <section className="teacher-student-list">
              {filteredStudents.length === 0 ? (
                <p className="teacher-empty">Walang mag-aaral na natagpuan.</p>
              ) : (
                filteredStudents.map((s) => {
                  const summary = summarizeStudent(s.uid, allAttempts);
                  return (
                    <button
                      key={s.uid}
                      className="teacher-student-card"
                      onClick={() => setSelectedUid(s.uid)}
                    >
                      <img
                        src={avatarSrc(s.profile.avatar)}
                        alt=""
                        className="teacher-student-card__avatar"
                        
                      />
                      <div className="teacher-student-card__info">
                        <span className="teacher-student-card__name">
                          {displayName(s.profile)}
                        </span>
                        <span className="teacher-student-card__meta">
                          {s.profile.grade} &middot; {s.profile.section}
                        </span>
                      </div>
                      <div className="teacher-student-card__stats">
                        <span className="teacher-student-card__percent">
                          {summary.percent}%
                        </span>
                        {summary.failedAttempts > 0 && (
                          <span className="teacher-student-card__fails">
                            {summary.failedAttempts} na mali
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </section>
          </>
        )}
      </div>

      {/* STUDENT DETAIL: progress + full attempt history with audio */}
      {selectedStudent && selectedSummary && (
        <div className="teacher-detail-overlay" role="dialog" aria-modal="true">
          <div className="teacher-detail">
            <button
              className="teacher-detail__close"
              onClick={() => setSelectedUid(null)}
              aria-label="Isara"
            >
              {"\u2715"}
            </button>

            <div className="teacher-detail__header">
              <img
                src={avatarSrc(selectedStudent.profile.avatar)}
                alt=""
                className="teacher-detail__avatar"
                
              />
              <div>
                <h2>{displayName(selectedStudent.profile)}</h2>
                <p className="teacher-detail__meta">
                  {selectedStudent.profile.grade} &middot; {selectedStudent.profile.section}
                  {" \u00B7 "}
                  {selectedStudent.username}
                </p>
              </div>
            </div>

            <div className="teacher-detail__summary">
              <div className="teacher-detail__stat">
                <span className="teacher-detail__stat-value">
                  {selectedSummary.completed}/{selectedSummary.total}
                </span>
                <span className="teacher-detail__stat-label">Natapos na Antas</span>
              </div>
              <div className="teacher-detail__stat">
                <span className="teacher-detail__stat-value">
                  {selectedSummary.totalAttempts}
                </span>
                <span className="teacher-detail__stat-label">Kabuuang Pagsubok</span>
              </div>
              <div className="teacher-detail__stat">
                <span className="teacher-detail__stat-value">
                  {selectedSummary.failedAttempts}
                </span>
                <span className="teacher-detail__stat-label">Hindi Pumasa</span>
              </div>
            </div>

            <h3 className="teacher-detail__history-title">Kasaysayan ng mga Pagsubok</h3>

            {selectedSummary.attempts.length === 0 ? (
              <p className="teacher-empty">Wala pang naitalang pagsubok.</p>
            ) : (
              <ul className="teacher-attempt-list">
                {selectedSummary.attempts.map((a) => {
                  const world = WORLDS.find((w) => w.id === a.world);
                  const tierInfo = TIER_LABELS[a.tier] || {
                    label: a.tier,
                    className: "tier-badge--fail"
                  };
                  return (
                    <li key={a.id} className="teacher-attempt">
                      <div className="teacher-attempt__row">
                        <span className="teacher-attempt__location">
                          Mundo {a.world}{world ? ` (${world.title})` : ""} &middot; Antas {a.level}
                        </span>
                        <span className={`tier-badge ${tierInfo.className}`}>
                          {tierInfo.label}
                        </span>
                      </div>
                      <p className="teacher-attempt__twister">
                        <strong>Hamon:</strong> {a.twister}
                      </p>
                      <p className="teacher-attempt__transcript">
                        <strong>Narinig:</strong> {a.transcript || "\u2014"}
                      </p>
                      <div className="teacher-attempt__footer">
                        <span className="teacher-attempt__time">{formatTimestamp(a)}</span>
                        {a.audioUrl ? (
                          <audio controls src={a.audioUrl} className="teacher-attempt__audio" />
                        ) : (
                          <span className="teacher-attempt__no-audio">
                            Walang audio na naitala
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
