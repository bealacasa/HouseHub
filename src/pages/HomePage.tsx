import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import { BookIcon, CalendarIcon, EuroIcon, ListIcon, UsersIcon } from "@/components/icons";
import { Card, buttonSecondary, cardShadow } from "@/components/ui";
import { useMe } from "@/features/auth/RequireAuth";
import { StayCard } from "@/features/calendar/CalendarPage";
import { staysOn, toKey, useStays } from "@/features/calendar/stays";
import { ExcursionCard } from "@/features/excursions/ExcursionsPage";
import { useExcursions } from "@/features/excursions/excursions";
import { useHouse } from "@/features/house/HouseGate";
import { useHousePhotoUrl } from "@/features/house/photo";
import { useNotes } from "@/features/notes/notes";
import { MyBalance } from "@/features/expenses/ExpensesPage";
import { useLedger } from "@/features/expenses/expenses";
import { balances } from "@/features/expenses/money";
import { currentSeason } from "@/lib/season";
import { InstallCard } from "@/pwa/InstallCard";

/** Inicio. En las próximas fases: «Llego / Me voy», avisos y saldo. */
export function HomePage() {
  const { profile } = useMe();
  const { house, members, isAdmin } = useHouse();
  const photo = useHousePhotoUrl(house.photoPath);
  const onlyMe = members.length === 1;
  const halloween = currentSeason() === "halloween";

  return (
    <>
      {/* Bienvenida: sobre la foto de la casa (si hay) o sobre el degradado de la app. */}
      <header
        className={`relative mb-5 overflow-hidden rounded-[2rem] bg-linear-to-br from-accent to-accent-2 p-6 shadow-xl shadow-accent/20 ${photo.data ? "text-white" : "text-accent-contrast"}`}
      >
        {photo.data && (
          <>
            <img src={photo.data} alt="" className="absolute inset-0 size-full object-cover" />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-t from-black/80 via-black/40 to-black/10"
            />
          </>
        )}
        <div className={`relative ${photo.data ? "pt-24" : ""}`}>
          <p className="text-lg font-semibold opacity-90 first-letter:uppercase">
            {format(new Date(), "EEEE d 'de' MMMM", { locale: es })}
          </p>
          <h1 className="text-4xl font-extrabold leading-tight tracking-tight">
            Hola, {profile.displayName}
          </h1>
          {halloween && (
            <p className="mt-2 text-xl font-bold">
              <span aria-hidden="true">🎃 </span>¡Feliz Halloween!
            </p>
          )}
        </div>
        {/* Adorno de temporada (solo decoración). */}
        {halloween && (
          <span aria-hidden="true" className="absolute right-4 top-3 text-3xl">
            🦇
          </span>
        )}
      </header>
      <QuickActions />
      <div className="mt-6 space-y-5">
        {isAdmin && onlyMe && (
          <Card className="border-accent/40 bg-accent-soft!">
            <div className="flex items-start gap-4">
              <span
                aria-hidden="true"
                className="grid size-14 shrink-0 place-items-center rounded-2xl bg-linear-to-br from-accent to-accent-2 text-accent-contrast"
              >
                <UsersIcon />
              </span>
              <div>
                <h2 className="text-2xl font-bold">Invita a la familia</h2>
                <p className="mt-1 text-lg">
                  Manda un enlace por WhatsApp a cada persona para que entre en {house.name}.
                </p>
              </div>
            </div>
            <Link to="/familia" className={`${buttonSecondary} mt-4 bg-surface`}>
              Invitar a alguien
            </Link>
          </Card>
        )}
        <WhoIsGoing />
        <PendingNotes />
        <ExcursionIdeas />
        <BalanceLink />
        {house.notes && (
          <Card>
            <h2 className="text-2xl font-bold">ℹ️ Información de la casa</h2>
            <p className="mt-2 whitespace-pre-line text-lg">{house.notes}</p>
          </Card>
        )}
        <InstallCard />
      </div>
    </>
  );
}

/** Quién está ahora en la casa y quién va a ir (las 2 próximas reservas). */
function WhoIsGoing() {
  const { members } = useHouse();
  const stays = useStays();
  const today = toKey(new Date());
  const all = stays.data ?? [];
  const now = staysOn(all, today);
  const next = all.filter((s) => s.start > today).slice(0, 2);
  if (stays.isPending) return null;
  const present = members.filter((m) => now.some((s) => s.memberId === m.id));

  return (
    <section aria-labelledby="quien-va" className="space-y-3">
      <Card>
        <h2 id="quien-va" className="text-2xl font-bold">
          ¿Quién está en la casa?
        </h2>
        {present.length > 0 ? (
          <ul className="mt-3 flex flex-wrap gap-3">
            {present.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-2 rounded-full bg-surface-2 py-1 pl-1 pr-4"
              >
                <Avatar member={m} members={members} size="sm" />
                <span className="text-lg font-bold">{m.displayName}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-lg text-muted">Ahora mismo no hay nadie.</p>
        )}
      </Card>
      {next.length > 0 && (
        <>
          <h3 className="px-1 pt-2 text-xl font-bold">Próximamente</h3>
          <ul className="space-y-3">
            {next.map((s) => (
              <li key={s.id}>
                <StayCard stay={s} members={members} />
              </li>
            ))}
          </ul>
        </>
      )}
      <Link to="/calendario" className={buttonSecondary}>
        Ver el calendario
      </Link>
    </section>
  );
}

/** Notas pendientes («falta aceite»…), las 3 últimas. */
function PendingNotes() {
  const notes = useNotes();
  const pending = (notes.data ?? []).filter((n) => !n.done);
  if (!notes.isSuccess) return null;
  return (
    <Card>
      <h2 className="text-2xl font-bold">
        Notas de la casa{" "}
        {pending.length > 0 && <span className="text-muted">({pending.length})</span>}
      </h2>
      {pending.length === 0 ? (
        <p className="mt-2 text-lg text-muted">No hay nada pendiente.</p>
      ) : (
        <ul className="mt-3 space-y-2 text-lg">
          {pending.slice(0, 3).map((n) => (
            <li key={n.id} className="flex gap-2">
              <span aria-hidden="true" className="text-accent">
                •
              </span>
              {n.text}
            </li>
          ))}
        </ul>
      )}
      <Link to="/notas" className={`${buttonSecondary} mt-4`}>
        {pending.length > 0 ? "Ver y tachar" : "Añadir una nota"}
      </Link>
    </Card>
  );
}

/**
 * Excursiones: hasta 3 ideas, primero las que aún no hemos hecho y luego las de hace más
 * tiempo. Si la sección aún no está activada en Supabase (o falla), no se enseña.
 */
function ExcursionIdeas() {
  const excursions = useExcursions();
  if (!excursions.isSuccess) return null;
  const today = toKey(new Date());
  const ideas = [...excursions.data.items]
    .sort((a, b) => (a.lastVisited ?? "").localeCompare(b.lastVisited ?? ""))
    .slice(0, 3);
  return (
    <section aria-labelledby="excursiones-inicio" className="space-y-3">
      <h2 id="excursiones-inicio" className="px-1 text-2xl font-bold">
        ¿De excursión?
      </h2>
      {ideas.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          Aún no hay excursiones. Apunta los sitios bonitos de cerca.
        </p>
      ) : (
        <ul className="space-y-3">
          {ideas.map((x) => (
            <li key={x.id}>
              <ExcursionCard excursion={x} today={today} />
            </li>
          ))}
        </ul>
      )}
      <Link
        to={ideas.length === 0 ? "/excursiones/nueva" : "/excursiones"}
        className={buttonSecondary}
      >
        {ideas.length === 0
          ? "Añadir una excursión"
          : excursions.data.items.length > ideas.length
            ? `Ver las ${excursions.data.items.length} excursiones`
            : "Ver las excursiones"}
      </Link>
    </section>
  );
}

/** Tu saldo de gastos («Debes 20 €» / «Te deben 35 €»), con enlace a Gastos. */
function BalanceLink() {
  const { members, me } = useHouse();
  const ledger = useLedger();
  if (!ledger.isSuccess || ledger.data.expenses.length === 0) return null;
  const mine =
    balances(
      members.map((m) => m.id),
      ledger.data.expenses,
      ledger.data.settlements,
    ).get(me.id) ?? 0;
  return (
    <Link to="/gastos" className="block rounded-3xl active:scale-[0.99]">
      <MyBalance cents={mine} />
    </Link>
  );
}

/** Accesos rápidos a lo que más se hace (1 toque). */
const ACTIONS = [
  {
    to: "/calendario/nueva",
    label: "Reservar días",
    Icon: CalendarIcon,
    tint: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  },
  {
    to: "/gastos/nuevo",
    label: "Apuntar gasto",
    Icon: EuroIcon,
    tint: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  },
  {
    to: "/notas",
    label: "Añadir nota",
    Icon: ListIcon,
    tint: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  },
  {
    to: "/instrucciones",
    label: "Instrucciones",
    Icon: BookIcon,
    tint: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
  },
] as const;

function QuickActions() {
  return (
    <nav aria-label="Accesos rápidos">
      <ul className="grid grid-cols-2 gap-3">
        {ACTIONS.map(({ to, label, Icon, tint }) => (
          <li key={to}>
            <Link
              to={to}
              className={`flex min-h-28 flex-col justify-between gap-2 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.98] ${cardShadow}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-12 shrink-0 place-items-center rounded-2xl ${tint}`}
              >
                <Icon />
              </span>
              <span className="text-lg font-bold leading-tight break-words">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
