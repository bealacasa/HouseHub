import { Link } from "react-router";
import { Card, buttonSecondary } from "@/components/ui";

/** Aviso cuando falta activar las excursiones en Supabase (la migración sin ejecutar). */
export function ExcursionsNotReady() {
  return (
    <Card>
      <h2 className="text-2xl font-bold">
        <span aria-hidden="true">🧭 </span>Muy pronto
      </h2>
      <p className="mt-2 text-lg">
        Las excursiones aún no están activadas. Quien administra la casa tiene que terminar de
        prepararlas.
      </p>
      <Link to="/pueblo" className={`${buttonSecondary} mt-4`}>
        Volver a Pueblo
      </Link>
    </Card>
  );
}
