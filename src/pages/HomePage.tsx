import { TINTS } from "@/components/tints";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import {
  BellIcon,
  CalendarIcon,
  CameraIcon,
  DoorIcon,
  EuroIcon,
  HomeIcon,
  ListIcon,
  UsersIcon,
} from "@/components/icons";
import { Card, buttonSecondary, cardShadow } from "@/components/ui";
import { useMe } from "@/features/auth/RequireAuth";
import { shortDate, staysOn, toKey, useStays } from "@/features/calendar/stays";
import { MyBalance } from "@/features/expenses/ExpensesPage";
import { useLedger } from "@/features/expenses/expenses";
import { balances } from "@/features/expenses/money";
import { useHouse } from "@/features/house/HouseGate";
import { useHousePhotoUrl } from "@/features/house/photo";
import { useNotes } from "@/features/notes/notes";
import { dueLabel, useReminders } from "@/features/reminders/reminders";
import { InstallCard } from "@/pwa/InstallCard";

/**
 * Inicio: «¿qué pasa hoy y qué tengo que hacer?». Un solo estilo (título y tarjeta con
 * filas que se tocan) y solo lo que tiene contenido: los bloques vacíos no se enseñan.
 */
export function HomePage() {
  const { profile } = useMe();
  const { house, members, isAdmin } = useHouse();
  const photo = useHousePhotoUrl(house.photoPath);
  const onlyMe = members.length === 1;

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
          <InTheHouse />
          {!house.photoPath && (
            <Link
              to="/casa/datos"
              className="mt-2 inline-flex min-h-12 items-center gap-2 text-base font-semibold underline underline-offset-4 opacity-90"
            >
              <CameraIcon className="size-5" />
              Poner una foto de la casa
            </Link>
          )}
        </div>
      </header>
      <QuickActions />
      <div className="mt-6 space-y-6">
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
        <Today />
        <Upcoming />
        <BalanceLink />
        <InstallCard />
      </div>
    </>
  );
}

/** «En la casa: Ana (hasta el sábado)» dentro del saludo, con el icono de la casa. */
function InTheHouse() {
  const { members } = useHouse();
  const stays = useStays();
  if (!stays.isSuccess) return null;
  const today = toKey(new Date());
  const now = staysOn(stays.data, today);
  const names = members
    .filter((m) => now.some((s) => s.memberId === m.id))
    .map((m) => m.displayName);
  const lastEnd = now
    .map((s) => s.end)
    .sort()
    .at(-1);
  return (
    <p className="mt-3 flex items-center gap-2 text-lg font-semibold">
      <HomeIcon className="size-6 shrink-0" />
      {names.length === 0
        ? "Ahora no hay nadie en la casa"
        : `En la casa: ${listNames(names)}${
            lastEnd && lastEnd !== today
              ? ` (hasta el ${format(new Date(`${lastEnd}T12:00:00`), "EEEE d", { locale: es })})`
              : " (se va hoy)"
          }`}
    </p>
  );
}

const listNames = (names: string[]) =>
  names.length <= 1 ? (names[0] ?? "") : `${names.slice(0, -1).join(", ")} y ${names.at(-1)}`;

/** Bloque con título fuera y filas dentro (mismo estilo en todo el Inicio). */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="mb-2 px-1 text-2xl font-bold">
        {title}
      </h2>
      <Card className="px-0! py-1!">
        <ul className="divide-y divide-border">{children}</ul>
      </Card>
    </section>
  );
}

type Tone = "normal" | "late" | "accent";

/** Icono de línea en un cuadrado de color: el mismo estilo que los accesos y las pestañas. */
function IconTile({
  Icon,
  tint,
}: {
  Icon: (p: { className?: string }) => React.ReactNode;
  tint: string;
}) {
  return (
    <span className={`grid size-10 place-items-center rounded-xl ${tint}`}>
      <Icon className="size-6" />
    </span>
  );
}

/** Fila que se toca: icono, texto y una línea de detalle opcional. */
function Row({
  to,
  icon,
  title,
  detail,
  tone = "normal",
}: {
  to: string;
  icon: React.ReactNode;
  title: string;
  detail?: string;
  tone?: Tone;
}) {
  return (
    <li>
      <Link to={to} className="flex min-h-16 items-center gap-3 px-4 py-3 active:bg-surface-2">
        <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center">
          {icon}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-lg font-bold leading-snug">{title}</span>
          {detail && (
            <span
              className={`block text-base first-letter:uppercase ${
                tone === "late"
                  ? "font-semibold text-danger"
                  : tone === "accent"
                    ? "font-semibold text-accent"
                    : "text-muted"
              }`}
            >
              {detail}
            </span>
          )}
        </span>
        <span aria-hidden="true" className="text-2xl text-muted">
          ›
        </span>
      </Link>
    </li>
  );
}

/**
 * Hoy: la lista para cerrar la casa si tu reserva acaba hoy, tus recordatorios de
 * hoy y los que se pasaron (solo los tuyos) y las notas pendientes de la casa.
 */
function Today() {
  const { me } = useHouse();
  const stays = useStays();
  const reminders = useReminders();
  const notes = useNotes();
  const today = toKey(new Date());
  const mine = (stays.data ?? []).filter((s) => s.memberId === me.id);
  const leaving = mine.some((s) => s.end === today);
  const dueNow = (reminders.data ?? []).filter((r) => !r.done && r.due !== null && r.due <= today);
  const pending = (notes.data ?? []).filter((n) => !n.done);
  if (!stays.isFetched || !notes.isFetched) return null;

  const rows = [
    leaving && (
      <Row
        key="irse"
        to="/irse"
        icon={<IconTile Icon={DoorIcon} tint={TINTS.leave} />}
        title="¿Te vas hoy? Lista para cerrar la casa"
        tone="accent"
      />
    ),
    ...dueNow.map((r) => (
      <Row
        key={r.id}
        to="/recordatorios"
        icon={<IconTile Icon={BellIcon} tint={TINTS.reminders} />}
        title={r.text}
        detail={dueLabel(r.due, today) ?? undefined}
        tone={r.due !== null && r.due < today ? "late" : "accent"}
      />
    )),
    pending.length > 0 && (
      <Row
        key="notas"
        to="/notas"
        icon={<IconTile Icon={ListIcon} tint={TINTS.notes} />}
        title={pending.length === 1 ? "1 nota pendiente" : `${pending.length} notas pendientes`}
        detail={pending
          .slice(0, 2)
          .map((n) => n.text)
          .join(" · ")}
      />
    ),
  ].filter(Boolean);

  return (
    <section aria-labelledby="hoy">
      <h2 id="hoy" className="mb-2 px-1 text-2xl font-bold">
        Hoy
      </h2>
      {rows.length === 0 ? (
        <Card>
          <p className="text-lg text-muted">
            <span aria-hidden="true">✓ </span>Nada pendiente para hoy.
          </p>
        </Card>
      ) : (
        <Card className="px-0! py-1!">
          <ul className="divide-y divide-border">{rows}</ul>
        </Card>
      )}
    </section>
  );
}

/** Próximamente: las 3 próximas reservas y el enlace al calendario. */
function Upcoming() {
  const { members } = useHouse();
  const stays = useStays();
  if (!stays.isSuccess) return null;
  const today = toKey(new Date());
  const next = stays.data.filter((s) => s.start > today).slice(0, 3);
  return (
    <Section id="proximamente" title="Próximamente">
      {next.map((s) => {
        const member = members.find((m) => m.id === s.memberId);
        return (
          <Row
            key={s.id}
            to={`/calendario/${s.id}`}
            icon={
              member ? (
                <Avatar member={member} members={members} size="sm" />
              ) : (
                <IconTile Icon={CalendarIcon} tint={TINTS.calendar} />
              )
            }
            title={member?.displayName ?? "Alguien"}
            detail={`${s.start === s.end ? shortDate(s.start) : `${shortDate(s.start)} – ${shortDate(s.end)}`} · ${s.people} ${s.people === 1 ? "persona" : "personas"}`}
          />
        );
      })}
      <Row
        to="/calendario"
        icon={<IconTile Icon={CalendarIcon} tint={TINTS.calendar} />}
        title={next.length === 0 ? "No hay reservas próximas" : "Ver el calendario"}
        detail={next.length === 0 ? "Toca para reservar o ver el calendario" : undefined}
      />
    </Section>
  );
}

/** Tu saldo, solo si hay algo pendiente («Debes 20 €» / «Te deben 35 €»). */
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
  if (mine === 0) return null;
  return (
    <Link to="/gastos" className="block rounded-3xl active:scale-[0.99]">
      <MyBalance cents={mine} />
    </Link>
  );
}

/** Lo que más se hace, en una fila (1 toque). El resto está en las pestañas. */
const ACTIONS = [
  {
    to: "/calendario/nueva",
    label: "Reservar días",
    Icon: CalendarIcon,
    tint: TINTS.calendar,
  },
  {
    to: "/gastos/nuevo",
    label: "Apuntar gasto",
    Icon: EuroIcon,
    tint: TINTS.expenses,
  },
  {
    to: "/notas",
    label: "Añadir nota",
    Icon: ListIcon,
    tint: TINTS.notes,
  },
] as const;

function QuickActions() {
  return (
    <nav aria-label="Accesos rápidos">
      <ul className="grid grid-cols-3 gap-2">
        {ACTIONS.map(({ to, label, Icon, tint }) => (
          <li key={to}>
            <Link
              to={to}
              className={`flex h-full min-h-24 flex-col items-center justify-center gap-1.5 rounded-3xl border border-border/70 bg-surface p-2 text-center active:scale-[0.98] ${cardShadow}`}
            >
              <span
                aria-hidden="true"
                className={`grid size-11 shrink-0 place-items-center rounded-2xl ${tint}`}
              >
                <Icon className="size-6" />
              </span>
              <span className="text-base font-bold leading-tight">{label}</span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
