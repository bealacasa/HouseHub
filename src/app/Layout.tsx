import { Link, Outlet, useLocation } from "react-router";
import { Avatar } from "@/components/Avatar";
import { CalendarIcon, EuroIcon, HomeIcon, KeyIcon, MapIcon } from "@/components/icons";
import { useHouse } from "@/features/house/HouseGate";
import { currentSeason } from "@/lib/season";
import { UpdatePrompt } from "@/pwa/UpdatePrompt";

/**
 * Cinco pestañas por tema, siempre con texto (nunca solo iconos). Cada una se marca
 * también en sus pantallas de dentro (p. ej. «Pueblo» en Excursiones).
 */
const TABS = [
  { to: "/", label: "Inicio", Icon: HomeIcon, paths: [] },
  { to: "/calendario", label: "Calendario", Icon: CalendarIcon, paths: ["/calendario"] },
  { to: "/gastos", label: "Gastos", Icon: EuroIcon, paths: ["/gastos"] },
  { to: "/casa", label: "Casa", Icon: KeyIcon, paths: ["/casa", "/instrucciones", "/notas"] },
  { to: "/pueblo", label: "Pueblo", Icon: MapIcon, paths: ["/pueblo", "/eventos", "/excursiones"] },
] as const;

const isIn = (pathname: string, base: string) =>
  pathname === base || pathname.startsWith(`${base}/`);

export function Layout() {
  const { house, me, members } = useHouse();
  const { pathname } = useLocation();
  const activeTab = TABS.find((t) =>
    t.paths.length === 0 ? pathname === "/" : t.paths.some((p) => isIn(pathname, p)),
  );
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Una sola casa: su nombre, siempre visible arriba. */}
      <header className="sticky top-0 z-30 border-b border-border bg-bg/90 px-4 pb-3 pt-[calc(0.75rem+env(safe-area-inset-top))] backdrop-blur-xl">
        <p className="mx-auto flex max-w-xl items-center gap-3 text-xl font-extrabold tracking-tight">
          <span
            aria-hidden="true"
            className="grid size-10 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-contrast shadow-md shadow-accent/25 max-[399px]:hidden"
          >
            {currentSeason() === "halloween" ? (
              <span className="text-2xl leading-none">🎃</span>
            ) : (
              <HomeIcon className="size-6" />
            )}
          </span>
          <span className="min-w-0 flex-1 truncate">{house.name}</span>
          {/* Familia y ajustes: con tu foto, siempre a mano y con texto. */}
          <Link
            to="/cuenta"
            className="flex min-h-12 shrink-0 items-center gap-2 rounded-full border border-border bg-surface py-1 pl-1 pr-3 text-base font-bold"
          >
            <Avatar member={me} members={members} size="sm" />
            Ajustes
          </Link>
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
        <ul className="mx-auto flex max-w-xl px-1">
          {TABS.map(({ to, label, Icon }) => {
            const isActive = activeTab?.to === to;
            return (
              // Ancho según el nombre: «Calendario» necesita más sitio que «Casa».
              <li key={to} className="min-w-0 flex-auto">
                <Link
                  to={to}
                  aria-current={isActive ? "page" : undefined}
                  className={`flex min-h-[4.5rem] flex-col items-center justify-center gap-1 px-0.5 text-center text-base font-bold leading-tight hyphens-auto break-words max-[359px]:text-[0.85rem] ${
                    isActive ? "text-accent" : "text-muted"
                  }`}
                >
                  <span
                    className={`grid h-9 w-14 place-items-center rounded-full transition-colors max-[359px]:w-11 ${
                      isActive ? "bg-accent-soft" : ""
                    }`}
                  >
                    <Icon className="size-7" />
                  </span>
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
