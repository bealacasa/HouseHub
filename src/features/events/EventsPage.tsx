import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link } from "react-router";
import { ErrorMessage, PageTitle, backLink, buttonPrimary, cardShadow } from "@/components/ui";
import { periodLabel, toKey } from "@/features/calendar/stays";
import { useEvents, type VillageEvent } from "./events";

/** Eventos del pueblo: los próximos por fecha (y los pasados, si se quiere ver). */
export function EventsPage() {
  const events = useEvents();
  const [showPast, setShowPast] = useState(false);
  const today = toKey(new Date());
  const all = events.data ?? [];
  const upcoming = all.filter((e) => e.end >= today);
  const past = all.filter((e) => e.end < today).reverse();

  return (
    <>
      <Link to="/mas" className={backLink}>
        ← Más
      </Link>
      <PageTitle title="Eventos del pueblo" subtitle="Fiestas, mercado, procesiones…" />
      <Link to="/eventos/nuevo" className={`${buttonPrimary} mb-6`}>
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Añadir un evento
      </Link>
      {events.isError && <ErrorMessage>No se han podido cargar los eventos.</ErrorMessage>}
      {events.isSuccess && upcoming.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          No hay eventos próximos.
        </p>
      )}
      <ul className="space-y-3">
        {upcoming.map((e) => (
          <li key={e.id}>
            <EventCard event={e} />
          </li>
        ))}
      </ul>
      {past.length > 0 && (
        <div className="mt-8">
          <button
            type="button"
            onClick={() => setShowPast((v) => !v)}
            aria-expanded={showPast}
            className="min-h-12 text-lg font-semibold text-accent underline"
          >
            {showPast ? "Ocultar los pasados" : `Ver los pasados (${past.length})`}
          </button>
          {showPast && (
            <ul className="mt-3 space-y-3 opacity-80">
              {past.map((e) => (
                <li key={e.id}>
                  <EventCard event={e} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  );
}

/** Tarjeta de evento: con «hoja de calendario» (día y mes) para distinguirla de las reservas. */
export function EventCard({ event }: { event: VillageEvent }) {
  const start = parseISO(event.start);
  const multi = event.start !== event.end;
  return (
    <Link
      to={`/eventos/${event.id}`}
      aria-label={`${event.title}. ${periodLabel(event)}${event.place ? `, en ${event.place}` : ""}`}
      className={`flex min-h-20 items-center gap-4 rounded-3xl border border-rose-300/70 bg-surface p-4 active:scale-[0.99] dark:border-rose-900 ${cardShadow}`}
    >
      <span
        aria-hidden="true"
        className="flex w-16 shrink-0 flex-col items-center overflow-hidden rounded-2xl bg-rose-50 text-center dark:bg-rose-950/60"
      >
        <span className="w-full bg-rose-700 py-0.5 text-sm font-bold uppercase text-white">
          {format(start, "MMM", { locale: es })}
        </span>
        <span className="py-1 text-3xl font-extrabold leading-none text-rose-950 dark:text-rose-100">
          {format(start, "d")}
        </span>
      </span>
      <span className="min-w-0 flex-1" aria-hidden="true">
        <span className="block text-xl font-bold">{event.title}</span>
        <span className="block text-lg text-muted first-letter:uppercase">
          {multi ? periodLabel(event) : format(start, "EEEE", { locale: es })}
          {event.place && ` · ${event.place}`}
        </span>
        {event.note && <span className="block truncate text-base text-muted">{event.note}</span>}
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
