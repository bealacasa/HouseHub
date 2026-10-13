import { useCallback, useEffect, useRef, useState } from "react";
import { buttonDanger, buttonSecondary } from "./ui";

type Options = { title: string; message: string; confirmLabel: string };

/**
 * Confirmación antes de acciones delicadas, con el <dialog> nativo (accesible con VoiceOver
 * y TalkBack). En Android, el botón «atrás» la cierra en vez de salir de la pantalla.
 *
 *   const [dialog, confirm] = useConfirm();
 *   if (await confirm({ ... })) hacerAlgo();
 */
export function useConfirm(): [React.ReactNode, (options: Options) => Promise<boolean>] {
  const ref = useRef<HTMLDialogElement>(null);
  const resolver = useRef<(value: boolean) => void>(undefined);
  const [options, setOptions] = useState<Options | null>(null);

  const finish = useCallback((value: boolean) => {
    ref.current?.close();
    resolver.current?.(value);
    resolver.current = undefined;
    setOptions(null);
  }, []);

  // «Atrás» de Android: abrir el diálogo añade un paso al historial; volver lo cierra.
  useEffect(() => {
    if (!options) return;
    history.pushState({ dialog: true }, "");
    const onBack = () => finish(false);
    window.addEventListener("popstate", onBack);
    return () => window.removeEventListener("popstate", onBack);
  }, [options, finish]);

  const close = (value: boolean) => {
    // Quitamos el paso que añadimos al abrir (sin disparar el cierre otra vez).
    if (history.state?.dialog) history.back();
    finish(value);
  };

  const confirm = useCallback((next: Options) => {
    setOptions(next);
    queueMicrotask(() => ref.current?.showModal());
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const dialog = (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        close(false);
      }}
      aria-labelledby="confirm-title"
      className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border-2 border-border bg-surface p-6 text-text backdrop:bg-black/60"
    >
      <h2 id="confirm-title" className="text-2xl font-bold">
        {options?.title}
      </h2>
      <p className="mt-3 text-lg">{options?.message}</p>
      <div className="mt-6 grid gap-3">
        <button type="button" onClick={() => close(true)} className={buttonDanger}>
          {options?.confirmLabel}
        </button>
        <button type="button" onClick={() => close(false)} className={buttonSecondary}>
          No, volver
        </button>
      </div>
    </dialog>
  );

  return [dialog, confirm];
}
