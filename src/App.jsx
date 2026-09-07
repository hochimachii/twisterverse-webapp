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

  // The teacher flow is the one part of the app meant for a wide screen:
  // a filterable student table with CSV export. Everything else is drawn
  // for a 9:16 phone, so it gets framed to that shape on desktop rather
  // than letting the artwork re-crop itself. See AppFrame.css.
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
