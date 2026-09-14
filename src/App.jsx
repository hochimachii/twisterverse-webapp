// src/App.jsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import MusicPlayer from "./components/MusicPlayer";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";
import "./styles/AppFrame.css";

// Page imports
import LoginPage from "./pages/LoginPage";
import ProfileSetup from "./pages/ProfileSetup";
import OpeningScene from "./pages/OpeningScene";
import Dashboard from "./pages/Dashboard";
import StageSelection from "./pages/StageSelection";
import TwisterActivity from "./pages/TwisterActivity";
import EndingScene from "./pages/EndingScene";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";

// Wrapper so we can use useLocation inside BrowserRouter
function AppRoutes() {
  const location = useLocation();

  // Decide which track to play
  let musicSrc = "/music/background.mp3"; // login + profile
  if (location.pathname === "/dashboard") {
    musicSrc = "/music/dashboard.mp3"; // 🎵 dashboard track
  } else if (location.pathname === "/ending") {
    // The closing cinematic gets its own track. Routing it through the
    // same MusicPlayer means it crossfades in, inherits the
    // autoplay-blocked and background-pause handling, and crossfades
    // back to the dashboard track on its own when the student leaves.
    musicSrc = "/music/ending.mp3";
  }

  // Every student screen sits inside .app-frame, the query container the
  // page stylesheets size themselves against - removing the wrapper would
  // silently switch off all of their responsive rules. Screens used to be
  // squeezed into a phone-shaped column on desktop; each now lays itself
  // out per platform instead. The
  // teacher flow is built for a wide screen and doesn't use it. See
  // AppFrame.css.
  const isTeacherView = location.pathname.startsWith("/teacher");

  return (
    <>
      <MusicPlayer src={musicSrc} />
      <div className={isTeacherView ? undefined : "app-frame"}>
      <Routes>
        {/* Entry route */}
        <Route path="/" element={<LoginPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profilesetup" element={<ProfileSetup />} />
        <Route path="/intro" element={<OpeningScene />} />

        {/* Main app flow */}
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/stages" element={<StageSelection />} />
        <Route path="/activity" element={<TwisterActivity />} />
        <Route path="/ending" element={<EndingScene />} />

        {/* Teacher flow — separate from student auth entirely */}
        <Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<h1>404 - Hindi natagpuan ang pahina</h1>} />
      </Routes>
      </div>
    </>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthProvider>
  );
}
