"use client";

import { useEffect } from "react";

/** Registra o service worker (leitura offline do que já está em cache). */
export function RegistraSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Sem service worker o app continua funcionando online.
    });
  }, []);

  return null;
}
