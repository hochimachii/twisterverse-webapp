import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { getAllStudents, displayName } from "../services/userService";
import { resetStudentPassword } from "../services/teacherService";
import { audioObjectUrl } from "../services/audioStorage";
import { schoolName, SCHOOLS } from "../data/schools";
import { getAllAttempts } from "../services/attemptsService";
import {
  buildSummaryCsv,
  buildAttemptsCsv,
  downloadCsv,
  exportFilename
} from "../utils/exportStudentData";
import { getTeacherByUid } from "../services/teacherService";
import { subscribeToAuthState, signOutUser } from "../services/authService";
import { WORLDS, totalLevelCount } from "../data/worlds";
import "../styles/Dashboard.css";
import "../styles/TeacherDashboard.css";
import backgroundImg from "../assets/login/background.PNG";
import { avatarSrc } from "../data/avatars";

/**
 * Plays one attempt's recording.
 *
 * New attempts store a Storage PATH, fetched here through the SDK so the
 * request carries the teacher's credentials and storage.rules decide
 * whether they may hear it. Attempts from before the migration carry a
 * public Cloudinary URL instead - append-only rules mean those can never
 * be converted, so both are supported indefinitely.
 */
function AttemptAudio({ attempt }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!attempt.audioPath) return undefined;
    let cancelled = false;
    let created = null;

    setFailed(false);
    audioObjectUrl(attempt.audioPath).then((objectUrl) => {
      if (cancelled) {
        if (objectUrl) URL.revokeObjectURL(objectUrl);
        return;
      }
      created = objectUrl;
      setUrl(objectUrl);
      setFailed(!objectUrl);
    });

    return () => {
      cancelled = true;
      // The blob stays in memory until this is revoked, and a teacher can
      // scroll through a lot of attempts.
      if (created) URL.revokeObjectURL(created);
    };
  }, [attempt.audioPath]);

  if (attempt.audioPath) {
    if (url) {
      return <audio controls src={url} className="teacher-attempt__audio" />;
    }
    return (
      <span className="teacher-attempt__no-audio">
        {failed ? "Hindi ma-load ang audio." : "Naglo-load ang audio\u2026"}
      </span>
    );
  }

  if (attempt.audioUrl) {
    return <audio controls src={attempt.audioUrl} className="teacher-attempt__audio" />;
  }

  return (
    <span className="teacher-attempt__no-audio">Walang audio na naitala</span>
  );
}

const TIER_LABELS = {
  perfect: { label: "Perpekto", className: "tier-badge--perfect" },
  pass: { label: "Pumasa", className: "tier-badge--pass" },
  close: { label: "Malapit na", className: "tier-badge--close" },
  fail: { label: "Mali", className: "tier-badge--fail" },
  timeout: { label: "Ubos ang Oras", className: "tier-badge--timeout" },
  error: { label: "Problema sa Mic", className: "tier-badge--fail" }
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
  const [schoolFilter, setSchoolFilter] = useState("");
  // Password reset for the student currently open in the detail panel.
  const [resetPassword, setResetPassword] = useState("");
  const [resetState, setResetState] = useState({ busy: false, msg: "", ok: false });

  // Master access sees every school. It is a flag on the teacher
  // document, so granting it is a deliberate act rather than something
  // a name or email happens to match.
  const isMaster = Boolean(teacher?.isMaster);

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

  // Options come from the students this teacher is allowed to see. Built
  // from `students` before, which offered a teacher grades and sections
  // belonging to other schools entirely - they filtered to nothing.
  const visibleToTeacher = useMemo(() => {
    if (isMaster) {
      return schoolFilter
        ? students.filter((s) => s.profile.school === schoolFilter)
        : students;
    }
    if (!teacher?.school) return students;
    return students.filter((s) => s.profile.school === teacher.school);
  }, [students, teacher, isMaster, schoolFilter]);

  const grades = useMemo(
    () => [...new Set(visibleToTeacher.map((s) => s.profile.grade).filter(Boolean))].sort(),
    [visibleToTeacher]
  );

  const sections = useMemo(() => {
    const pool = gradeFilter
      ? visibleToTeacher.filter((s) => s.profile.grade === gradeFilter)
      : visibleToTeacher;
    return [...new Set(pool.map((s) => s.profile.section).filter(Boolean))].sort();
  }, [visibleToTeacher, gradeFilter]);

  // Exports follow the CURRENT filters, so "Baitang 3 / Seksyon Mabini"
  // on screen is exactly what lands in the spreadsheet. Exporting
  // everything regardless would be a surprise, not a convenience.
  const exportSummary = () => {
    if (!filteredStudents.length) return;
    downloadCsv(exportFilename("buod"), buildSummaryCsv(filteredStudents, allAttempts));
  };

  const exportAttempts = () => {
    if (!filteredStudents.length) return;
    downloadCsv(exportFilename("pagsubok"), buildAttemptsCsv(filteredStudents, allAttempts));
  };

  const filteredStudents = useMemo(() => {
    const q = search.trim().toLowerCase();
    return students.filter((s) => {
      // A teacher only sees students from their own school. Teachers
      // created before schools existed have no school set — they see
      // everyone rather than an empty dashboard.
      //
      // Master access is exempt, and gets a school dropdown instead so
      // it can still narrow down when it wants to.
      if (isMaster) {
        if (schoolFilter && s.profile.school !== schoolFilter) return false;
      } else if (teacher?.school && s.profile.school !== teacher.school) {
        return false;
      }
      if (gradeFilter && s.profile.grade !== gradeFilter) return false;
      if (sectionFilter && s.profile.section !== sectionFilter) return false;
      if (q) {
        const nickname = displayName(s.profile).toLowerCase();
        const username = (s.username || "").toLowerCase();
        if (!nickname.includes(q) && !username.includes(q)) return false;
      }
      return true;
    });
  }, [students, gradeFilter, sectionFilter, search, teacher, isMaster, schoolFilter]);

  const handleResetPassword = async () => {
    if (!selectedStudent) return;
    setResetState({ busy: true, msg: "", ok: false });
    try {
      await resetStudentPassword(selectedStudent.uid, resetPassword);
      setResetState({
        busy: false,
        ok: true,
        // The teacher has to relay this to the child, so show what was
        // set rather than a bare "success".
        msg: `Bagong password para kay ${displayName(selectedStudent.profile)}: ${resetPassword}`
      });
      setResetPassword("");
    } catch (err) {
      setResetState({
        busy: false,
        ok: false,
        msg: err?.message || "Hindi naisagawa ang pagpapalit."
      });
    }
  };

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
            {isMaster ? (
              <span className="teacher-school-tag teacher-school-tag--master">
                Lahat ng Paaralan
              </span>
            ) : (
              teacher?.school && (
                <span className="teacher-school-tag">{schoolName(teacher.school)}</span>
              )
            )}
          </h1>
          <button className="header-btn header-btn--signout" onClick={handleSignOut}>
            {"\uD83D\uDEAA"} Lumabas
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
              {isMaster && (
                <select
                  value={schoolFilter}
                  onChange={(e) => {
                    setSchoolFilter(e.target.value);
                    // A section only exists within a school, so keep
                    // neither when the school changes.
                    setGradeFilter("");
                    setSectionFilter("");
                  }}
                  className="teacher-select"
                >
                  <option value="">Lahat ng Paaralan</option>
                  {SCHOOLS.map((sc) => (
                    <option key={sc.id} value={sc.id}>
                      {sc.name}
                    </option>
                  ))}
                </select>
              )}

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

              <div className="teacher-export">
                <button
                  type="button"
                  className="teacher-export__btn"
                  onClick={exportSummary}
                  disabled={!filteredStudents.length}
                  title="Isang hanay bawat mag-aaral - para sa pagmamarka"
                >
                  {"\uD83D\uDCCA"} I-export ang Buod
                </button>
                <button
                  type="button"
                  className="teacher-export__btn teacher-export__btn--secondary"
                  onClick={exportAttempts}
                  disabled={!filteredStudents.length}
                  title="Isang hanay bawat pagsubok - kasama ang narinig at ang link ng audio"
                >
                  {"\uD83D\uDCDD"} I-export ang mga Pagsubok
                </button>
                <span className="teacher-export__note">
                  {filteredStudents.length} mag-aaral ang isasama
                </span>
              </div>
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
                        {isMaster && (
                          <span className="teacher-student-card__school">
                            {schoolName(s.profile.school)}
                          </span>
                        )}
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

            <div className="teacher-detail__reset">
              <label htmlFor="reset-pw" className="teacher-detail__reset-label">
                Palitan ang password ng mag-aaral
              </label>
              <div className="teacher-detail__reset-row">
                <input
                  id="reset-pw"
                  type="text"
                  className="teacher-search"
                  placeholder="Bagong password (6+ karakter)"
                  value={resetPassword}
                  onChange={(e) => {
                    setResetPassword(e.target.value);
                    setResetState({ busy: false, msg: "", ok: false });
                  }}
                  autoComplete="off"
                />
                <button
                  type="button"
                  className="teacher-export__btn"
                  onClick={handleResetPassword}
                  disabled={resetState.busy || resetPassword.length < 6}
                >
                  {resetState.busy ? "Ipinapalit\u2026" : "I-reset"}
                </button>
              </div>
              {resetState.msg && (
                <p
                  className={`teacher-detail__reset-msg ${
                    resetState.ok ? "is-ok" : "is-error"
                  }`}
                  role="status"
                >
                  {resetState.msg}
                </p>
              )}
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
                        <AttemptAudio attempt={a} />
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
