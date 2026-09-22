import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTeacher, validateTeacher } from "../services/teacherService";
import {
  friendlyAuthError,
  canResetPassword,
  sendPasswordReset
} from "../services/authService";
import { SCHOOLS, sectionGroupsFor, gradeOfSection } from "../data/schools";
import "../styles/LoginPage.css";
import "../styles/TeacherLogin.css";
import backgroundImg from "../assets/login/background.PNG";

// Trims and collapses inner runs of spaces, so "Maria  Clara " is stored
// the way the admin will expect to read it.
const tidy = (value) => value.trim().replace(/\s+/g, " ");

export default function TeacherLogin() {
  const [isSignup, setIsSignup] = useState(false);
  // True once a sign-up request has been filed; the form is replaced by
  // a note saying the admin has to approve it first.
  const [requestSent, setRequestSent] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [middleName, setMiddleName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [section, setSection] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Sections belong to a school, so the list follows the chosen one.
  const sectionGroups = sectionGroupsFor(school);

  const clearError = () => {
    setError("");
    setNotice("");
  };

  // Changing school invalidates the section - the new school has never
  // heard of it.
  const handleSchoolChange = (value) => {
    setSchool(value);
    setSection("");
  };

  const switchMode = () => {
    setIsSignup((s) => !s);
    clearError();
  };

  const backToLogin = () => {
    setRequestSent(false);
    setIsSignup(false);
    setPassword("");
    clearError();
  };

  // Firebase can only deliver a reset to a real inbox. Usernames map to
  // an invented .local domain, so for those the link could never arrive -
  // say that plainly rather than show a success message for mail that
  // does not exist. Students are reset by their teacher instead.
  const handleReset = async () => {
    clearError();
    const identifier = username.trim();

    if (!identifier) {
      setError("Ilagay muna ang email ng account mo.");
      return;
    }
    if (!canResetPassword(identifier)) {
      setError(
        "Kailangan ng tunay na email para makapag-reset. Ang mga account na username lang ay hindi makakatanggap ng link."
      );
      return;
    }

    setLoading(true);
    try {
      await sendPasswordReset(identifier, "teacher");
      // Deliberately neutral: it must not reveal whether an account
      // exists for that address.
      setNotice(
        "Kung may account sa email na iyan, may naipadalang link para makapagpalit ng password. Tingnan din ang spam folder."
      );
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  // Checked in the order the fields appear, so the message always points
  // at the first thing still missing.
  const signupProblem = () => {
    if (!tidy(firstName)) return "Ilagay ang iyong unang pangalan.";
    if (!tidy(lastName)) return "Ilagay ang iyong apelyido.";
    if (!school) return "Piliin ang paaralan mo.";
    if (!section) return "Piliin ang iyong seksyon.";
    return "";
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    clearError();

    const problem = isSignup ? signupProblem() : "";
    if (problem) {
      setError(problem);
      return;
    }
    if (!username.trim() || !password) {
      setError("Punan ang username at ang password.");
      return;
    }

    setLoading(true);
    try {
      if (isSignup) {
        // Files a request rather than opening the dashboard: the account
        // stays locked until the admin approves it.
        await createTeacher({
          firstName: tidy(firstName),
          middleName: tidy(middleName),
          lastName: tidy(lastName),
          username: username.trim(),
          password,
          school,
          grade: gradeOfSection(school, section),
          section
        });
        setRequestSent(true);
        setPassword("");
      } else {
        // Signs in through Firebase Auth, so TeacherDashboard reads the
        // real session - no separate flag needed.
        await validateTeacher(username.trim(), password);
        navigate("/teacher/dashboard");
      }
    } catch (err) {
      // Waiting for approval isn't a mistake on the teacher's part, so
      // it reads as a notice rather than an error.
      if (err?.code === "teacher/pending") {
        setNotice(err.message);
      } else {
        setError(friendlyAuthError(err));
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-wrapper teacher-login-wrapper"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <div className="login-overlay">
        <span className="teacher-badge">{"\uD83C\uDF93"} Guro / Teacher</span>

        <main className="form-container form-container--regular" aria-labelledby="teacher-auth-heading">
          {requestSent ? (
            <section className="auth-form teacher-request-sent" role="status" aria-live="polite">
              <span className="teacher-request-sent__icon" aria-hidden="true">
                {"\u23F3"}
              </span>
              <h2 id="teacher-auth-heading" className="teacher-request-sent__title">
                Naipadala ang iyong kahilingan!
              </h2>
              <p className="teacher-request-sent__text">
                Susuriin ng admin ang iyong impormasyon. Kapag naaprubahan
                na, makakapag-login ka gamit ang iyong username at password.
              </p>
              <button type="button" className="primary-btn" onClick={backToLogin}>
                Bumalik sa Login
              </button>
            </section>
          ) : (
            <form className="auth-form" onSubmit={handleAuth} noValidate>
              <h2 id="teacher-auth-heading" className="visually-hidden">
                {isSignup ? "Gumawa ng Account ng Guro" : "Mag-login bilang Guro"}
              </h2>

              {isSignup && (
                <p className="teacher-signup-note">
                  Susuriin ng admin ang impormasyong ito bago mabuksan ang
                  iyong account.
                </p>
              )}

              {isSignup && (
                <>
                  <div className="form-group">
                    <label htmlFor="teacher-first-name" className="visually-hidden">Unang Pangalan</label>
                    <input
                      id="teacher-first-name"
                      type="text"
                      placeholder="Unang Pangalan"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      onFocus={clearError}
                      autoComplete="given-name"
                      maxLength={60}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-middle-name" className="visually-hidden">Panggitnang Pangalan</label>
                    <input
                      id="teacher-middle-name"
                      type="text"
                      placeholder="Panggitnang Pangalan (kung mayroon)"
                      value={middleName}
                      onChange={(e) => setMiddleName(e.target.value)}
                      onFocus={clearError}
                      autoComplete="additional-name"
                      maxLength={60}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-last-name" className="visually-hidden">Apelyido</label>
                    <input
                      id="teacher-last-name"
                      type="text"
                      placeholder="Apelyido"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      onFocus={clearError}
                      autoComplete="family-name"
                      maxLength={60}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-school" className="visually-hidden">Paaralan</label>
                    <select
                      id="teacher-school"
                      value={school}
                      onChange={(e) => handleSchoolChange(e.target.value)}
                      onFocus={clearError}
                      required
                    >
                      <option value="">Piliin ang Paaralan</option>
                      {SCHOOLS.map((sc) => (
                        <option key={sc.id} value={sc.id}>
                          {sc.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label htmlFor="teacher-section" className="visually-hidden">Seksyon</label>
                    <select
                      id="teacher-section"
                      value={section}
                      onChange={(e) => setSection(e.target.value)}
                      onFocus={clearError}
                      disabled={!school}
                      required
                    >
                      <option value="">
                        {school ? "Piliin ang Seksyon" : "Pumili muna ng paaralan"}
                      </option>
                      {sectionGroups.map((group) => (
                        <optgroup key={group.grade} label={`Baitang ${group.grade}`}>
                          {group.sections.map((sec) => (
                            <option key={sec} value={sec}>
                              {sec}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div className="form-group">
                <label htmlFor="teacher-username" className="visually-hidden">Username o Email</label>
                <input
                  id="teacher-username"
                  type="text"
                  placeholder="Username o Email"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  onFocus={clearError}
                  autoComplete="username"
                  required
                />
              </div>

              <div className="form-group">
                <label htmlFor="teacher-password" className="visually-hidden">Password</label>
                <input
                  id="teacher-password"
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onFocus={clearError}
                  autoComplete={isSignup ? "new-password" : "current-password"}
                  required
                />
              </div>

              <button type="submit" className="primary-btn" disabled={loading} aria-busy={loading}>
                {loading
                  ? (isSignup ? "Ipinapadala\u2026" : "Pumapasok\u2026")
                  : (isSignup ? "Ipadala ang Kahilingan" : "Mag-login")}
              </button>

              {!isSignup && (
                <button
                  type="button"
                  className="link-btn teacher-reset-link"
                  onClick={handleReset}
                  disabled={loading}
                >
                  Nakalimutan ang password?
                </button>
              )}

              {error && (
                <p className="error" role="alert" aria-live="assertive">
                  {error}
                </p>
              )}

              {notice && (
                <p className="form-notice" role="status" aria-live="polite">
                  {notice}
                </p>
              )}

              <div className="form-footer">
                <p className="signup-text">
                  {isSignup ? "May account na?" : "Unang beses dito?"}{" "}
                  <button type="button" className="link-btn" onClick={switchMode}>
                    {isSignup ? "Mag-login" : "Gumawa ng Account"}
                  </button>
                </p>
                <button
                  type="button"
                  className="link-btn teacher-back-link"
                  onClick={() => navigate("/login")}
                >
                  {"\u2B05\uFE0F"} Bumalik sa Student Login
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
