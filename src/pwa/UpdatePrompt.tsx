import { useEffect } from "react";
import { useRegisterSW } from "virtual:pwa-register/react";

/**
 * Registra el service worker (desde el propio bundle, sin script inline) y avisa cuando
 * hay una versión nueva. Nunca se actualiza a mitad de algo: decides tú cuándo.
 */
export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    offlineReady: [offlineReady, setOfflineReady],
    updateServiceWorker,
  } = useRegisterSW();

  // "Lista para usar sin conexión" es informativo: se oculta solo para no tapar botones.
  useEffect(() => {
    if (!offlineReady || needRefresh) return;
    const timer = setTimeout(() => setOfflineReady(false), 4000);
    return () => clearTimeout(timer);
  }, [offlineReady, needRefresh, setOfflineReady]);

  if (!needRefresh && !offlineReady) return null;

  return (
    <div
      role="status"
      className="fixed inset-x-4 bottom-[calc(6.5rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl bg-text p-4 text-bg shadow-lg"
    >
      <p className="flex-1 text-lg font-semibold">
        {needRefresh ? "Hay una versión nueva de House Hub." : "Lista para usar sin conexión."}
      </p>
      {needRefresh ? (
        <button
          type="button"
          onClick={() => updateServiceWorker(true)}
          className="min-h-12 rounded-xl bg-accent px-4 text-lg font-semibold text-accent-contrast"
        >
          Actualizar
        </button>
      ) : null}
      <button
        type="button"
        onClick={() => {
          setNeedRefresh(false);
          setOfflineReady(false);
        }}
        className="min-h-12 rounded-xl px-3 text-lg font-semibold"
      >
        {needRefresh ? "Luego" : "Vale"}
      </button>
    </div>
  );
}
