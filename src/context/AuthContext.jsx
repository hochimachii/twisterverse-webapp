import { createContext, useContext, useState, useEffect } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeToAuthState, signOutUser } from "../services/authService";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [uid, setUid] = useState(null);
  const [username, setUsername] = useState(() => sessionStorage.getItem("username") || null);
  // True until Firebase has told us whether there's an existing signed-in
  // session — protected pages should wait for this before redirecting to
  // /login, or a page refresh will flash-redirect a logged-in user.
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = subscribeToAuthState(async (firebaseUser) => {
      if (firebaseUser) {
        setUid(firebaseUser.uid);
        try {
          const snap = await getDoc(doc(db, "users", firebaseUser.uid));
          const uname = snap.exists() ? snap.data().username : firebaseUser.email;
          setUsername(uname);
          sessionStorage.setItem("username", uname);
        } catch (err) {
          console.error("Could not load username for signed-in user:", err);
          setUsername(firebaseUser.email);
        }
      } else {
        // No Firebase session - fully signed out.
        setUid(null);
        setUsername(null);
      }
      setAuthLoading(false);
    });
    return unsubscribe;
  }, []);

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error("Sign-out error:", err);
    }
    setUid(null);
    setUsername(null);
    sessionStorage.removeItem("username");
  };

  return (
    <AuthContext.Provider value={{ uid, username, authLoading, logout }}>
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
