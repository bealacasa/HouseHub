import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { Avatar } from "@/components/Avatar";
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
import { toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  CATEGORIES,
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
  return <ExpenseForm key={id ?? "nuevo"} expense={expense} />;
}

/** Céntimos → texto para el campo ("12,50"). */
const centsToInput = (c: number) => (c / 100).toFixed(2).replace(".", ",");

function ExpenseForm({ expense }: { expense?: Expense }) {
  const { members, me, isAdmin } = useHouse();
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
  const [error, setError] = useState<string | null>(null);
  const save = useSaveExpense();
  const remove = useDeleteExpense();
  const canEdit = !expense || isAdmin || expense.createdBy === me.userId;

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
      { id: expense?.id, input },
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

  const label = "mb-2 block text-xl font-semibold";

  return (
    <>
      <Link to="/gastos" className={backLink}>
        ← Gastos
      </Link>
      <PageTitle title={expense ? "El gasto" : "Apuntar un gasto"} />
      <form noValidate onSubmit={onSubmit} className="space-y-6">
        <fieldset disabled={!canEdit} className="space-y-6">
          <div>
            <label htmlFor="ex-amount" className={label}>
              ¿Cuánto ha costado?
            </label>
            <div className="relative">
              <input
                id="ex-amount"
                inputMode="decimal"
                autoComplete="off"
                placeholder="0,00"
                value={amountText}
                onChange={(e) => setAmountText(e.target.value)}
                className={`${inputClass} min-h-18 pr-12 text-right text-4xl font-extrabold tabular-nums`}
              />
              <span
                aria-hidden="true"
                className="absolute inset-y-0 right-4 grid place-items-center text-3xl font-bold text-muted"
              >
                €
              </span>
            </div>
          </div>

          <div>
            <label htmlFor="ex-concept" className={label}>
              ¿Qué es?
            </label>
            <input
              id="ex-concept"
              maxLength={100}
              placeholder="Por ejemplo: Bombona de butano"
              value={concept}
              onChange={(e) => setConcept(e.target.value)}
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className={label}>Tipo de gasto</legend>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(CATEGORIES) as Category[]).map((c) => (
                <label
                  key={c}
                  className="flex min-h-14 cursor-pointer items-center gap-2 rounded-2xl border-2 border-border bg-surface px-3 text-lg font-semibold has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:ring-3 has-focus-visible:ring-focus"
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

          <div>
            <label htmlFor="ex-date" className={label}>
              Fecha
            </label>
            <input
              id="ex-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className={inputClass}
            />
          </div>

          <fieldset>
            <legend className={label}>¿Quién lo pagó?</legend>
            <div className="grid grid-cols-3 gap-2">
              {members.map((m) => (
                <label
                  key={m.id}
                  className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-3xl border-2 border-transparent bg-surface p-2 text-center shadow-sm has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:ring-3 has-focus-visible:ring-focus"
                >
                  <input
                    type="radio"
                    name="ex-paid"
                    checked={paidBy === m.id}
                    onChange={() => setPaidBy(m.id)}
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

          <fieldset>
            <legend className={label}>¿Cómo se reparte?</legend>
            <div className="grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
              {(["equal", "custom"] as const).map((mode) => (
                <label
                  key={mode}
                  className="flex min-h-14 cursor-pointer items-center justify-center rounded-xl text-center text-lg font-bold text-muted has-checked:bg-surface has-checked:text-text has-checked:shadow-sm has-focus-visible:ring-3 has-focus-visible:ring-focus"
                >
                  <input
                    type="radio"
                    name="ex-split"
                    checked={split === mode}
                    onChange={() => setSplit(mode)}
                    className="sr-only"
                  />
                  {mode === "equal" ? "A partes iguales" : "Cantidades a mano"}
                </label>
              ))}
            </div>
          </fieldset>

          {split === "equal" ? (
            <Card>
              <p className="mb-3 text-lg font-semibold">
                Entre quiénes (toca para quitar o poner):
              </p>
              <ul className="space-y-2">
                {members.map((m) => {
                  const on = between.includes(m.id);
                  return (
                    <li key={m.id}>
                      <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl px-2">
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={(e) =>
                            setBetween((list) =>
                              e.target.checked ? [...list, m.id] : list.filter((x) => x !== m.id),
                            )
                          }
                          className="size-7 accent-[var(--accent)]"
                        />
                        <span className="flex-1 text-lg font-semibold">{m.displayName}</span>
                        <span className="text-lg font-bold tabular-nums">
                          {on && amount ? formatEuros(equalShares.get(m.id) ?? 0) : "—"}
                        </span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </Card>
          ) : (
            <Card>
              <ul className="space-y-3">
                {members.map((m) => (
                  <li key={m.id} className="flex items-center gap-3">
                    <label htmlFor={`ex-share-${m.id}`} className="flex-1 text-lg font-semibold">
                      {m.displayName}
                    </label>
                    <input
                      id={`ex-share-${m.id}`}
                      inputMode="decimal"
                      placeholder="0,00"
                      value={custom[m.id] ?? ""}
                      onChange={(e) => setCustom((c) => ({ ...c, [m.id]: e.target.value }))}
                      className={`${inputClass} w-36 text-right font-bold tabular-nums`}
                    />
                  </li>
                ))}
              </ul>
              {amount !== null && (
                <p
                  aria-live="polite"
                  className={`mt-4 rounded-2xl p-3 text-lg font-semibold ${
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
            </Card>
          )}

          <div>
            <label htmlFor="ex-note" className={label}>
              Nota (opcional)
            </label>
            <textarea
              id="ex-note"
              rows={2}
              maxLength={300}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className={`${inputClass} py-3`}
            />
          </div>
        </fieldset>

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        {canEdit ? (
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
        ) : (
          <p className="text-lg text-muted">
            Solo quien lo apuntó (o quien administra) puede cambiarlo.
          </p>
        )}
      </form>
      {dialog}
    </>
  );
}
