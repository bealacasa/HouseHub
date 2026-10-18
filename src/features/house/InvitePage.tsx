import { useEffect, useState } from "react";
import { Link, Navigate } from "react-router";
import { ErrorMessage, buttonPrimary } from "@/components/ui";
import { inviteTokenSchema, savePendingInvite } from "./house";

/**
 * Llega desde el enlace de WhatsApp: /invitacion#t=TOKEN. El token va tras «#», así que
 * nunca se envía a ningún servidor ni queda en registros. Se guarda en el móvil, se borra
 * de la barra de direcciones y, tras entrar (o si ya hay sesión), se acepta solo.
 */
export function InvitePage() {
  // Se guarda al instante (antes de redirigir), no en un efecto.
  const [valid] = useState(() => {
    const token = new URLSearchParams(window.location.hash.slice(1)).get("t");
    const ok = token !== null && inviteTokenSchema.safeParse(token).success;
    if (ok) savePendingInvite(token);
    return ok;
  });

  useEffect(() => {
    // Quita el token de la barra (y del historial) en cuanto se ha guardado.
    history.replaceState(null, "", window.location.pathname);
  }, []);

  if (!valid) {
    return (
      <main className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center gap-5 px-5">
        <ErrorMessage>
          Este enlace de invitación no es válido. Pide uno nuevo a quien administra la casa.
        </ErrorMessage>
        <Link to="/" replace className={buttonPrimary}>
          Ir al inicio
        </Link>
      </main>
    );
  }
  // El inicio pide entrar si hace falta; después la invitación se acepta sola.
  return <Navigate to="/" replace />;
}
