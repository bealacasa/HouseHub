import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { periodLabel, toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  eventInputSchema,
  useDeleteEvent,
  useEvents,
  useSaveEvent,
  type VillageEvent,
} from "./events";

/** Añadir (/eventos/nuevo?dia=…) o cambiar (/eventos/:id) un evento del pueblo. */
export function EventFormPage() {
  const { id } = useParams();
  const events = useEvents();
  if (events.isPending) return null;
  const event = id ? (events.data ?? []).find((e) => e.id === id) : undefined;
  if (id && !event) {
    return (
      <>
        <PageTitle title="Evento no encontrado" />
        <Link to="/eventos" className={buttonPrimary}>
          Volver a los eventos
        </Link>
      </>
    );
  }
  return <EventForm key={id ?? "nuevo"} event={event} />;
}

/** "3 días" / "1 día" (contando el primero y el último). */
function daysLabel(start: string, end: string): string {
  const n = Math.round((Date.parse(end) - Date.parse(start)) / 86_400_000) + 1;
  return n === 1 ? "1 día" : `${n} días`;
}

const label = "mb-2 block text-xl font-semibold";

function EventForm({ event }: { event?: VillageEvent }) {
  const { house, me, isAdmin } = useHouse();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [dialog, confirm] = useConfirm();
  const firstDay = event?.start ?? params.get("dia") ?? toKey(new Date());
  const [title, setTitle] = useState(event?.title ?? "");
  const [start, setStart] = useState(firstDay);
  const [end, setEnd] = useState(event?.end ?? firstDay);
  const [place, setPlace] = useState(event?.place ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveEvent(house.id);
  const remove = useDeleteEvent();
  const canEdit = !event || isAdmin || event.createdBy === me.userId;
  const validRange = start !== "" && end !== "" && end >= start;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { title, start, end, place, note };
    const parsed = eventInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      { id: event?.id, input },
      { onSuccess: () => navigate("/eventos", { replace: true }) },
    );
  }

  async function onDelete() {
    if (!event) return;
    const ok = await confirm({
      title: "¿Borrar este evento?",
      message: event.title,
      confirmLabel: "Sí, borrar",
    });
    if (ok) remove.mutate(event.id, { onSuccess: () => navigate("/eventos", { replace: true }) });
  }

  return (
    <>
      <Link to="/eventos" className={backLink}>
        ← Eventos
      </Link>
      <PageTitle
        title={event ? "El evento" : "Nuevo evento"}
        subtitle="Fiestas, mercado, procesiones…"
      />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <fieldset disabled={!canEdit} className="space-y-5">
          <Card>
            <label htmlFor="ev-title" className={label}>
              ¿Qué es?
            </label>
            <input
              id="ev-title"
              maxLength={100}
              placeholder="Por ejemplo: Fiestas de San Roque"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={`${inputClass} text-xl font-semibold`}
            />
          </Card>

          <Card>
            <p className={label}>¿Cuándo?</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="ev-start" className="mb-1 block text-lg text-muted">
                  Empieza
                </label>
                <input
                  id="ev-start"
                  type="date"
                  value={start}
                  onChange={(e) => {
                    setStart(e.target.value);
                    if (end < e.target.value) setEnd(e.target.value);
                  }}
                  className={inputClass}
                />
              </div>
              <div>
                <label htmlFor="ev-end" className="mb-1 block text-lg text-muted">
                  Termina
                </label>
                <input
                  id="ev-end"
                  type="date"
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                  className={inputClass}
                />
              </div>
            </div>
            {validRange && (
              <p
                aria-live="polite"
                className="mt-4 flex items-center gap-2 rounded-2xl bg-rose-50 px-4 py-3 text-lg font-semibold text-rose-900 dark:bg-rose-950/50 dark:text-rose-100"
              >
                <span aria-hidden="true">⭐</span>
                {periodLabel({ start, end })} · {daysLabel(start, end)}
              </p>
            )}
          </Card>

          <Card>
            <label htmlFor="ev-place" className={label}>
              ¿Dónde? <span className="font-normal text-muted">(opcional)</span>
            </label>
            <input
              id="ev-place"
              maxLength={100}
              placeholder="Por ejemplo: la plaza"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className={inputClass}
            />
            <label htmlFor="ev-note" className={`${label} mt-5`}>
              Nota <span className="font-normal text-muted">(opcional)</span>
            </label>
            <textarea
              id="ev-note"
              rows={3}
              maxLength={500}
              placeholder="Por ejemplo: comida popular el domingo"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} py-3`}
            />
          </Card>
        </fieldset>

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        {canEdit ? (
          <>
            <button type="submit" disabled={save.isPending} className={buttonPrimary}>
              {save.isPending ? "Guardando…" : event ? "Guardar cambios" : "Añadir evento"}
            </button>
            {event && (
              <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
                Borrar el evento
              </button>
            )}
          </>
        ) : (
          <p className="text-lg text-muted">
            Solo quien lo añadió (o quien administra) puede cambiarlo.
          </p>
        )}
      </form>
      {dialog}
    </>
  );
}
