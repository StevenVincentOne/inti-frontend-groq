import { useEffect, useState } from "react";

// Computes the correct Realtime WebSocket URL.
// Priority:
// 1) NEXT_PUBLIC_WS_URL explicit override (for dev)
// 2) Derive from current location: ws(s)://<host>/v1/realtime
export const useRealtimeWebSocketUrl = () => {
  const [wsUrl, setWsUrl] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Runtime override via localStorage (higher priority than build-time env)
    try {
      const lsUrl = localStorage.getItem('INTI_WS_URL');
      if (lsUrl && lsUrl.trim().length > 0) {
        const val = lsUrl.trim();
        console.log('[useRealtimeWebSocketUrl] Using localStorage override:', val);
        // Support absolute or relative path
        if (val.startsWith('ws://') || val.startsWith('wss://')) {
          setWsUrl(val.replace(/\/$/, ""));
        } else {
          const loc2 = new URL(window.location.href);
          loc2.protocol = loc2.protocol === "https:" ? "wss:" : "ws:";
          loc2.pathname = val.startsWith('/') ? val : `/${val}`;
          loc2.search = "";
          setWsUrl(loc2.toString());
        }
        return;
      }
    } catch {}

    // Build-time override
    const explicit = process.env.NEXT_PUBLIC_WS_URL;
    if (explicit && explicit.trim().length > 0) {
      console.log('[useRealtimeWebSocketUrl] Using env override:', explicit);
      setWsUrl(explicit.replace(/\/$/, ""));
      return;
    }

    // Default: derive from current location
    const loc = new URL(window.location.href);
    loc.protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    loc.pathname = "/v1/realtime";
    loc.search = "";
    const derivedUrl = loc.toString();
    console.log('[useRealtimeWebSocketUrl] Using derived URL:', derivedUrl);
    setWsUrl(derivedUrl);
  }, []);

  return wsUrl;
};
