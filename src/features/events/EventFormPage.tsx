import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { toKey } from "@/features/calendar/stays";
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

function EventForm({ event }: { event?: VillageEvent }) {
  const { house, me, isAdmin } = useHouse();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [dialog, confirm] = useConfirm();
  const [title, setTitle] = useState(event?.title ?? "");
  const [date, setDate] = useState(event?.date ?? params.get("dia") ?? toKey(new Date()));
  const [time, setTime] = useState(event?.time ?? "");
  const [place, setPlace] = useState(event?.place ?? "");
  const [note, setNote] = useState(event?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveEvent(house.id);
  const remove = useDeleteEvent();
  const canEdit = !event || isAdmin || event.createdBy === me.userId;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { title, date, time, place, note };
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

  const field = (id: string, label: string, input: React.ReactNode) => (
    <div>
      <label htmlFor={id} className="mb-2 block text-xl font-semibold">
        {label}
      </label>
      {input}
    </div>
  );

  return (
    <>
      <Link to="/eventos" className={backLink}>
        ← Eventos
      </Link>
      <PageTitle title={event ? "El evento" : "Nuevo evento"} />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <fieldset disabled={!canEdit} className="space-y-5">
          {field(
            "ev-title",
            "¿Qué es?",
            <input
              id="ev-title"
              maxLength={100}
              placeholder="Por ejemplo: Fiestas de San Roque"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className={inputClass}
            />,
          )}
          <div className="grid grid-cols-2 gap-3">
            {field(
              "ev-date",
              "Día",
              <input
                id="ev-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputClass}
              />,
            )}
            {field(
              "ev-time",
              "Hora (opcional)",
              <input
                id="ev-time"
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className={inputClass}
              />,
            )}
          </div>
          {field(
            "ev-place",
            "Dónde (opcional)",
            <input
              id="ev-place"
              maxLength={100}
              placeholder="Por ejemplo: la plaza"
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className={inputClass}
            />,
          )}
          {field(
            "ev-note",
            "Nota (opcional)",
            <textarea
              id="ev-note"
              rows={3}
              maxLength={500}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} py-3`}
            />,
          )}
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
