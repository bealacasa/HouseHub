import { NavLink, Outlet } from "react-router";
import { CalendarIcon, EuroIcon, HomeIcon, MoreIcon } from "@/components/icons";
import { useHouse } from "@/features/house/HouseGate";
import { currentSeason } from "@/lib/season";
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
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <p className="mx-auto flex max-w-xl items-center gap-3 text-xl font-extrabold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-10 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-contrast shadow-md shadow-accent/25"
          >
            {currentSeason() === "halloween" ? (
              <span className="text-2xl leading-none">🎃</span>
            ) : (
              <HomeIcon className="size-6" />
            )}
          </span>
          <span className="truncate">{house.name}</span>
        </p>
      </header>
      <main
        id="contenido"
        className="mx-auto w-full max-w-xl flex-1 px-4 pb-[calc(7rem+env(safe-area-inset-bottom))] pt-5"
      >
        <Outlet />
      </main>
      <UpdatePrompt />
      <nav
        aria-label="Secciones"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-bg/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl"
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
                      className={`grid h-9 w-16 place-items-center rounded-full transition-colors ${
                        isActive ? "bg-accent-soft" : ""
                      }`}
                    >
                      <Icon className="size-7" />
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
