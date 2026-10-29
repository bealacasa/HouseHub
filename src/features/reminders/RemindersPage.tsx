import { addDays } from "date-fns";
import { useState } from "react";
import { Link } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import { DateField, fieldLabel } from "@/components/form";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  RemindersNotReadyError,
  dueLabel,
  reminderInputSchema,
  useAddReminder,
  useDeleteReminders,
  useReminders,
  useToggleReminder,
  type Reminder,
} from "./reminders";

type When = "none" | "today" | "tomorrow" | "other";

const WHEN_OPTIONS: { value: When; label: string }[] = [
  { value: "none", label: "Sin fecha" },
  { value: "today", label: "Hoy" },
  { value: "tomorrow", label: "Mañana" },
  { value: "other", label: "Otro día" },
];

const chip =
  "flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-border bg-surface px-2 text-center text-lg font-semibold has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-3 has-focus-visible:ring-focus";

/** Mis recordatorios: privados, solo los ve quien los escribe. */
export function RemindersPage() {
  const { house } = useHouse();
  const reminders = useReminders();
  const add = useAddReminder(house.id);
  const remove = useDeleteReminders();
  const [dialog, confirm] = useConfirm();
  const today = toKey(new Date());
  const [text, setText] = useState("");
  const [when, setWhen] = useState<When>("none");
  const [otherDay, setOtherDay] = useState(toKey(addDays(new Date(), 2)));
  const [error, setError] = useState<string | null>(null);
  const all = reminders.data ?? [];
  const pending = all.filter((r) => !r.done);
  const done = all.filter((r) => r.done);

  if (reminders.error instanceof RemindersNotReadyError) {
    return (
      <>
        <Link to="/casa" className={backLink}>
          ← Casa
        </Link>
        <PageTitle title="Mis recordatorios" />
        <Card>
          <h2 className="text-2xl font-bold">Muy pronto</h2>
          <p className="mt-2 text-lg">
            Los recordatorios aún no están activados. Quien administra la casa tiene que terminar de
            prepararlos.
          </p>
          <Link to="/casa" className={`${buttonSecondary} mt-4`}>
            Volver a Casa
          </Link>
        </Card>
      </>
    );
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const due =
      when === "today"
        ? today
        : when === "tomorrow"
          ? toKey(addDays(new Date(), 1))
          : when === "other"
            ? otherDay
            : null;
    const parsed = reminderInputSchema.safeParse({ text, due });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    add.mutate(
      { text, due },
      {
        onSuccess: () => {
          setText("");
          setWhen("none");
        },
      },
    );
  }

  async function clearDone() {
    const ok = await confirm({
      title: "¿Borrar los recordatorios hechos?",
      message: `Se borrarán ${done.length} ${done.length === 1 ? "recordatorio" : "recordatorios"}.`,
      confirmLabel: "Sí, borrarlos",
    });
    if (ok) remove.mutate(done.map((r) => r.id));
  }

  return (
    <>
      <Link to="/casa" className={backLink}>
        ← Casa
      </Link>
      <PageTitle title="Mis recordatorios" />
      <p className="-mt-3 mb-5 flex items-center gap-2 text-lg font-semibold text-muted">
        <span aria-hidden="true">🔒</span>Solo los ves tú.
      </p>

      <Card className="mb-5">
        <form noValidate className="space-y-4" onSubmit={onSubmit}>
          <div>
            <label htmlFor="new-reminder" className="block text-xl font-semibold">
              Nuevo recordatorio
            </label>
            <input
              id="new-reminder"
              maxLength={200}
              placeholder="Por ejemplo: pedir cita"
              value={text}
              onChange={(e) => setText(e.target.value)}
              className={`${inputClass} mt-2`}
            />
          </div>
          <fieldset>
            <legend className={fieldLabel}>¿Para cuándo?</legend>
            <div className="grid grid-cols-2 gap-2">
              {WHEN_OPTIONS.map((o) => (
                <label key={o.value} className={chip}>
                  <input
                    type="radio"
                    name="reminder-when"
                    checked={when === o.value}
                    onChange={() => setWhen(o.value)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
          </fieldset>
          {when === "other" && (
            <DateField
              id="reminder-day"
              label="Día"
              value={otherDay}
              min={today}
              onChange={setOtherDay}
            />
          )}
          {(error || add.error) && <ErrorMessage>{error ?? errorMessage(add.error)}</ErrorMessage>}
          <button type="submit" disabled={add.isPending} className={buttonPrimary}>
            Añadir recordatorio
          </button>
        </form>
      </Card>

      {reminders.isError && <ErrorMessage>No se han podido cargar tus recordatorios.</ErrorMessage>}
      {reminders.isSuccess && all.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          No tienes recordatorios.
        </p>
      )}
      {pending.length > 0 && <ReminderList reminders={pending} title="Pendientes" today={today} />}
      {done.length > 0 && (
        <section className="mt-6">
          <ReminderList reminders={done} title="Hechos" today={today} />
          <button
            type="button"
            onClick={() => void clearDone()}
            className="mt-3 min-h-12 w-full text-lg font-semibold text-danger underline"
          >
            Borrar los hechos
          </button>
        </section>
      )}
      {remove.isError && <ErrorMessage>{errorMessage(remove.error)}</ErrorMessage>}
      {dialog}
    </>
  );
}

function ReminderList({
  reminders,
  title,
  today,
}: {
  reminders: Reminder[];
  title: string;
  today: string;
}) {
  return (
    <section aria-label={title}>
      <h2 className="mb-3 text-xl font-bold">
        {title} <span className="text-muted">({reminders.length})</span>
      </h2>
      <ul className="space-y-2">
        {reminders.map((r) => (
          <li key={r.id}>
            <ReminderRow reminder={r} today={today} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ReminderRow({ reminder, today }: { reminder: Reminder; today: string }) {
  const toggle = useToggleReminder();
  const label = dueLabel(reminder.due, today);
  const late = !reminder.done && reminder.due !== null && reminder.due < today;
  const isToday = !reminder.done && reminder.due === today;
  return (
    <label
      className={`flex min-h-16 cursor-pointer items-center gap-4 rounded-2xl border bg-surface p-4 shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-focus ${
        late ? "border-danger" : isToday ? "border-accent" : "border-border"
      } ${reminder.done ? "opacity-70" : ""}`}
    >
      <input
        type="checkbox"
        checked={reminder.done}
        disabled={toggle.isPending}
        onChange={(e) => toggle.mutate({ id: reminder.id, done: e.target.checked })}
        className="size-8 shrink-0 accent-[var(--accent)]"
      />
      <span className="min-w-0 flex-1">
        <span className={`block text-xl ${reminder.done ? "line-through" : "font-semibold"}`}>
          {reminder.text}
        </span>
        {label && (
          <span
            className={`block text-base font-semibold first-letter:uppercase ${
              late ? "text-danger" : isToday ? "text-accent" : "text-muted"
            }`}
          >
            {late && <span aria-hidden="true">⚠️ </span>}
            {label}
          </span>
        )}
      </span>
    </label>
  );
}
