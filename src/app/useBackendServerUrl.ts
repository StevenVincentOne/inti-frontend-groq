import { useEffect, useState } from "react";

export const useBackendServerUrl = () => {
  const [backendServerUrl, setBackendServerUrl] = useState<string | null>(null);

  // Compute the HTTP base for health/API calls from window location.
  // Uses same-origin + '/api' so it works in production behind Traefik
  // and in dev if the frontend is reverse-proxying to a local backend.
  // If you need a custom base in local dev, run the dev server with env
  // and rebuild; we avoid build-time env reliance in client code here.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.pathname = "/api";
    url.search = "";
    setBackendServerUrl(url.toString().replace(/\/$/, ""));
  }, []);

  return backendServerUrl;
};
