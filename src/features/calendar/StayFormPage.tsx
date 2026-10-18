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
import { DateField, FormSection, PrivacyHint, Stepper, fieldLabel } from "@/components/form";
import { MemberPicker } from "@/features/house/MemberPicker";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
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
        <fieldset disabled={!canEdit} className="space-y-4">
          {/* Elegir tocando la foto: más fácil que un desplegable. */}
          <FormSection title="¿Quién va?" as="fieldset">
            <MemberPicker name="stay-who" value={memberId} onChange={setMemberId} />
          </FormSection>

          <FormSection title="¿Qué días?">
            <div className="grid gap-3">
              <DateField
                id="stay-start"
                label="Llega"
                value={start}
                onChange={(v) => {
                  setStart(v);
                  if (end < v) setEnd(v);
                }}
              />
              <DateField id="stay-end" label="Se va" value={end} min={start} onChange={setEnd} />
            </div>
            {start && end && end >= start && (
              <p
                aria-live="polite"
                className="rounded-2xl bg-accent-soft px-4 py-3 text-lg font-semibold"
              >
                {periodLabel({ start, end })} · {nightsLabel({ start, end })}
              </p>
            )}
            {clashes.length > 0 && (
              <p
                role="status"
                className="rounded-2xl bg-warning-bg px-4 py-3 text-lg font-semibold text-warning-text"
              >
                ⚠️ Esos días ya va {clashes.map((c) => nameOf(c.memberId)).join(", ")}. Puedes
                reservar igualmente.
              </p>
            )}
          </FormSection>

          <FormSection>
            <Stepper
              label="¿Cuántas personas?"
              value={people}
              onChange={setPeople}
              min={1}
              max={50}
              unit={(n) => (n === 1 ? "persona" : "personas")}
            />
            <div>
              <label htmlFor="stay-note" className={fieldLabel}>
                Nota <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                id="stay-note"
                rows={2}
                maxLength={500}
                placeholder="Por ejemplo: vamos con los niños"
                aria-describedby="stay-note-hint"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${inputClass} py-3`}
              />
              <PrivacyHint id="stay-note-hint" />
            </div>
          </FormSection>
        </fieldset>

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
