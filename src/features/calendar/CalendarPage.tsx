import { addMonths, format, isSameMonth, startOfMonth } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Avatar, memberColor } from "@/components/Avatar";
import { Card, ErrorMessage, PageTitle, buttonPrimary, cardShadow } from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import type { Member } from "@/features/house/house";
import {
  longDate,
  monthGrid,
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
  const [params, setParams] = useSearchParams();
  const today = toKey(new Date());
  const selected = params.get("dia") ?? today;
  const [month, setMonth] = useState(() => startOfMonth(new Date(`${selected}T12:00:00`)));
  const select = (day: DateKey) => setParams({ dia: day }, { replace: true });

  const all = stays.data ?? [];
  const upcoming = all.filter((s) => s.end >= today);
  // Orden fijo de las barras: así cada reserva ocupa la misma fila todos sus días.
  const lanes = assignLanes(all);

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
          {monthGrid(month).map((week) => (
            <div role="row" key={week.map(toKey).join()} className="grid grid-cols-7">
              {week.map((date) => (
                <DayCell
                  key={toKey(date)}
                  date={date}
                  inMonth={isSameMonth(date, month)}
                  isToday={toKey(date) === today}
                  isSelected={toKey(date) === selected}
                  stays={staysOn(all, toKey(date))}
                  lanes={lanes}
                  members={members}
                  onSelect={select}
                />
              ))}
            </div>
          ))}
        </div>
        <Legend members={members} stays={all} />
      </Card>

      <section className="mt-6" aria-labelledby="dia-elegido">
        <h2 id="dia-elegido" className="mb-3 text-2xl font-bold first-letter:uppercase">
          {longDate(selected)}
        </h2>
        <StayList
          stays={staysOn(all, selected)}
          members={members}
          empty="La casa está libre ese día."
        />
      </section>

      <section className="mt-8" aria-labelledby="proximas">
        <h2 id="proximas" className="mb-3 text-2xl font-bold">
          Próximas reservas
        </h2>
        <StayList stays={upcoming} members={members} empty="No hay ninguna reserva todavía." />
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
  lanes,
  members,
  onSelect,
}: {
  date: Date;
  inMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  stays: Stay[];
  lanes: Map<string, number>;
  members: readonly Member[];
  onSelect: (day: DateKey) => void;
}) {
  const key = toKey(date);
  const nameOf = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Alguien";
  const who = stays.map((s) => nameOf(s.memberId)).join(", ");
  const byLane: (Stay | undefined)[] = Array.from({ length: MAX_LANES }, () => undefined);
  for (const s of stays) {
    const lane = lanes.get(s.id) ?? 0;
    if (lane < MAX_LANES) byLane[lane] = s;
  }

  return (
    <button
      type="button"
      role="gridcell"
      onClick={() => onSelect(key)}
      aria-selected={isSelected}
      aria-label={`${longDate(key)}${isToday ? ", hoy" : ""}${who ? `: va ${who}` : ": libre"}`}
      className={`flex min-h-[4.25rem] flex-col items-stretch pt-1 ${inMonth ? "" : "opacity-45"}`}
    >
      <span
        className={`mx-auto grid size-10 place-items-center rounded-full text-lg font-semibold tabular-nums ${
          isSelected
            ? "bg-linear-to-br from-accent to-accent-2 font-extrabold text-accent-contrast shadow-md"
            : isToday
              ? "font-extrabold text-accent ring-2 ring-accent"
              : ""
        }`}
      >
        {date.getDate()}
      </span>
      {/* Barras de reserva: continuas de un día a otro, redondeadas al empezar y acabar. */}
      <span className="mt-1 flex flex-col gap-0.5" aria-hidden="true">
        {byLane.map((s, lane) =>
          s ? (
            <span
              key={s.id}
              className={`h-2 ${memberColor(members, s.memberId).solid} ${
                s.start === key ? "ml-1 rounded-l-full" : ""
              } ${s.end === key ? "mr-1 rounded-r-full" : ""}`}
            />
          ) : (
            <span key={lane} className="h-2" />
          ),
        )}
      </span>
    </button>
  );
}

/** Leyenda: color de cada persona que tiene reservas. */
function Legend({ members, stays }: { members: readonly Member[]; stays: readonly Stay[] }) {
  const withStays = members.filter((m) => stays.some((s) => s.memberId === m.id));
  if (withStays.length === 0) return null;
  return (
    <ul className="mt-4 flex flex-wrap gap-2 px-2" aria-label="Colores">
      {withStays.map((m) => (
        <li
          key={m.id}
          className={`flex items-center gap-2 rounded-full px-3 py-1 text-base font-semibold ${memberColor(members, m.id).soft}`}
        >
          <span
            aria-hidden="true"
            className={`size-3 rounded-full ${memberColor(members, m.id).solid}`}
          />
          {m.displayName}
        </li>
      ))}
    </ul>
  );
}

function StayList({
  stays,
  members,
  empty,
}: {
  stays: Stay[];
  members: readonly Member[];
  empty: string;
}) {
  if (stays.length === 0) {
    return (
      <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
        {empty}
      </p>
    );
  }
  return (
    <ul className="space-y-3">
      {stays.map((s) => (
        <li key={s.id}>
          <StayCard stay={s} members={members} />
        </li>
      ))}
    </ul>
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
