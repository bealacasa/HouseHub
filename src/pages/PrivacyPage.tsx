import { useNavigate } from "react-router";
import { PageTitle } from "@/components/ui";

/**
 * Política de privacidad en lenguaje claro. Es un borrador: revísalo antes de abrir la app
 * a más familias (sobre todo quién es el responsable y cómo contactar).
 */
export function PrivacyPage() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto w-full max-w-xl px-5 pb-[calc(3rem+env(safe-area-inset-bottom))] pt-[calc(1.5rem+env(safe-area-inset-top))]">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-2 inline-flex min-h-12 items-center text-lg font-semibold text-accent"
      >
        ← Volver
      </button>
      <PageTitle title="Privacidad" subtitle="Lo importante, en pocas palabras." />
      <div className="space-y-5 text-lg">
        <Section title="Qué guardamos">
          Tu correo (para entrar), el nombre que elijas y lo que la familia apunte en la app: casas,
          estancias, tareas, gastos, avisos y contactos útiles. Nada más.
        </Section>
        <Section title="Quién lo ve">
          Solo las personas de cada casa ven los datos de esa casa. Nadie más, ni otras familias.
        </Section>
        <Section title="Dónde se guarda">
          En servidores de la Unión Europea (Supabase, Frankfurt), con conexión cifrada. Los correos
          de acceso se envían con Brevo.
        </Section>
        <Section title="Lo que no hacemos">
          No hay publicidad, ni estadísticas de uso, ni rastreadores. No vendemos ni compartimos tus
          datos.
        </Section>
        <Section title="No guardes datos delicados">
          No escribas en las notas números de tarjeta, cuentas bancarias, códigos de alarma ni
          combinaciones de cajas fuertes.
        </Section>
        <Section title="Tus derechos">
          Puedes ver, corregir, descargar o borrar tus datos. Desde «Mi cuenta» podrás descargarlos
          y borrar tu cuenta (disponible en una próxima versión); mientras tanto, pídeselo a quien
          administra la app en tu familia.
        </Section>
      </div>
    </main>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-2xl font-bold">{title}</h2>
      <p className="mt-1">{children}</p>
    </section>
  );
}
