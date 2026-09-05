import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { saveUserProfile, isProfileComplete } from "../services/userService";
import { useAuth } from "../context/AuthContext";
import "../styles/ProfileSetup.css";
import backgroundImg from "../assets/login/background.PNG";
import { avatarSrc, AVATAR_OPTIONS } from "../data/avatars";
import { SCHOOLS } from "../data/schools";

export default function ProfileSetup() {
  const { uid, username } = useAuth();
  const [fullName, setFullName] = useState("");
  const [school, setSchool] = useState("");
  const [avatar, setAvatar] = useState(AVATAR_OPTIONS[0]);
  const [grade, setGrade] = useState("");
  const [section, setSection] = useState("");
  const [gender, setGender] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!username) {
      setError("Walang nakitang gumagamit. Pumasok muli.");
      return;
    }

    // fullName replaces the old nickname: teachers need to identify
    // real students on their roster. school scopes which teacher can
    // see this student.
    const profileData = { fullName, school, avatar, grade, section, gender };

    if (!isProfileComplete(profileData)) {
      setError("Punan ang lahat ng patlang bago magpatuloy.");
      return;
    }

    try {
      await saveUserProfile(uid, profileData);
      navigate("/intro");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div
      className="profile-bg"
      style={{ backgroundImage: `url(${backgroundImg})` }}
    >
      <div className="profile-wrapper">
        <h2>Gawin ang Iyong Profile</h2>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Buong Pangalan"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
          />

          {/* Avatar selection */}
          <div className="avatar-selection">
            <p>Pumili ng Avatar:</p>
            <div className="avatar-grid">
              {AVATAR_OPTIONS.map((a) => (
                <img
                  key={a}
                  src={avatarSrc(a)}
                  alt="Avatar"
                  className={`avatar ${avatar === a ? "selected" : ""}`}
                  onClick={() => setAvatar(a)}
                />
              ))}
            </div>
          </div>

          {/* Live preview */}
          <div className="profile-preview">
            <h3>Napili Mo</h3>
            <img
              src={avatarSrc(avatar)}
              alt="Napiling avatar"
              className="preview-avatar"
            />
            <p className="preview-nickname">{fullName || "Ang buong pangalan mo"}</p>
          </div>

          <select
            value={school}
            onChange={(e) => setSchool(e.target.value)}
            required
          >
            <option value="">Piliin ang Paaralan</option>
            {SCHOOLS.map((sc) => (
              <option key={sc.id} value={sc.id}>
                {sc.name}
              </option>
            ))}
          </select>

          <input
            type="text"
            placeholder="Baitang"
            value={grade}
            onChange={(e) => setGrade(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Seksyon"
            value={section}
            onChange={(e) => setSection(e.target.value)}
            required
          />
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            required
          >
            <option value="">Piliin ang Kasarian</option>
            <option value="Lalaki">Lalaki</option>
            <option value="Babae">Babae</option>
          </select>

          {error && <p className="error">{error}</p>}
          <button type="submit">I-save ang Profile</button>
        </form>
      </div>
    </div>
  );
}
