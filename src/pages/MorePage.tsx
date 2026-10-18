import { Link } from "react-router";
import {
  BookIcon,
  CalendarIcon,
  HomeIcon,
  ListIcon,
  LockIcon,
  UserIcon,
  UsersIcon,
} from "@/components/icons";
import { PageTitle, cardShadow } from "@/components/ui";

/** Cada sección con su color (clases fijas: la CSP no permite estilos en línea). */
const ITEMS = [
  {
    to: "/instrucciones",
    Icon: BookIcon,
    label: "Instrucciones",
    hint: "Caldera, placa…",
    tint: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  },
  {
    to: "/notas",
    Icon: ListIcon,
    label: "Notas",
    hint: "Lo que falta",
    tint: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    to: "/eventos",
    Icon: CalendarIcon,
    label: "Eventos del pueblo",
    hint: "Fiestas, mercado",
    tint: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
  },
  {
    to: "/familia",
    Icon: UsersIcon,
    label: "La familia",
    hint: "Invitar a alguien",
    tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    to: "/casa",
    Icon: HomeIcon,
    label: "La casa",
    hint: "Foto y datos",
    tint: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  {
    to: "/ajustes",
    Icon: UserIcon,
    label: "Mi cuenta",
    hint: "Foto, cara o huella",
    tint: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  },
] as const;

/** «Más»: botones grandes con su nombre (nada escondido en menús). */
export function MorePage() {
  return (
    <>
      <PageTitle title="Más" />
      <ul className="grid grid-cols-2 gap-3">
        {ITEMS.map(({ to, Icon, label, hint, tint }) => (
          <li key={to}>
            <Link
              to={to}
              className={`flex h-full min-h-40 flex-col justify-between gap-3 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.98] ${cardShadow}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-14 place-items-center rounded-2xl ${tint}`}
              >
                <Icon />
              </span>
              <span>
                <span className="block text-xl font-bold leading-tight">{label}</span>
                <span className="mt-1 block text-base text-muted">{hint}</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      <Link
        to="/privacidad"
        className="mt-5 flex min-h-14 items-center justify-center gap-2 rounded-2xl text-lg font-semibold text-muted"
      >
        <LockIcon className="size-5" />
        Privacidad
      </Link>
    </>
  );
}
