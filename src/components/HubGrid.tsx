import { Link } from "react-router";
import { cardShadow } from "./ui";

export type HubItem = {
  to: string;
  Icon: (p: { className?: string }) => React.ReactNode;
  label: string;
  hint: string;
  /** Color de la sección (clases fijas: la CSP no permite estilos en línea). */
  tint: string;
};

/** Botones grandes en cuadrícula, con su nombre y una pista (nada escondido en menús). */
export function HubGrid({ items, label }: { items: readonly HubItem[]; label?: string }) {
  return (
    <ul className="grid grid-cols-2 gap-3" aria-label={label}>
      {items.map(({ to, Icon, label: name, hint, tint }) => (
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
              <span className="block text-xl font-bold leading-tight">{name}</span>
              <span className="mt-1 block text-base text-muted">{hint}</span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
