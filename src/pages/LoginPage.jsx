import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createUser,
  validateUser,
  getUserProfile,
  isProfileComplete
} from "../services/userService";
import { friendlyAuthError } from "../services/authService";
import { useAuth } from "../context/AuthContext";
import WelcomeOverlay from "../components/WelcomeOverlay";
import "../styles/LoginPage.css";
import backgroundImg from "../assets/login/background.PNG";
import logoImg from "../assets/login/logo.PNG";

export default function LoginPage() {
  const [isSignup, setIsSignup] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { loginAsGuest } = useAuth();

  const clearError = () => setError("");

  const triggerWelcome = (callback) => {
    setShowWelcome(true);
    setTimeout(() => {
      setShowWelcome(false);
      callback();
    }, 1800);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    clearError();

    if (!username.trim() || !password) {
      setError("Please enter both username and password.");
      return;
    }

    setLoading(true);

    try {
      if (isSignup) {
        // AuthContext's Firebase Auth listener picks up the new session
        // automatically once this resolves — no manual "login" call needed.
        await createUser({ username: username.trim(), password });
        triggerWelcome(() => navigate("/profilesetup"));
      } else {
        const user = await validateUser(username.trim(), password);
        const profile = await getUserProfile(user.uid);
        const nextRoute = isProfileComplete(profile) ? "/dashboard" : "/profilesetup";
        triggerWelcome(() => navigate(nextRoute));
      }
    } catch (err) {
      setError(friendlyAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="login-wrapper"
      style={{
        backgroundImage: `url(${backgroundImg})`,
        backgroundSize: "cover",
        backgroundPosition: "center"
      }}
    >
      <div className="login-overlay"> {/* optional dim layer for readability (style in CSS) */}

        <img src={logoImg} alt="TwisterVerse" className="login-logo" />

        <main className="form-container" aria-labelledby="auth-heading">
          <form className="auth-form" onSubmit={handleAuth} noValidate>
            <h2 id="auth-heading" className="visually-hidden">
              {isSignup ? "Sign up" : "Login"}
            </h2>

            <div className="form-group">
              <label htmlFor="username" className="visually-hidden">Username</label>
              <input
                id="username"
                name="username"
                type="text"
                placeholder="Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onFocus={clearError}
                autoComplete="username"
                required
                aria-required="true"
              />
            </div>

            <div className="form-container form-container--regular"></div>
            <div className="form-group">
              <label htmlFor="password" className="visually-hidden">Password</label>
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={clearError}
                autoComplete={isSignup ? "new-password" : "current-password"}
                required
                aria-required="true"
              />
            </div>

            <button
              type="submit"
              className="primary-btn"
              disabled={loading}
              aria-busy={loading}
            >
              {loading ? (isSignup ? "Creating…" : "Signing in…") : (isSignup ? "Create Account" : "Enter")}
            </button>

            {error && (
              <p className="error" role="alert" aria-live="assertive">
                {error}
              </p>
            )}

            <div className="form-footer">
              <p className="signup-text">
                {isSignup ? "Already have an account?" : "New here?"}{" "}
                <button
                  type="button"
                  className="link-btn"
                  onClick={() => {
                    setIsSignup((s) => !s);
                    setError("");
                  }}
                >
                  {isSignup ? "Back to Login" : "Sign up"}
                </button>
              </p>

              {!isSignup && (
                <div className="guest-block">
                  <button
                    type="button"
                    className="guest-btn"
                    onClick={() => {
                      loginAsGuest("Guest");
                      navigate("/dashboard");
                    }}
                  >
                    Continue as Guest
                  </button>
                  <p className="guest-warning">
                    {"\u26A0\uFE0F"} Bilang Guest, hindi permanenteng
                    naka-save ang iyong progreso — mawawala ito kapag
                    isinara ang browser.
                  </p>
                </div>
              )}

              <button
                type="button"
                className="link-btn teacher-login-link"
                onClick={() => navigate("/teacher-login")}
              >
                {"\uD83C\uDF93"} Guro? Mag-login dito
              </button>
            </div>
          </form>
        </main>

        {/* Welcome overlay — now a shared component used across the app */}
        {showWelcome && <WelcomeOverlay onFinish={() => {}} duration={1800} />}
      </div>
    </div>
  );
}
