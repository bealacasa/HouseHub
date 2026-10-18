import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { CalendarIcon } from "./icons";
import { Card } from "./ui";

/*
 * Piezas comunes de los formularios: secciones en tarjeta, campo de fecha legible y
 * contador − / +. Mismo aspecto en toda la app; textos y botones grandes.
 */

/** Grupo de campos con su título (y una explicación corta opcional). */
export function FormSection({
  title,
  hint,
  children,
  as = "section",
}: {
  title?: string;
  hint?: string;
  children: React.ReactNode;
  as?: "section" | "fieldset";
}) {
  const Heading = as === "fieldset" ? "legend" : "h2";
  return (
    <Card className="space-y-4">
      {(title || hint) && (
        <div className={as === "fieldset" ? "contents" : ""}>
          {title && <Heading className="text-xl font-bold">{title}</Heading>}
          {hint && <p className="-mt-2 text-base text-muted">{hint}</p>}
        </div>
      )}
      {children}
    </Card>
  );
}

export const fieldLabel = "mb-1.5 block text-lg font-semibold";

/** "vie 23 oct" (con el año si no es el actual). */
export function shortDay(key: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return "Elegir día";
  const date = parseISO(key);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return format(date, sameYear ? "EEE d MMM" : "d MMM yyyy", { locale: es });
}

/**
 * Fecha legible («vie 23 oct») con un icono. Por encima hay un <input type="date">
 * invisible: al tocar se abre el selector de fecha del propio móvil (iPhone o Android).
 */
export function DateField({
  id,
  label,
  value,
  onChange,
  min,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className={fieldLabel}>
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type="date"
          value={value}
          min={min}
          onChange={(e) => e.target.value && onChange(e.target.value)}
          className="peer absolute inset-0 z-10 size-full cursor-pointer opacity-0"
        />
        <div
          aria-hidden="true"
          className="flex min-h-14 items-center justify-between gap-2 rounded-2xl border-2 border-field bg-surface px-4 text-lg font-semibold first-letter:uppercase peer-focus-visible:border-accent peer-focus-visible:ring-3 peer-focus-visible:ring-focus"
        >
          <span className="truncate first-letter:uppercase">{shortDay(value)}</span>
          <CalendarIcon className="size-6 shrink-0 text-accent" />
        </div>
      </div>
    </div>
  );
}

/** Número con botones grandes − / + (sin teclado). */
export function Stepper({
  label,
  value,
  onChange,
  min,
  max,
  unit,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  unit?: (n: number) => string;
}) {
  const button =
    "grid size-14 place-items-center rounded-xl text-3xl font-bold text-accent active:scale-95 disabled:opacity-30";
  return (
    <div role="group" aria-label={label}>
      <p className={fieldLabel}>{label}</p>
      <div className="flex items-center justify-between rounded-2xl border-2 border-field bg-surface p-1">
        <button
          type="button"
          onClick={() => onChange(Math.max(min, value - 1))}
          disabled={value <= min}
          aria-label={`Quitar uno (${label.toLowerCase()})`}
          className={button}
        >
          −
        </button>
        <span className="text-2xl font-extrabold tabular-nums" aria-live="polite">
          {value} {unit && <span className="text-lg font-semibold text-muted">{unit(value)}</span>}
        </span>
        <button
          type="button"
          onClick={() => onChange(Math.min(max, value + 1))}
          disabled={value >= max}
          aria-label={`Añadir uno (${label.toLowerCase()})`}
          className={button}
        >
          +
        </button>
      </div>
    </div>
  );
}

/** Aviso corto de no guardar datos delicados (debajo de los campos de notas). */
export function PrivacyHint({ id }: { id: string }) {
  return (
    <p id={id} className="mt-1.5 flex gap-1.5 text-base text-muted">
      <span aria-hidden="true">🔒</span>
      Sin tarjetas, cuentas, códigos de alarma ni combinaciones.
    </p>
  );
}
