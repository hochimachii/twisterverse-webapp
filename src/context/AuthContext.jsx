import { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToAuthState, signOutUser } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || null);
  const [isGuest, setIsGuest] = useState(() => sessionStorage.getItem("isGuest") === "true");
  // True until Firebase has told us whether there's an existing signed-in
  // session — protected pages should wait for this before redirecting to
  // /login, or a page refresh will flash-redirect a logged-in user.
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        setUid(firebaseUser.uid);
        setIsGuest(false);
        sessionStorage.setItem("isGuest", "false");
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          const uname = snap.exists() ? snap.data().username : firebaseUser.email;
          setUsername(uname);
          sessionStorage.setItem("username", uname);
        } catch (err) {
          console.error("Could not load username for signed-in user:", err);
          setUsername(firebaseUser.email);
        }
      } else if (sessionStorage.getItem("isGuest") !== "true") {
        // No Firebase session and not in guest mode — fully signed out.
        setUid(null);
        setUsername(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  // Guest mode bypasses Firebase Auth entirely — local-only and
  // ephemeral, exactly as before the migration. No uid, nothing ever
  // reaches Firestore for a guest.
  const loginAsGuest = (name) => {
    setUid(null);
    setUsername(name);
    setIsGuest(true);
    sessionStorage.setItem("username", name);
    sessionStorage.setItem("isGuest", "true");
  };

  const logout = async () => {
    if (!isGuest) {
      try {
        await signOutUser();
      } catch (err) {
        console.error("Sign-out error:", err);
      }
    }
    setUid(null);
    setUsername(null);
    setIsGuest(false);
    sessionStorage.removeItem("username");
    sessionStorage.removeItem("isGuest");
  };

  return (
    <AuthContext.Provider value={{ uid, username, isGuest, authLoading, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an <AuthProvider>");
  }
  return ctx;
}
