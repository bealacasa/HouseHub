import { addMonths, parseISO } from "date-fns";
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
} from "@/components/ui";
import { DateField, FormSection, PrivacyHint, fieldLabel, shortDay } from "@/components/form";
import { toKey } from "@/features/calendar/stays";
import { MemberPicker } from "@/features/house/MemberPicker";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  CATEGORIES,
  REPEAT_OPTIONS,
  expenseInputSchema,
  useDeleteExpense,
  useLedger,
  useSaveExpense,
  type Category,
  type Expense,
} from "./expenses";
import { formatEuros, parseEuros, seedFrom, splitEqually } from "./money";

/** Apuntar (/gastos/nuevo) o cambiar (/gastos/:id) un gasto. */
export function ExpenseFormPage() {
  const { id } = useParams();
  const ledger = useLedger();
  if (ledger.isPending) return null;
  const expense = id ? ledger.data?.expenses.find((e) => e.id === id) : undefined;
  if (id && !expense) {
    return (
      <>
        <PageTitle title="Gasto no encontrado" />
        <Link to="/gastos" className={buttonPrimary}>
          Volver a los gastos
        </Link>
      </>
    );
  }
  const repeat = expense?.recurringId
    ? (ledger.data?.recurring.find((r) => r.id === expense.recurringId)?.everyMonths ?? 0)
    : 0;
  return <ExpenseForm key={id ?? "nuevo"} expense={expense} initialRepeat={repeat} />;
}

/** Céntimos → texto para el campo ("12,50"). */
const centsToInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function ExpenseForm({ expense, initialRepeat }: { expense?: Expense; initialRepeat: number }) {
  const { members, me } = useHouse();
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const [amountText, setAmountText] = useState(expense ? centsToInput(expense.amount) : "");
  const [concept, setConcept] = useState(expense?.concept ?? "");
  const [category, setCategory] = useState<Category>(expense?.category ?? "compra");
  const [date, setDate] = useState(expense?.date ?? toKey(new Date()));
  const [paidBy, setPaidBy] = useState(expense?.paidBy ?? me.id);
  const [split, setSplit] = useState<"equal" | "custom">(expense?.split ?? "equal");
  // A partes iguales: quiénes participan (por defecto, todos).
  const [between, setBetween] = useState<string[]>(
    expense ? [...expense.shares.keys()] : members.map((m) => m.id),
  );
  // Personalizado: lo que escribe cada uno.
  const [custom, setCustom] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      members.map((m) => [
        m.id,
        expense?.shares.get(m.id) ? centsToInput(expense.shares.get(m.id) ?? 0) : "",
      ]),
    ),
  );
  const [note, setNote] = useState(expense?.note ?? "");
  const [repeat, setRepeat] = useState(initialRepeat);
  const [error, setError] = useState<string | null>(null);
  const save = useSaveExpense();
  const remove = useDeleteExpense();

  const amount = parseEuros(amountText);
  const ordered = members.map((m) => m.id).filter((id) => between.includes(id));
  const equalShares = amount
    ? splitEqually(amount, ordered, seedFrom(date))
    : new Map<string, number>();
  const customCents = Object.fromEntries(
    members.map((m) => [m.id, custom[m.id]?.trim() ? parseEuros(custom[m.id] ?? "") : 0]),
  );
  const customSum = Object.values(customCents).reduce<number>((s, c) => s + (c ?? 0), 0);
  const left = (amount ?? 0) - customSum;

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!amount) {
      setError("Escribe el importe, por ejemplo 12,50.");
      return;
    }
    let shares: { member: string; cents: number }[];
    if (split === "equal") {
      shares = [...equalShares].map(([member, cents]) => ({ member, cents }));
    } else {
      if (Object.values(customCents).some((c) => c === null)) {
        setError("Alguna cantidad del reparto no es válida.");
        return;
      }
      shares = Object.entries(customCents)
        .filter(([, c]) => (c ?? 0) > 0)
        .map(([member, c]) => ({ member, cents: c ?? 0 }));
    }
    const input = { concept, category, amount, date, paidBy, split, note, shares };
    const parsed = expenseInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      {
        id: expense?.id,
        input,
        // Solo se toca la repetición si se repite o si ya se repetía (para quitarla).
        repeat: repeat > 0 || expense?.recurringId ? repeat : undefined,
      },
      { onSuccess: () => navigate("/gastos", { replace: true }) },
    );
  }

  async function onDelete() {
    if (!expense) return;
    const ok = await confirm({
      title: "¿Borrar este gasto?",
      message: `${expense.concept}: ${formatEuros(expense.amount)}.`,
      confirmLabel: "Sí, borrar",
    });
    if (ok) remove.mutate(expense.id, { onSuccess: () => navigate("/gastos", { replace: true }) });
  }

  return (
    <>
      <Link to="/gastos" className={backLink}>
        ← Gastos
      </Link>
      <PageTitle title={expense ? "El gasto" : "Apuntar un gasto"} />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <fieldset className="space-y-4">
          {/* El importe, grande y en el centro: es lo más importante. */}
          <section className="rounded-[2rem] bg-linear-to-br from-accent to-accent-2 p-5 text-center text-accent-contrast shadow-xl shadow-accent/20">
            <label htmlFor="ex-amount" className="block text-lg font-semibold opacity-90">
              ¿Cuánto ha costado?
            </label>
            <div className="mt-2 flex items-center justify-center gap-2">
              <input
                id="ex-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className="w-full min-w-0 rounded-2xl border-2 border-white/40 bg-white/15 px-3 py-2 text-center text-5xl font-extrabold tabular-nums placeholder:text-current placeholder:opacity-50 focus:border-white"
              />
              <span aria-hidden="true" className="text-4xl font-extrabold">
                €
              </span>
            </div>
          </section>

          <FormSection>
            <div>
              <label htmlFor="ex-concept" className={fieldLabel}>
                ¿Qué es?
              </label>
              <input
                id="ex-concept"
                maxLength={100}
                placeholder="Por ejemplo: bombona de butano"
                value={concept}
                onChange={(e) => setConcept(e.target.value)}
                className={inputClass}
              />
            </div>
            <fieldset>
              <legend className={fieldLabel}>Tipo</legend>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(CATEGORIES) as Category[]).map((c) => (
                  <label
                    key={c}
                    className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full border-2 border-border bg-surface px-4 text-lg font-semibold has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-3 has-focus-visible:ring-focus"
                  >
                    <input
                      type="radio"
                      name="ex-category"
                      checked={category === c}
                      onChange={() => setCategory(c)}
                      className="sr-only"
                    />
                    <span aria-hidden="true">{CATEGORIES[c].emoji}</span>
                    {CATEGORIES[c].label}
                  </label>
                ))}
              </div>
            </fieldset>
            <DateField id="ex-date" label="Fecha" value={date} onChange={setDate} />
          </FormSection>

          <FormSection
            title="¿Se repite?"
            hint="Para recibos fijos, como internet o la comunidad."
            as="fieldset"
          >
            <div className="grid grid-cols-2 gap-2">
              {REPEAT_OPTIONS.map((o) => (
                <label
                  key={o.months}
                  className="flex min-h-14 cursor-pointer items-center justify-center rounded-2xl border-2 border-border bg-surface px-2 text-center text-lg font-semibold has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-3 has-focus-visible:ring-focus"
                >
                  <input
                    type="radio"
                    name="ex-repeat"
                    checked={repeat === o.months}
                    onChange={() => setRepeat(o.months)}
                    className="sr-only"
                  />
                  {o.label}
                </label>
              ))}
            </div>
            {repeat > 0 && /^\d{4}-\d{2}-\d{2}$/.test(date) && (
              <p aria-live="polite" className="rounded-2xl bg-accent-soft px-4 py-3 text-lg">
                Se apuntará solo, con el mismo importe y reparto. El próximo:{" "}
                <strong className="first-letter:uppercase">
                  {shortDay(toKey(addMonths(parseISO(date), repeat)))}
                </strong>
                .
              </p>
            )}
          </FormSection>

          <FormSection title="¿Quién lo pagó?" as="fieldset">
            <MemberPicker name="ex-paid" value={paidBy} onChange={setPaidBy} />
          </FormSection>

          <FormSection title="¿Cómo se reparte?" as="fieldset">
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
              {(["equal", "custom"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl px-2 text-center text-lg font-bold leading-tight text-muted has-checked:bg-surface has-checked:text-text has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-focus"
                >
                  <input
                    type="radio"
                    name="ex-split"
                    checked={split === mode}
                    onChange={() => setSplit(mode)}
                    className="sr-only"
                  />
                  {mode === "equal" ? "A partes iguales" : "Cada uno una cantidad"}
                </label>
              ))}
            </div>

            {split === "equal" ? (
              <ul className="divide-y divide-border" aria-label="Entre quiénes">
                {members.map((m) => {
                  const on = between.includes(m.id);
                  return (
                    <li key={m.id}>
                      <label className="flex min-h-16 cursor-pointer items-center gap-3">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setBetween((list) =>
                              e.target.checked ? [...list, m.id] : list.filter((x) => x !== m.id),
                            )
                          }
                          className="size-7 shrink-0 accent-[var(--accent)]"
                        />
                        <Avatar member={m} members={members} size="sm" />
                        <span
                          className={`flex-1 text-lg font-semibold ${on ? "" : "text-muted line-through"}`}
                        >
                          {m.displayName}
                        </span>
                        <span className="text-lg font-bold tabular-nums">
                          {on && amount ? formatEuros(equalShares.get(m.id) ?? 0) : "—"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <>
                <ul className="space-y-3">
                  {members.map((m) => (
                    <li key={m.id} className="flex items-center gap-3">
                      <Avatar member={m} members={members} size="sm" />
                      <label htmlFor={`ex-share-${m.id}`} className="flex-1 text-lg font-semibold">
                        {m.displayName}
                      </label>
                      <input
                        id={`ex-share-${m.id}`}
                        inputMode="decimal"
                        placeholder="0,00"
                        value={custom[m.id] ?? ""}
                        onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                        className={`${inputClass} w-32 text-right font-bold tabular-nums`}
                      />
                    </li>
                  ))}
                </ul>
                {amount !== null && (
                  <p
                    aria-live="polite"
                    className={`rounded-2xl px-4 py-3 text-lg font-semibold ${
                      left === 0 ? "bg-accent-soft" : "bg-warning-bg text-warning-text"
                    }`}
                  >
                    {left === 0
                      ? "✓ El reparto suma el total."
                      : left > 0
                        ? `Faltan ${formatEuros(left)} por repartir.`
                        : `Te pasas en ${formatEuros(-left)}.`}
                  </p>
                )}
              </>
            )}
          </FormSection>

          <FormSection>
            <div>
              <label htmlFor="ex-note" className={fieldLabel}>
                Nota <span className="font-normal text-muted">(opcional)</span>
              </label>
              <textarea
                id="ex-note"
                rows={2}
                maxLength={300}
                aria-describedby="ex-note-hint"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className={`${inputClass} py-3`}
              />
              <PrivacyHint id="ex-note-hint" />
            </div>
          </FormSection>
        </fieldset>
        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        <>
          <button type="submit" disabled={save.isPending} className={buttonPrimary}>
            {save.isPending ? "Guardando…" : expense ? "Guardar cambios" : "Apuntar gasto"}
          </button>
          {expense && (
            <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
              Borrar el gasto
            </button>
          )}
        </>
      </form>
      {dialog}
    </>
  );
}
