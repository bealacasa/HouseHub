import { Link } from "react-router";
import { PageTitle } from "@/components/ui";

const ITEMS = [
  { to: "/ajustes", label: "Mi cuenta y ajustes", hint: "Tu nombre, cara o huella, cerrar sesión" },
  { to: "/privacidad", label: "Privacidad", hint: "Qué datos guardamos y para qué" },
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
              className="flex min-h-20 items-center gap-3 rounded-3xl border-2 border-border bg-surface p-5 active:scale-[0.99]"
            >
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
