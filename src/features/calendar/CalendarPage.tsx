import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Avatar, memberColor } from "@/components/Avatar";
import {
  Card,
  ErrorMessage,
  PageTitle,
  buttonPrimary,
  buttonSecondary,
  cardShadow,
  textButton,
} from "@/components/ui";
import { eventsOn, useEvents, type VillageEvent } from "@/features/events/events";
import { useHouse } from "@/features/house/HouseGate";
import type { Member } from "@/features/house/house";
import {
  longDate,
  monthGrid,
  periodLabel,
  nightsLabel,
  shortDate,
  staysOn,
  toKey,
  useStays,
  type DateKey,
  type Stay,
} from "./stays";

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Calendario de reservas: quién va a la casa y cuándo. */
export function CalendarPage() {
  const { members } = useHouse();
  const stays = useStays();
  const events = useEvents();
  const allEvents = events.data ?? [];
  const [params, setParams] = useSearchParams();
  const today = toKey(new Date());
  const selected = params.get("dia") ?? today;
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${selected}T12:00:00`)));
  // ?persona=… : las reservas de una persona (al tocar su nombre en la leyenda).
  const person = members.find((m) => m.id === params.get("persona")) ?? null;
  const setParam = (name: string, value: string | null) =>
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value === null) next.delete(name);
        else next.set(name, value);
        return next;
      },
      { replace: true },
    );
  const select = (day: DateKey) => setParam("dia", day);

  const all = stays.data ?? [];
  const upcoming = all.filter((s) => s.end >= today);
  // En el calendario, solo las barras de la persona elegida (si hay una).
  const shown = person ? all.filter((s) => s.memberId === person.id) : all;
  // Orden fijo de las barras: así cada reserva ocupa la misma fila todos sus días.
  const lanes = assignLanes(shown);

  return (
    <>
      <PageTitle title="Calendario" subtitle="Quién va a la casa y cuándo." />
      <Link
        to={`/calendario/nueva?dia=${selected < today ? today : selected}`}
        className={`${buttonPrimary} mb-6`}
      >
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Reservar unos días
      </Link>
      {stays.isError && <ErrorMessage>No se han podido cargar las reservas.</ErrorMessage>}

      <Card className="px-2 py-4">
        <div className="mb-4 flex items-center justify-between gap-2 px-2">
          <MonthButton label="Mes anterior" onClick={() => setMonth((m) => addMonths(m, -1))}>
            ‹
          </MonthButton>
          <h2 className="text-2xl font-extrabold capitalize tracking-tight" aria-live="polite">
            {format(month, "MMMM yyyy", { locale: es })}
          </h2>
          <MonthButton label="Mes siguiente" onClick={() => setMonth((m) => addMonths(m, 1))}>
            ›
          </MonthButton>
        </div>
        <div role="grid" aria-label="Días del mes">
          <div
            role="row"
            className="mb-1 grid grid-cols-7 text-center text-base font-bold text-muted"
          >
            {WEEKDAYS.map((d, i) => (
              <span key={d} role="columnheader" aria-label={WEEKDAY_NAMES[i]}>
                {d}
              </span>
            ))}
          </div>
          {monthGrid(month).map((week) => {
            // Solo el espacio de las barras que de verdad hay esta semana.
            const laneCount = Math.min(
              MAX_LANES,
              Math.max(
                0,
                ...week.flatMap((d) =>
                  staysOn(shown, toKey(d)).map((s) => (lanes.get(s.id) ?? 0) + 1),
                ),
              ),
            );
            return (
              <div role="row" key={week.map(toKey).join()} className="grid grid-cols-7">
                {week.map((date) => (
                  <DayCell
                    key={toKey(date)}
                    date={date}
                    inMonth={isSameMonth(date, month)}
                    isToday={toKey(date) === today}
                    isSelected={toKey(date) === selected}
                    stays={staysOn(shown, toKey(date))}
                    events={eventsOn(allEvents, toKey(date))}
                    lanes={lanes}
                    laneCount={laneCount}
                    members={members}
                    onSelect={select}
                  />
                ))}
              </div>
            );
          })}
        </div>
        <Legend
          members={members}
          stays={all}
          selected={person?.id ?? null}
          onToggle={(id) => setParam("persona", id === person?.id ? null : id)}
        />
      </Card>

      {person && (
        <PersonStays
          person={person}
          members={members}
          stays={shown}
          today={today}
          onClose={() => setParam("persona", null)}
        />
      )}

      <Card className="mt-4">
        <section aria-labelledby="dia-elegido">
          {selected === today && (
            <p className="mb-1 inline-block rounded-full bg-accent-soft px-3 text-base font-bold text-accent">
              Hoy
            </p>
          )}
          <h2 id="dia-elegido" className="text-2xl font-bold first-letter:uppercase">
            {longDate(selected)}
          </h2>
          {eventsOn(allEvents, selected).length === 0 && staysOn(all, selected).length === 0 ? (
            <p className="mt-2 text-lg text-muted">La casa está libre ese día.</p>
          ) : (
            <ul className="mt-2 divide-y divide-border">
              {eventsOn(allEvents, selected).map((e) => (
                <li key={e.id}>
                  <EventRow event={e} />
                </li>
              ))}
              {staysOn(all, selected).map((st) => (
                <li key={st.id}>
                  <StayRow stay={st} members={members} />
                </li>
              ))}
            </ul>
          )}
          <Link to={`/eventos/nuevo?dia=${selected}`} className={`${buttonSecondary} mt-3`}>
            <span aria-hidden="true">⭐</span> Añadir evento del pueblo
          </Link>
        </section>
      </Card>

      <section className="mt-8" aria-labelledby="proximas">
        <h2 id="proximas" className="mb-2 text-xl font-bold">
          Próximas reservas
        </h2>
        {upcoming.length === 0 ? (
          <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
            No hay ninguna reserva todavía.
          </p>
        ) : (
          <Card className="overflow-hidden px-4! py-1!">
            <ul className="divide-y divide-border">
              {upcoming.map((st) => (
                <li key={st.id}>
                  <StayRow stay={st} members={members} />
                </li>
              ))}
            </ul>
          </Card>
        )}
      </section>
    </>
  );
}

/** Fila (0, 1, 2…) de cada reserva para que su barra no salte de altura entre días. */
export function assignLanes(stays: readonly Stay[]): Map<string, number> {
  const lanes = new Map<string, number>();
  const laneEnds: string[] = [];
  for (const s of [...stays].sort((a, b) => a.start.localeCompare(b.start))) {
    let lane = laneEnds.findIndex((end) => end < s.start);
    if (lane < 0) lane = laneEnds.length;
    laneEnds[lane] = s.end;
    lanes.set(s.id, lane);
  }
  return lanes;
}

function MonthButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="grid size-14 place-items-center rounded-full bg-surface-2 text-3xl font-bold active:scale-95"
    >
      {children}
    </button>
  );
}

const MAX_LANES = 3;

function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  stays,
  events,
  lanes,
  laneCount,
  members,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  stays: Stay[];
  events: VillageEvent[];
  lanes: Map<string, number>;
  laneCount: number;
  members: readonly Member[];
  onSelect: (day: DateKey) => void;
}) {
  const key = toKey(date);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Alguien";
  const who = stays.map((s) => nameOf(s.memberId)).join(", ");
  const byLane: (Stay | undefined)[] = Array.from({ length: laneCount }, () => undefined);
  for (const s of stays) {
    const lane = lanes.get(s.id) ?? 0;
    if (lane < laneCount) byLane[lane] = s;
  }

  return (
    <button
      type="button"
      role="gridcell"
      onClick={() => onSelect(key)}
      aria-selected={isSelected}
      aria-label={`${longDate(key)}${isToday ? ", hoy" : ""}${who ? `: va ${who}` : ": libre"}${
        events.length > 0 ? `. Evento: ${events.map((e) => e.title).join(", ")}` : ""
      }`}
      className={`flex flex-col items-stretch pb-1.5 pt-0.5 ${inMonth ? "" : "opacity-45"}`}
    >
      <span
        className={`relative mx-auto grid size-10 place-items-center rounded-full text-lg font-semibold tabular-nums ${
          isSelected
            ? "bg-linear-to-br from-accent to-accent-2 font-extrabold text-accent-contrast shadow-md"
            : isToday
              ? "font-extrabold text-accent ring-2 ring-accent"
              : ""
        }`}
      >
        {date.getDate()}
        {/* Evento del pueblo: estrella verde pegada al número (distinta de las reservas). */}
        {events.length > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1 -top-1 grid size-4 place-items-center rounded-full bg-emerald-700 text-[0.6rem] leading-none text-white"
          >
            ★
          </span>
        )}
      </span>
      {/* Barras de reserva: continuas de un día a otro, redondeadas al empezar y acabar. */}
      <span className="mt-1 flex flex-col gap-[3px]" aria-hidden="true">
        {byLane.map((s, lane) =>
          s ? (
            <span
              key={s.id}
              className={`h-1.5 ${memberColor(members, s.memberId).solid} ${
                s.start === key ? "ml-1 rounded-l-full" : ""
              } ${s.end === key ? "mr-1 rounded-r-full" : ""}`}
            />
          ) : (
            <span key={lane} className="h-1.5" />
          ),
        )}
      </span>
    </button>
  );
}

/**
 * Leyenda: color de cada persona que tiene reservas. Cada nombre es un botón: al tocarlo
 * se ven solo sus reservas; al tocarlo otra vez, las de todos.
 */
function Legend({
  members,
  stays,
  selected,
  onToggle,
}: {
  members: readonly Member[];
  stays: readonly Stay[];
  selected: string | null;
  onToggle: (memberId: string) => void;
}) {
  const withStays = members.filter((m) => stays.some((s) => s.memberId === m.id));
  if (withStays.length === 0) return null;
  return (
    <div className="mt-4 px-2">
      <p className="mb-2 text-base text-muted">Toca un nombre para ver sus reservas.</p>
      <ul className="flex flex-wrap gap-2" aria-label="Personas con reservas">
        {withStays.map((m) => {
          const color = memberColor(members, m.id);
          const isOn = selected === m.id;
          return (
            <li key={m.id}>
              <button
                type="button"
                aria-pressed={isOn}
                onClick={() => onToggle(m.id)}
                className={`flex min-h-12 items-center gap-2 rounded-full border-2 px-4 text-lg font-semibold active:scale-95 ${color.soft} ${
                  isOn ? "border-current" : "border-transparent"
                }`}
              >
                <span aria-hidden="true" className={`size-3.5 rounded-full ${color.solid}`} />
                {m.displayName}
                {isOn && <span aria-hidden="true">✓</span>}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Reservas de una persona: las próximas y, si se quiere, las pasadas. */
function PersonStays({
  person,
  members,
  stays,
  today,
  onClose,
}: {
  person: Member;
  members: readonly Member[];
  stays: readonly Stay[];
  today: DateKey;
  onClose: () => void;
}) {
  const [showPast, setShowPast] = useState(false);
  const upcoming = stays.filter((s) => s.end >= today);
  const past = stays.filter((s) => s.end < today).reverse();
  return (
    <Card className="mt-4">
      <section aria-labelledby="reservas-persona">
        <div className="flex items-center gap-3">
          <Avatar member={person} members={members} size="sm" />
          <h2 id="reservas-persona" className="min-w-0 flex-1 text-2xl font-bold">
            Reservas de {person.displayName}
          </h2>
        </div>
        {upcoming.length === 0 ? (
          <p className="mt-3 text-lg text-muted">No tiene reservas próximas.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {upcoming.map((st) => (
              <li key={st.id}>
                <StayRow stay={st} members={members} />
              </li>
            ))}
          </ul>
        )}
        {past.length > 0 && (
          <>
            <button
              type="button"
              onClick={() => setShowPast((v) => !v)}
              aria-expanded={showPast}
              className={`${textButton} mt-2`}
            >
              {showPast ? "Ocultar las pasadas" : `Ver las pasadas (${past.length})`}
            </button>
            {showPast && (
              <ul className="divide-y divide-border opacity-80">
                {past.map((st) => (
                  <li key={st.id}>
                    <StayRow stay={st} members={members} />
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
        <button type="button" onClick={onClose} className={`${buttonSecondary} mt-3`}>
          Ver las reservas de todos
        </button>
      </section>
    </Card>
  );
}

/** Fila compacta de una reserva (dentro de una tarjeta con separadores). */
function StayRow({ stay, members }: { stay: Stay; members: readonly Member[] }) {
  const member = members.find((m) => m.id === stay.memberId);
  const color = memberColor(members, stay.memberId);
  const sameDay = stay.start === stay.end;
  return (
    <Link to={`/calendario/${stay.id}`} className="flex min-h-18 items-center gap-3 py-3">
      {member ? (
        <Avatar member={member} members={members} size="sm" />
      ) : (
        <span aria-hidden="true" className={`size-10 rounded-full ${color.solid}`} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">{member?.displayName ?? "Alguien"}</span>
        <span className="block truncate text-base text-muted">
          {sameDay ? shortDate(stay.start) : `${shortDate(stay.start)} – ${shortDate(stay.end)}`} ·{" "}
          {stay.people} {stay.people === 1 ? "persona" : "personas"}
        </span>
      </span>
      <span aria-hidden="true" className={`h-8 w-1.5 shrink-0 rounded-full ${color.solid}`} />
      <span aria-hidden="true" className="text-2xl text-muted">
        ›
      </span>
    </Link>
  );
}

/** Fila de un evento del pueblo (estrella verde, como en el calendario). */
function EventRow({ event }: { event: VillageEvent }) {
  return (
    <Link
      to={`/eventos/${event.id}`}
      aria-label={`${event.title}. ${periodLabel(event)}${event.place ? `, en ${event.place}` : ""}`}
      className="flex min-h-18 items-center gap-3 py-3"
    >
      <span
        aria-hidden="true"
        className="grid size-10 shrink-0 place-items-center rounded-full bg-emerald-700 text-lg text-white"
      >
        ★
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">{event.title}</span>
        <span className="block truncate text-base text-muted first-letter:uppercase">
          {periodLabel(event)}
          {event.place && ` · ${event.place}`}
        </span>
      </span>
      <span aria-hidden="true" className="text-2xl text-muted">
        ›
      </span>
    </Link>
  );
}

/** Tarjeta de una reserva: foto, nombre, fechas en una etiqueta y personas. */
export function StayCard({ stay, members }: { stay: Stay; members: readonly Member[] }) {
  const member = members.find((m) => m.id === stay.memberId);
  const color = memberColor(members, stay.memberId);
  const name = member?.displayName ?? "Alguien";
  const sameDay = stay.start === stay.end;
  return (
    <Link
      to={`/calendario/${stay.id}`}
      className={`flex min-h-20 items-center gap-4 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.99] ${cardShadow}`}
    >
      {member ? (
        <Avatar member={member} members={members} />
      ) : (
        <span aria-hidden="true" className={`size-14 rounded-full ${color.solid}`} />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">{name}</span>
        <span className="mt-1 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-0.5 text-base font-bold ${color.soft}`}>
            {sameDay ? shortDate(stay.start) : `${shortDate(stay.start)} – ${shortDate(stay.end)}`}
          </span>
          <span className="text-base text-muted">
            {nightsLabel(stay)} · {stay.people} {stay.people === 1 ? "persona" : "personas"}
          </span>
        </span>
        {stay.note && (
          <span className="mt-1 block truncate text-base text-muted">«{stay.note}»</span>
        )}
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
