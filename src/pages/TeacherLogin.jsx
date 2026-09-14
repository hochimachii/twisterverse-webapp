import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTeacher, validateTeacher } from "../services/teacherService";
import {
  friendlyAuthError,
  canResetPassword,
  sendPasswordReset
} from "../services/authService";
import { SCHOOLS } from "../data/schools";
import "../styles/LoginPage.css";
import "../styles/TeacherLogin.css";
import backgroundImg from "../assets/login/background.PNG";

export default function TeacherLogin() {
  const [isSignup, setIsSignup] = useState(false);
  const [name, setName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [school, setSchool] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const clearError = () => {
    setError("");
    setNotice("");
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

  const handleAuth = async (e) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password) {
      setError("Punan ang username at ang password.");
      return;
    }
    if (isSignup && !name.trim()) {
      setError("Ilagay ang iyong pangalan.");
      return;
    }
    if (isSignup && !school) {
      setError("Piliin ang paaralan mo.");
      return;
    }

    setLoading(true);
    try {
      // Both branches sign in via Firebase Auth internally — no separate
      // session flag needed. TeacherDashboard reads the real Firebase
      // session directly.
      if (isSignup) {
        await createTeacher({ name: name.trim(), username: username.trim(), password, school });
      } else {
        await validateTeacher(username.trim(), password);
      }
      navigate("/teacher/dashboard");
    } catch (err) {
      setError(friendlyAuthError(err));
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
          <form className="auth-form" onSubmit={handleAuth} noValidate>
            <h2 id="teacher-auth-heading" className="visually-hidden">
              {isSignup ? "Gumawa ng Account ng Guro" : "Mag-login bilang Guro"}
            </h2>

            {isSignup && (
              <div className="form-group">
                <label htmlFor="teacher-name" className="visually-hidden">Pangalan</label>
                <input
                  id="teacher-name"
                  type="text"
                  placeholder="Buong Pangalan"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onFocus={clearError}
                  autoComplete="name"
                  required
                />
              </div>
            )}

            {isSignup && (
              <div className="form-group">
                <label htmlFor="teacher-school" className="visually-hidden">Paaralan</label>
                <select
                  id="teacher-school"
                  value={school}
                  onChange={(e) => setSchool(e.target.value)}
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
                ? (isSignup ? "Ginagawa\u2026" : "Pumapasok\u2026")
                : (isSignup ? "Gumawa ng Account" : "Mag-login")}
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
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setIsSignup((s) => !s);
                    setError("");
                  }}
                >
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
        </main>
      </div>
    </div>
  );
}
