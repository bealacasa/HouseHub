import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import { Avatar } from "@/components/Avatar";
import {
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import { NOTES_WARNING, errorMessage } from "@/features/house/house";
import {
  nightsLabel,
  overlapping,
  periodLabel,
  stayInputSchema,
  toKey,
  useDeleteStay,
  useSaveStay,
  useStays,
  type Stay,
} from "./stays";

/** Reservar unos días (/calendario/nueva?dia=…) o cambiar una reserva (/calendario/:id). */
export function StayFormPage() {
  const { id } = useParams();
  const stays = useStays();
  if (stays.isPending) return null;
  const all = stays.data ?? [];
  const stay = id ? all.find((s) => s.id === id) : undefined;
  if (id && !stay) {
    return (
      <>
        <PageTitle title="Reserva no encontrada" />
        <Link to="/calendario" className={buttonPrimary}>
          Volver al calendario
        </Link>
      </>
    );
  }
  return <StayForm key={id ?? "nueva"} stay={stay} all={all} />;
}

function StayForm({ stay, all }: { stay?: Stay; all: Stay[] }) {
  const { house, members, me, isAdmin, session } = useHouseAndSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [dialog, confirm] = useConfirm();
  const firstDay = params.get("dia") ?? toKey(new Date());
  const [memberId, setMemberId] = useState(stay?.memberId ?? me.id);
  const [start, setStart] = useState(stay?.start ?? firstDay);
  const [end, setEnd] = useState(stay?.end ?? firstDay);
  const [people, setPeople] = useState(stay?.people ?? 1);
  const [note, setNote] = useState(stay?.note ?? "");
  const [error, setError] = useState<string | null>(null);
  const save = useSaveStay(house.id);
  const remove = useDeleteStay();
  const canEdit = !stay || isAdmin || stay.createdBy === session;
  const nameOf = (mid: string) => members.find((m) => m.id === mid)?.displayName ?? "Alguien";

  const clashes = start && end && end >= start ? overlapping(all, { start, end }, stay?.id) : [];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { memberId, start, end, people, note };
    const parsed = stayInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    if (clashes.length > 0) {
      const ok = await confirm({
        title: "Esos días ya hay alguien",
        message: `${clashes.map((c) => `${nameOf(c.memberId)}: ${periodLabel(c).toLowerCase()}`).join(". ")}. ¿Reservar igualmente?`,
        confirmLabel: "Sí, reservar igualmente",
      });
      if (!ok) return;
    }
    setError(null);
    save.mutate(
      { id: stay?.id, input },
      { onSuccess: () => navigate(`/calendario?dia=${start}`, { replace: true }) },
    );
  }

  async function onDelete() {
    if (!stay) return;
    const ok = await confirm({
      title: "¿Borrar esta reserva?",
      message: `${nameOf(stay.memberId)}: ${periodLabel(stay).toLowerCase()}.`,
      confirmLabel: "Sí, borrar",
    });
    if (ok) remove.mutate(stay.id, { onSuccess: () => navigate("/calendario", { replace: true }) });
  }

  return (
    <>
      <Link to="/calendario" className={backLink}>
        ← Calendario
      </Link>
      <PageTitle title={stay ? "La reserva" : "Reservar unos días"} />
      <form noValidate onSubmit={(e) => void onSubmit(e)} className="space-y-5">
        <fieldset disabled={!canEdit} className="space-y-5">
          {/* Elegir tocando la foto: más fácil que un desplegable. */}
          <fieldset>
            <legend className="mb-3 text-xl font-semibold">¿Quién va?</legend>
            <div className="grid grid-cols-3 gap-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-transparent bg-surface p-2 text-center shadow-sm has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:ring-3 has-focus-visible:ring-focus"
                >
                  <input
                    type="radio"
                    name="stay-who"
                    value={m.id}
                    checked={memberId === m.id}
                    onChange={() => setMemberId(m.id)}
                    className="sr-only"
                  />
                  <Avatar member={m} members={members} />
                  <span className="text-base font-bold leading-tight">
                    {m.id === me.id ? "Yo" : m.displayName}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="stay-start" className="mb-2 block text-xl font-semibold">
                Llega
              </label>
              <input
                id="stay-start"
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
              <label htmlFor="stay-end" className="mb-2 block text-xl font-semibold">
                Se va
              </label>
              <input
                id="stay-end"
                type="date"
                min={start}
                value={end}
                onChange={(e) => setEnd(e.target.value)}
                className={inputClass}
              />
            </div>
          </div>
          {start && end && end >= start && (
            <p
              aria-live="polite"
              className="-mt-2 rounded-2xl bg-accent-soft px-4 py-3 text-lg font-semibold"
            >
              📅 {periodLabel({ start, end })} · {nightsLabel({ start, end })}
            </p>
          )}
          <div>
            <p id="stay-people-label" className="mb-2 text-xl font-semibold">
              ¿Cuántas personas?
            </p>
            <div
              className="flex items-center gap-3"
              role="group"
              aria-labelledby="stay-people-label"
            >
              <button
                type="button"
                onClick={() => setPeople((p) => Math.max(1, p - 1))}
                aria-label="Una persona menos"
                className="grid size-14 place-items-center rounded-2xl border-2 border-border text-3xl font-bold"
              >
                −
              </button>
              <span
                className="min-w-12 text-center text-3xl font-bold tabular-nums"
                aria-live="polite"
              >
                {people}
              </span>
              <button
                type="button"
                onClick={() => setPeople((p) => Math.min(50, p + 1))}
                aria-label="Una persona más"
                className="grid size-14 place-items-center rounded-2xl border-2 border-border text-3xl font-bold"
              >
                +
              </button>
            </div>
          </div>
          <div>
            <label htmlFor="stay-note" className="mb-2 block text-xl font-semibold">
              Nota (opcional)
            </label>
            <p id="stay-note-hint" className="mb-2 text-muted">
              Por ejemplo: «vamos con los niños». {NOTES_WARNING}
            </p>
            <textarea
              id="stay-note"
              rows={3}
              maxLength={500}
              aria-describedby="stay-note-hint"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} py-3`}
            />
          </div>
        </fieldset>

        {clashes.length > 0 && (
          <p
            role="status"
            className="rounded-2xl bg-warning-bg p-4 text-lg font-semibold text-warning-text"
          >
            ⚠️ Esos días ya va:{" "}
            {clashes
              .map((c) => `${nameOf(c.memberId)} (${periodLabel(c).toLowerCase()})`)
              .join(", ")}
            . Puedes reservar igualmente.
          </p>
        )}
        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        {canEdit ? (
          <>
            <button type="submit" disabled={save.isPending} className={buttonPrimary}>
              {save.isPending ? "Guardando…" : stay ? "Guardar cambios" : "Reservar"}
            </button>
            {stay && (
              <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
                Borrar la reserva
              </button>
            )}
          </>
        ) : (
          <p className="text-lg text-muted">
            Solo quien hizo la reserva (o quien administra) puede cambiarla.
          </p>
        )}
      </form>
      {dialog}
    </>
  );
}

/** La casa y el id del usuario con sesión (para saber si la reserva es suya). */
function useHouseAndSession() {
  const house = useHouse();
  return { ...house, session: house.me.userId };
}
