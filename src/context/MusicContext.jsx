import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";

// Whether the background music is switched off (MusicToggle). Remembered
// per device rather than per account: the switch has to work on the login
// screen, before anyone is signed in, and on a shared classroom device the
// choice belongs to the device. Only the music stops - the opening story's
// narration and each tongue twister's recorded reading still play.
const MUTED_KEY = "twisterverse_music_muted";

function readMuted() {
  try {
    return localStorage.getItem(MUTED_KEY) === "1";
  } catch {
    // Storage blocked: start with the music on, as before.
    return false;
  }
}

// The default lets a screen render outside the provider (in tests) with
// the music on and a switch that does nothing.
const MusicContext = createContext({ muted: false, toggleMuted: () => {} });

export function MusicProvider({ children }) {
  const [muted, setMuted] = useState(readMuted);

  useEffect(() => {
    try {
      if (muted) localStorage.setItem(MUTED_KEY, "1");
      else localStorage.removeItem(MUTED_KEY);
    } catch {
      // Storage blocked (some private modes): the choice lasts until reload.
    }
  }, [muted]);

  const toggleMuted = useCallback(() => setMuted((m) => !m), []);
  const value = useMemo(() => ({ muted, toggleMuted }), [muted, toggleMuted]);

  return <MusicContext.Provider value={value}>{children}</MusicContext.Provider>;
}

export function useMusic() {
  return useContext(MusicContext);
}
