"use client";

import { useEffect, useState } from "react";

type BIPEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export function PWARegister() {
  const [deferred, setDeferred] = useState<BIPEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosHint, setShowIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }

    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) setInstalled(true);

    const onBIP = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BIPEvent);
    };
    const onInstalled = () => {
      setInstalled(true);
      setDeferred(null);
    };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);

    const isIOS =
      /iPad|iPhone|iPod/.test(navigator.userAgent) &&
      !(window as Window & { MSStream?: unknown }).MSStream;
    if (isIOS && !standalone) setShowIosHint(true);

    setDismissed(localStorage.getItem("jnews-install-dismissed") === "1");

    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed || dismissed) return null;
  if (!deferred && !showIosHint) return null;

  const dismiss = () => {
    localStorage.setItem("jnews-install-dismissed", "1");
    setDismissed(true);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div
      role="dialog"
      aria-label="Instalar JNews"
      style={{
        position: "fixed",
        left: "50%",
        bottom: 16,
        transform: "translateX(-50%)",
        zIndex: 50,
        maxWidth: 420,
        width: "calc(100% - 24px)",
        padding: "12px 14px",
        borderRadius: 12,
        background: "rgba(11,11,13,0.92)",
        color: "#f2ece1",
        border: "1px solid rgba(201,163,93,0.35)",
        backdropFilter: "blur(8px)",
        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
        fontFamily: "system-ui, sans-serif",
        fontSize: 13,
        lineHeight: 1.4,
        display: "flex",
        alignItems: "center",
        gap: 10,
      }}
    >
      <div style={{ flex: 1 }}>
        {deferred ? (
          <>
            <strong style={{ color: "#e5c27e" }}>Instalar JNews</strong>
            <div style={{ opacity: 0.8 }}>Acesso rápido, offline e cara de app.</div>
          </>
        ) : (
          <>
            <strong style={{ color: "#e5c27e" }}>Instalar no iOS</strong>
            <div style={{ opacity: 0.8 }}>
              Toque em <span aria-label="compartilhar">⎋</span> e depois em &ldquo;Adicionar à Tela de Início&rdquo;.
            </div>
          </>
        )}
      </div>
      {deferred && (
        <button
          onClick={install}
          style={{
            padding: "8px 12px",
            borderRadius: 8,
            background: "#c9a35d",
            color: "#0b0b0d",
            border: 0,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          Instalar
        </button>
      )}
      <button
        onClick={dismiss}
        aria-label="Fechar"
        style={{
          padding: "6px 8px",
          borderRadius: 8,
          background: "transparent",
          color: "#f2ece1",
          border: "1px solid rgba(242,236,225,0.2)",
          cursor: "pointer",
        }}
      >
        ✕
      </button>
    </div>
  );
}
