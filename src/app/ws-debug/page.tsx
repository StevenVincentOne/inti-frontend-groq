"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRealtimeWebSocketUrl } from "../useRealtimeWebSocketUrl";

type Log = { ts: string; level: "info" | "warn" | "error"; msg: string; data?: any };

const pretty = (v: any) => {
  try { return JSON.stringify(v, null, 2); } catch { return String(v); }
};

const WSReadyState: Record<number, string> = {
  0: "CONNECTING",
  1: "OPEN",
  2: "CLOSING",
  3: "CLOSED",
};

export default function WSPage() {
  const computedUrl = useRealtimeWebSocketUrl();
  const [urlOverride, setUrlOverride] = useState("");
  const [subprotocolOverride, setSubprotocolOverride] = useState("");
  const [readyState, setReadyState] = useState<number>(WebSocket.CLOSED);
  const wsRef = useRef<WebSocket | null>(null);
  const [logs, setLogs] = useState<Log[]>([]);

  // Pull current LS overrides on mount
  useEffect(() => {
    try {
      const u = localStorage.getItem("INTI_WS_URL") || "";
      const sp = localStorage.getItem("INTI_WS_SUBPROTOCOL") || "";
      setUrlOverride(u);
      setSubprotocolOverride(sp);
    } catch {}
  }, []);

  const effectiveUrl = useMemo(() => urlOverride?.trim() || computedUrl || "", [urlOverride, computedUrl]);
  const envUrl = process.env.NEXT_PUBLIC_WS_URL || "";
  const envSubprotocol = process.env.NEXT_PUBLIC_REALTIME_SUBPROTOCOL || "realtime";

  const addLog = useCallback((level: Log["level"], msg: string, data?: any) => {
    setLogs((prev) => [{ ts: new Date().toISOString(), level, msg, data }, ...prev].slice(0, 500));
  }, []);

  const connect = useCallback((mode: "default" | "realtime" | "none") => {
    if (!effectiveUrl) {
      addLog("warn", "No URL available to connect.");
      return;
    }
    try {
      if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
        addLog("warn", "Closing previous connection before reconnecting.");
        try { wsRef.current.close(1000, "reconnect"); } catch {}
      }
      const protocols = mode === "none" ? undefined : [mode === "default" ? (subprotocolOverride?.trim() || envSubprotocol || "realtime") : "realtime"];
      addLog("info", `Connecting to ${effectiveUrl} with subprotocol ${protocols ? protocols.join(",") : "<none>"}`);
      const ws = new WebSocket(effectiveUrl, protocols as any);
      wsRef.current = ws;
      setReadyState(ws.readyState);

      ws.onopen = () => {
        setReadyState(ws.readyState);
        addLog("info", "WebSocket open");
      };
      ws.onclose = (evt) => {
        setReadyState(ws.readyState);
        addLog("warn", `WebSocket close code=${evt.code} reason=${evt.reason || ""}`);
      };
      ws.onerror = (err) => {
        setReadyState(ws.readyState);
        addLog("error", "WebSocket error", { err: String(err) });
      };
      ws.onmessage = (evt) => {
        addLog("info", "Message", (() => { try { return JSON.parse(evt.data); } catch { return String(evt.data); } })());
      };
    } catch (e: any) {
      addLog("error", "Failed to create WebSocket", { error: String(e?.message || e) });
    }
  }, [effectiveUrl, addLog, envSubprotocol, subprotocolOverride]);

  const disconnect = useCallback(() => {
    try { wsRef.current?.close(1000, "manual"); } catch {}
  }, []);

  const saveOverrides = useCallback(() => {
    try {
      if (urlOverride?.trim()) localStorage.setItem("INTI_WS_URL", urlOverride.trim()); else localStorage.removeItem("INTI_WS_URL");
      if (subprotocolOverride?.trim()) localStorage.setItem("INTI_WS_SUBPROTOCOL", subprotocolOverride.trim()); else localStorage.removeItem("INTI_WS_SUBPROTOCOL");
      addLog("info", "Saved overrides to localStorage.");
    } catch (e) {
      addLog("error", "Failed to save overrides", { error: String(e) });
    }
  }, [urlOverride, subprotocolOverride, addLog]);

  return (
    <div className="max-w-3xl mx-auto p-4 text-sm">
      <h1 className="text-xl font-semibold mb-4">Realtime WS Debug</h1>

      <div className="space-y-2 mb-6">
        <div><span className="font-medium">Computed URL:</span> {computedUrl || "(not ready)"}</div>
        <div><span className="font-medium">Env URL:</span> {envUrl || "(none)"}</div>
        <div><span className="font-medium">Env Subprotocol:</span> {envSubprotocol || "(none)"}</div>
        <div><span className="font-medium">Ready State:</span> {WSReadyState[readyState] || readyState}</div>
      </div>

      <div className="border rounded p-3 mb-6 space-y-2">
        <div className="font-medium">Overrides (stored in localStorage)</div>
        <label className="block">
          <span className="text-gray-600">INTI_WS_URL</span>
          <input className="w-full border rounded p-2" placeholder="wss://inti.intellipedia.ai/v1/realtime" value={urlOverride} onChange={(e) => setUrlOverride(e.target.value)} />
        </label>
        <label className="block">
          <span className="text-gray-600">INTI_WS_SUBPROTOCOL</span>
          <input className="w-full border rounded p-2" placeholder="realtime | none (leave blank to use env)" value={subprotocolOverride} onChange={(e) => setSubprotocolOverride(e.target.value)} />
        </label>
        <div className="flex gap-2">
          <button className="px-3 py-1 rounded bg-blue-600 text-white" onClick={saveOverrides}>Save Overrides</button>
          <button className="px-3 py-1 rounded bg-gray-200" onClick={() => { setUrlOverride(""); setSubprotocolOverride(""); }}>Clear Fields</button>
        </div>
      </div>

      <div className="flex gap-2 mb-6">
        <button className="px-3 py-1 rounded bg-green-600 text-white" onClick={() => connect("default")}>Connect (default)</button>
        <button className="px-3 py-1 rounded bg-indigo-600 text-white" onClick={() => connect("realtime")}>Connect (force "realtime")</button>
        <button className="px-3 py-1 rounded bg-amber-600 text-white" onClick={() => connect("none")}>Connect (no subprotocol)</button>
        <button className="px-3 py-1 rounded bg-red-600 text-white" onClick={disconnect}>Disconnect</button>
      </div>

      <div className="border rounded p-3 bg-black text-white max-h-[50vh] overflow-auto">
        {logs.length === 0 ? (
          <div className="text-gray-400">No logs yet. Use the buttons above to start a connection. Check DevTools → Network → WS for handshake details (status, headers, subprotocol).</div>
        ) : logs.map((l, i) => (
          <div key={i} className="mb-2">
            <div className="text-xs text-gray-400">[{l.ts}] {l.level.toUpperCase()}</div>
            <div className="whitespace-pre-wrap break-words">{l.msg}</div>
            {l.data !== undefined && (
              <pre className="text-xs whitespace-pre-wrap break-words bg-gray-900 p-2 rounded mt-1">{pretty(l.data)}</pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

