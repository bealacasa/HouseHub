import { Link } from "react-router";
import { HomeIcon, LockIcon, UserIcon, UsersIcon } from "@/components/icons";
import { PageTitle, cardShadow } from "@/components/ui";

const ITEMS = [
  { to: "/casa", Icon: HomeIcon, label: "La casa", hint: "Nombre, dirección, foto y notas" },
  { to: "/familia", Icon: UsersIcon, label: "La familia", hint: "Quién está e invitar a alguien" },
  { to: "/ajustes", Icon: UserIcon, label: "Mi cuenta", hint: "Tu foto, nombre, cara o huella" },
  {
    to: "/privacidad",
    Icon: LockIcon,
    label: "Privacidad",
    hint: "Qué datos guardamos y para qué",
  },
] as const;

/** «Más»: una lista de botones grandes con su nombre (nada escondido en menús). */
export function MorePage() {
  return (
    <>
      <PageTitle title="Más" />
      <ul className="space-y-3">
        {ITEMS.map((item) => (
          <li key={item.to}>
            <Link
              to={item.to}
              className={`flex min-h-24 items-center gap-4 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.99] ${cardShadow}`}
            >
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"
              >
                <item.Icon />
              </span>
              <span className="flex-1">
                <span className="block text-xl font-bold">{item.label}</span>
                <span className="block text-lg text-muted">{item.hint}</span>
              </span>
              <span aria-hidden="true" className="text-3xl text-muted">
                ›
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
