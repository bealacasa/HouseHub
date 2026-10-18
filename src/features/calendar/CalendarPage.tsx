import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Card, ErrorMessage, PageTitle, buttonPrimary } from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import type { Member } from "@/features/house/house";
import {
  longDate,
  monthGrid,
  nightsLabel,
  periodLabel,
  staysOn,
  toKey,
  useStays,
  type DateKey,
  type Stay,
} from "./stays";

/** Colores fijos por persona (clases, no estilos en línea: lo exige la CSP). Alto contraste. */
const COLORS = [
  "bg-sky-800 text-white",
  "bg-emerald-800 text-white",
  "bg-rose-800 text-white",
  "bg-violet-800 text-white",
  "bg-amber-700 text-white",
  "bg-teal-800 text-white",
  "bg-orange-800 text-white",
  "bg-slate-700 text-white",
] as const;

export function memberColor(members: readonly Member[], id: string): string {
  const index = members.findIndex((m) => m.id === id);
  return COLORS[(index < 0 ? 0 : index) % COLORS.length] ?? COLORS[0];
}

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"] as const;
const WEEKDAY_NAMES = ["lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo"];

/** Calendario de reservas: quién va a la casa y cuándo. */
export function CalendarPage() {
  const { members } = useHouse();
  const stays = useStays();
  const [params, setParams] = useSearchParams();
  const today = toKey(new Date());
  const selected = params.get("dia") ?? today;
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${selected}T12:00:00`)));
  const select = (day: DateKey) => setParams({ dia: day }, { replace: true });

  const all = stays.data ?? [];
  const upcoming = all.filter((s) => s.end >= today);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Alguien";

  return (
    <>
      <PageTitle title="Calendario" subtitle="Quién va a la casa y cuándo." />
      <Link
        to={`/calendario/nueva?dia=${selected < today ? today : selected}`}
        className={`${buttonPrimary} mb-5`}
      >
        + Reservar unos días
      </Link>
      {stays.isError && <ErrorMessage>No se han podido cargar las reservas.</ErrorMessage>}

      <Card className="p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            aria-label="Mes anterior"
            className="grid size-14 place-items-center rounded-2xl border-2 border-border text-2xl font-bold"
          >
            ‹
          </button>
          <h2 className="text-2xl font-bold capitalize" aria-live="polite">
            {format(month, "MMMM yyyy", { locale: es })}
          </h2>
          <button
            type="button"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            aria-label="Mes siguiente"
            className="grid size-14 place-items-center rounded-2xl border-2 border-border text-2xl font-bold"
          >
            ›
          </button>
        </div>
        <div role="grid" aria-label="Días del mes">
          <div role="row" className="grid grid-cols-7 text-center text-base font-bold text-muted">
            {WEEKDAYS.map((d, i) => (
              <span key={d} role="columnheader" aria-label={WEEKDAY_NAMES[i]}>
                {d}
              </span>
            ))}
          </div>
          {monthGrid(month).map((week) => (
            <div role="row" key={week.map(toKey).join()} className="mt-1 grid grid-cols-7 gap-1">
              {week.map((date) => (
                <DayCell
                  key={toKey(date)}
                  date={date}
                  inMonth={isSameMonth(date, month)}
                  isToday={toKey(date) === today}
                  isSelected={toKey(date) === selected}
                  stays={staysOn(all, toKey(date))}
                  members={members}
                  nameOf={nameOf}
                  onSelect={select}
                />
              ))}
            </div>
          ))}
        </div>
      </Card>

      <DayDetail day={selected} stays={staysOn(all, selected)} nameOf={nameOf} members={members} />

      <section className="mt-6" aria-labelledby="proximas">
        <h2 id="proximas" className="mb-3 text-2xl font-bold">
          Próximas reservas
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-lg text-muted">No hay ninguna reserva todavía.</p>
        ) : (
          <ul className="space-y-3">
            {upcoming.map((s) => (
              <li key={s.id}>
                <StayItem
                  stay={s}
                  name={nameOf(s.memberId)}
                  color={memberColor(members, s.memberId)}
                />
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function DayCell({
  date,
  inMonth,
  isToday,
  isSelected,
  stays,
  members,
  nameOf,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  stays: Stay[];
  members: readonly Member[];
  nameOf: (id: string) => string;
  onSelect: (day: DateKey) => void;
}) {
  const key = toKey(date);
  const who = stays.map((s) => nameOf(s.memberId)).join(", ");
  return (
    <button
      type="button"
      role="gridcell"
      onClick={() => onSelect(key)}
      aria-selected={isSelected}
      aria-label={`${longDate(key)}${isToday ? ", hoy" : ""}${who ? `: va ${who}` : ": libre"}`}
      className={`flex min-h-14 flex-col items-center justify-start rounded-xl pt-1 text-lg font-semibold tabular-nums ${
        isSelected ? "ring-3 ring-accent" : ""
      } ${isToday ? "bg-accent-soft" : ""} ${inMonth ? "" : "text-muted opacity-60"}`}
    >
      {date.getDate()}
      <span className="mt-0.5 flex flex-wrap justify-center gap-0.5" aria-hidden="true">
        {stays.slice(0, 3).map((s) => (
          <span
            key={s.id}
            className={`size-2.5 rounded-full ${memberColor(members, s.memberId)}`}
          />
        ))}
      </span>
    </button>
  );
}

function DayDetail({
  day,
  stays,
  nameOf,
  members,
}: {
  day: DateKey;
  stays: Stay[];
  nameOf: (id: string) => string;
  members: readonly Member[];
}) {
  return (
    <Card className="mt-4">
      <h2 className="text-xl font-bold first-letter:uppercase">{longDate(day)}</h2>
      {stays.length === 0 ? (
        <p className="mt-2 text-lg text-muted">La casa está libre ese día.</p>
      ) : (
        <ul className="mt-3 space-y-3">
          {stays.map((s) => (
            <li key={s.id}>
              <StayItem
                stay={s}
                name={nameOf(s.memberId)}
                color={memberColor(members, s.memberId)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function StayItem({ stay, name, color }: { stay: Stay; name: string; color: string }) {
  return (
    <Link
      to={`/calendario/${stay.id}`}
      className="flex min-h-16 items-center gap-3 rounded-2xl border-2 border-border bg-surface p-3"
    >
      <span
        aria-hidden="true"
        className={`grid size-12 shrink-0 place-items-center rounded-full text-xl font-bold ${color}`}
      >
        {name.charAt(0).toUpperCase()}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-lg font-bold">{name}</span>
        <span className="block text-lg">
          {periodLabel(stay)} · {nightsLabel(stay)}
        </span>
        <span className="block text-muted">
          {stay.people} {stay.people === 1 ? "persona" : "personas"}
          {stay.note && ` · ${stay.note}`}
        </span>
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
