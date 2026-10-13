import { Card, buttonPrimary } from "@/components/ui";
import { useInstall } from "./install";

/** Invita a instalar la app: un botón en Android; pasos sencillos en el iPhone. */
export function InstallCard() {
  const state = useInstall();
  if (state.kind === "installed" || state.kind === "unavailable") return null;

  return (
    <Card className="border-accent">
      <h2 className="text-2xl font-bold">Ponla en la pantalla de inicio</h2>
      <p className="mt-2 text-lg">Así la abres como cualquier otra app, con un toque.</p>
      {state.kind === "prompt" ? (
        <button
          type="button"
          onClick={() => void state.install()}
          className={`${buttonPrimary} mt-4`}
        >
          Instalar la app
        </button>
      ) : (
        <ol className="mt-4 space-y-3 text-lg">
          <li>
            <strong>1.</strong> Toca el botón <strong>Compartir</strong> (el cuadrado con una flecha
            hacia arriba), abajo en Safari.
          </li>
          <li>
            <strong>2.</strong> Baja y toca <strong>«Añadir a pantalla de inicio»</strong>.
          </li>
          <li>
            <strong>3.</strong> Toca <strong>«Añadir»</strong>, arriba a la derecha.
          </li>
        </ol>
      )}
    </Card>
  );
}
