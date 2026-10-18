/*
 * Piezas básicas de la interfaz. Pensadas para personas mayores: botones de 56–64 px, texto
 * siempre visible (nunca solo iconos) y contraste alto. Todo en rem: crece con la letra del
 * móvil. Estilo: tarjetas blancas con sombra suave y degradados discretos.
 */

const base =
  "inline-flex w-full items-center justify-center gap-3 rounded-2xl px-5 text-center font-bold transition active:scale-[0.98] disabled:opacity-50 motion-reduce:transition-none";

/** Botón principal: la acción importante de la pantalla. */
export const buttonPrimary = `${base} min-h-16 bg-linear-to-br from-accent to-accent-2 text-xl text-accent-contrast shadow-lg shadow-accent/25`;
/** Botón secundario: fondo suave, mismo tamaño táctil. */
export const buttonSecondary = `${base} min-h-14 border-2 border-accent/40 bg-accent-soft text-lg text-accent`;
/** Acción peligrosa (borrar, cerrar sesión en todo). */
export const buttonDanger = `${base} min-h-14 border-2 border-danger bg-surface text-lg text-danger`;

export const inputClass =
  "block min-h-14 w-full rounded-2xl border-2 border-field bg-surface px-4 text-lg text-text placeholder:text-muted focus:border-accent";

/** Sombra de las tarjetas (clase, no estilo en línea: lo exige la CSP). */
export const cardShadow = "shadow-[0_1px_2px_rgb(15_23_42/0.06),0_8px_24px_rgb(15_23_42/0.07)]";

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-extrabold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-1 text-lg text-muted">{subtitle}</p>}
    </header>
  );
}

export function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-3xl border border-border/70 bg-surface p-5 ${cardShadow} ${className}`}
    >
      {children}
    </section>
  );
}

/** Enlace «← Volver» de arriba de cada pantalla. */
export const backLink =
  "mb-3 inline-flex min-h-12 items-center gap-1 rounded-full bg-surface px-4 text-lg font-semibold text-accent shadow-sm";

/** Mensaje de error en palabras claras (y con icono y texto, no solo color). */
export function ErrorMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="alert" className="rounded-2xl bg-danger-soft p-4 text-lg font-semibold text-danger">
      <span aria-hidden="true">⚠️ </span>
      {children}
    </p>
  );
}

/** Confirmación de que algo ha ido bien. Se queda visible: no desaparece sola. */
export function SuccessMessage({ children }: { children: React.ReactNode }) {
  return (
    <p role="status" className="rounded-2xl bg-accent-soft p-4 text-lg font-semibold text-text">
      <span aria-hidden="true">✓ </span>
      {children}
    </p>
  );
}
