"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import dynamic from "next/dynamic";

/**
 * Global Inti floating menu rendered site-wide.
 * - Hidden on the voice interface page ("/") to avoid duplicate menus, since Unmute renders its own menu there.
 * - On other routes it provides basic navigation via Next router.
 */
const IntiFloatingLogo = dynamic(() => import("./IntiFloatingLogo").then(m => ({ default: m.IntiFloatingLogo })), { ssr: false });

export default function GlobalIntiMenu() {
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === "/") return null;

  return (
    <IntiFloatingLogo
      onNavigate={(route: string) => {
        try { router.push(route); } catch {}
      }}
    />
  );
}
