// src/App.jsx
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import MusicPlayer from "./components/MusicPlayer";
import { AuthProvider } from "./context/AuthContext";
import "./styles/theme.css";

// Page imports
import LoginPage from "./pages/LoginPage";
import ProfileSetup from "./pages/ProfileSetup";
import OpeningScene from "./pages/OpeningScene";
import Dashboard from "./pages/Dashboard";
import StageSelection from "./pages/StageSelection";
import TwisterActivity from "./pages/TwisterActivity";
import TeacherLogin from "./pages/TeacherLogin";
import TeacherDashboard from "./pages/TeacherDashboard";

// Wrapper so we can use useLocation inside BrowserRouter
function AppRoutes() {
  const location = useLocation();

  // Decide which track to play
  let musicSrc = "/music/background.mp3"; // login + profile
  if (location.pathname === "/dashboard") {
    musicSrc = "/music/dashboard.mp3"; // 🎵 dashboard track
  }

  return (
    <>
      <MusicPlayer src={musicSrc} />
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

        {/* Teacher flow — separate from student auth entirely */}
        <Route path="/teacher-login" element={<TeacherLogin />} />
        <Route path="/teacher/dashboard" element={<TeacherDashboard />} />

        {/* Fallback */}
        <Route path="*" element={<h1>404 - Page Not Found</h1>} />
      </Routes>
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
