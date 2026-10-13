import { useEffect, useState } from "react";

/** Evento de Chrome/Android para instalar la app (no está en los tipos estándar). */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

export type InstallState =
  | { kind: "installed" }
  /** Android/Chrome: se puede instalar con un botón. */
  | { kind: "prompt"; install: () => Promise<void> }
  /** iPhone/iPad: hay que hacerlo a mano desde Compartir. */
  | { kind: "ios" }
  | { kind: "unavailable" };

export const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & { standalone?: boolean }).standalone === true;

export const isIos = (ua = navigator.userAgent, touchPoints = navigator.maxTouchPoints) =>
  /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && touchPoints > 1);

/** ¿Está instalada? ¿Se puede instalar con un botón (Android) o con instrucciones (iPhone)? */
export function useInstall(): InstallState {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(isStandalone);

  useEffect(() => {
    const onPrompt = (e: Event) => {
      e.preventDefault(); // Mostramos nuestro propio botón grande.
      setPromptEvent(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return { kind: "installed" };
  if (promptEvent) {
    return {
      kind: "prompt",
      install: async () => {
        await promptEvent.prompt();
        const { outcome } = await promptEvent.userChoice;
        if (outcome === "accepted") setInstalled(true);
        setPromptEvent(null);
      },
    };
  }
  return isIos() ? { kind: "ios" } : { kind: "unavailable" };
}
