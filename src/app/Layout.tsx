import { NavLink, Outlet } from "react-router";
import { CalendarIcon, EuroIcon, HomeIcon, MoreIcon } from "@/components/icons";
import { useHouse } from "@/features/house/HouseGate";
import { UpdatePrompt } from "@/pwa/UpdatePrompt";

/** Cuatro pestañas, siempre con texto (nunca solo iconos). */
const TABS = [
  { to: "/", label: "Inicio", Icon: HomeIcon, end: true },
  { to: "/calendario", label: "Calendario", Icon: CalendarIcon, end: false },
  { to: "/gastos", label: "Gastos", Icon: EuroIcon, end: false },
  { to: "/mas", label: "Más", Icon: MoreIcon, end: false },
] as const;

export function Layout() {
  const { house } = useHouse();
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Una sola casa: su nombre, siempre visible arriba. */}
      <header className="bg-linear-to-br from-accent to-accent-2 px-4 pb-4 pt-[calc(0.9rem+env(safe-area-inset-top))] text-accent-contrast">
        <p className="mx-auto flex max-w-xl items-center gap-2 text-xl font-bold">
          <span
            aria-hidden="true"
            className="grid size-9 place-items-center rounded-xl bg-white/20"
          >
            <HomeIcon className="size-5" />
          </span>
          <span className="truncate">{house.name}</span>
        </p>
      </header>
      <main
        id="contenido"
        className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(8.5rem+env(safe-area-inset-bottom))] pt-6"
      >
        <Outlet />
      </main>
      <UpdatePrompt />
      {/* Barra flotante, con texto grande en cada botón. */}
      <nav
        aria-label="Secciones"
        className="fixed inset-x-3 bottom-[calc(0.6rem+env(safe-area-inset-bottom))] z-40 mx-auto max-w-xl rounded-3xl border border-border/70 bg-surface/95 p-1.5 shadow-[0_8px_30px_rgb(15_23_42/0.18)] backdrop-blur"
      >
        <ul className="flex gap-1">
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-16 flex-col items-center justify-center gap-0.5 rounded-2xl px-0.5 text-[0.95rem] font-bold leading-tight tracking-tight transition-colors ${
                    isActive
                      ? "bg-linear-to-br from-accent to-accent-2 text-accent-contrast shadow-md"
                      : "text-muted"
                  }`
                }
              >
                <Icon className="size-6" />
                {label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
