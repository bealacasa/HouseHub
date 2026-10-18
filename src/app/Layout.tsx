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
      <header className="border-b-2 border-border bg-surface px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))]">
        <p className="mx-auto max-w-xl truncate text-xl font-bold">
          <span aria-hidden="true">🏡 </span>
          {house.name}
        </p>
      </header>
      <main
        id="contenido"
        className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-5"
      >
        <Outlet />
      </main>
      <UpdatePrompt />
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t-2 border-border bg-surface pb-[env(safe-area-inset-bottom)]"
      >
        <ul className="mx-auto flex max-w-xl">
          {TABS.map(({ to, label, Icon, end }) => (
            <li key={to} className="flex-1">
              <NavLink
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex min-h-[4.5rem] flex-col items-center justify-center gap-1 text-base font-bold ${
                    isActive ? "text-accent" : "text-muted"
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={`grid h-9 w-16 place-items-center rounded-full ${
                        isActive ? "bg-accent-soft" : ""
                      }`}
                    >
                      <Icon />
                    </span>
                    {label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
