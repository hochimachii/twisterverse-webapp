import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTeacher, validateTeacher } from "../services/teacherService";
import { friendlyAuthError } from "../services/authService";
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
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const clearError = () => setError("");

  const handleAuth = async (e) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }
    if (isSignup && !name.trim()) {
      setError("Please enter your name.");
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
              {isSignup ? "Teacher Sign up" : "Teacher Login"}
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
              <label htmlFor="teacher-username" className="visually-hidden">Username</label>
              <input
                id="teacher-username"
                type="text"
                placeholder="Username"
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
                ? (isSignup ? "Creating…" : "Signing in…")
                : (isSignup ? "Gumawa ng Account" : "Mag-login")}
            </button>

            {error && (
              <p className="error" role="alert" aria-live="assertive">
                {error}
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
