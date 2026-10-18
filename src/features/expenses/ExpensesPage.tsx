import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link } from "react-router";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, ErrorMessage, PageTitle, buttonPrimary, cardShadow } from "@/components/ui";
import { shortDay } from "@/components/form";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage, type Member } from "@/features/house/house";
import {
  CATEGORIES,
  repeatLabel,
  useLedger,
  useSettle,
  useStopRecurring,
  type Expense,
  type Recurring,
} from "./expenses";
import { balances, formatEuros, settleUp, type Transfer } from "./money";

/** Gastos compartidos: tu saldo, cómo quedar en paz, saldo de cada uno y los gastos. */
export function ExpensesPage() {
  const { members, me } = useHouse();
  const ledger = useLedger();
  const data = ledger.data ?? { expenses: [], settlements: [], recurring: [] };
  const balance = balances(
    members.map((m) => m.id),
    data.expenses,
    data.settlements,
  );
  const transfers = settleUp(balance);

  return (
    <>
      <PageTitle title="Gastos" subtitle="Lo que se gasta en la casa y quién debe a quién." />
      <Link to="/gastos/nuevo" className={`${buttonPrimary} mb-6`}>
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Apuntar un gasto
      </Link>
      {ledger.isError && <ErrorMessage>No se han podido cargar los gastos.</ErrorMessage>}
      {ledger.isSuccess && (
        <div className="space-y-5">
          <MyBalance cents={balance.get(me.id) ?? 0} />
          <SettleCard transfers={transfers} members={members} />
          <BalancesCard balance={balance} members={members} />
          <RecurringCard recurring={data.recurring} expenses={data.expenses} members={members} />
          <ExpenseList expenses={data.expenses} members={members} />
        </div>
      )}
    </>
  );
}

/** «Debes 20 €» / «Te deben 35 €» / «Estás en paz». */
export function MyBalance({ cents }: { cents: number }) {
  const owe = cents < 0;
  const even = cents === 0;
  return (
    <Card
      className={
        even
          ? "bg-accent-soft"
          : owe
            ? "border-amber-500/60 bg-amber-50 dark:bg-amber-950/40"
            : "border-emerald-600/50 bg-emerald-50 dark:bg-emerald-950/40"
      }
    >
      <p className="text-lg font-semibold text-muted">Tu saldo</p>
      <p className="mt-1 text-3xl font-extrabold tracking-tight">
        {even
          ? "Estás en paz ✓"
          : owe
            ? `Debes ${formatEuros(-cents)}`
            : `Te deben ${formatEuros(cents)}`}
      </p>
    </Card>
  );
}

function SettleCard({ transfers, members }: { transfers: Transfer[]; members: readonly Member[] }) {
  const { house } = useHouse();
  const settle = useSettle(house.id);
  const [dialog, confirm] = useConfirm();
  const name = (id: string) => members.find((m) => m.id === id)?.displayName ?? "Alguien";
  if (transfers.length === 0) return null;

  async function markPaid(t: Transfer) {
    const ok = await confirm({
      title: "¿Ya está pagado?",
      message: `${name(t.from)} ha pagado ${formatEuros(t.cents)} a ${name(t.to)}.`,
      confirmLabel: "Sí, ya está pagado",
    });
    if (ok) settle.mutate(t);
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold">Cómo quedar en paz</h2>
      <p className="mt-1 text-lg text-muted">Con estos pagos, todos quedáis a cero.</p>
      <ul className="mt-4 space-y-3">
        {transfers.map((t) => (
          <li key={`${t.from}-${t.to}`} className="rounded-2xl bg-surface-2 p-4">
            <p className="text-xl">
              <strong>{name(t.from)}</strong> paga <strong>{formatEuros(t.cents)}</strong> a{" "}
              <strong>{name(t.to)}</strong>
            </p>
            <button
              type="button"
              disabled={settle.isPending}
              onClick={() => void markPaid(t)}
              className="mt-3 min-h-12 w-full rounded-xl border-2 border-accent bg-surface text-lg font-bold text-accent"
            >
              Marcar como pagado
            </button>
          </li>
        ))}
      </ul>
      {settle.isError && (
        <div className="mt-3">
          <ErrorMessage>{errorMessage(settle.error)}</ErrorMessage>
        </div>
      )}
      {dialog}
    </Card>
  );
}

function BalancesCard({
  balance,
  members,
}: {
  balance: ReadonlyMap<string, number>;
  members: readonly Member[];
}) {
  return (
    <Card>
      <h2 className="text-2xl font-bold">Saldo de cada uno</h2>
      <ul className="mt-3 divide-y divide-border">
        {members.map((m) => {
          const c = balance.get(m.id) ?? 0;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar member={m} members={members} size="sm" />
              <span className="flex-1 text-lg font-semibold">{m.displayName}</span>
              <span
                className={`text-lg font-bold tabular-nums ${
                  c > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : c < 0
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-muted"
                }`}
              >
                {c === 0 ? "En paz" : c > 0 ? `+${formatEuros(c)}` : `−${formatEuros(-c)}`}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-base text-muted">+ le deben · − debe</p>
    </Card>
  );
}

/** Gastos fijos (internet cada mes…): cuándo toca el próximo y botón para dejar de repetir. */
function RecurringCard({
  recurring,
  expenses,
  members,
}: {
  recurring: Recurring[];
  expenses: Expense[];
  members: readonly Member[];
}) {
  const { me, isAdmin } = useHouse();
  const stop = useStopRecurring();
  const [dialog, confirm] = useConfirm();
  if (recurring.length === 0) return null;

  async function onStop(r: Recurring) {
    const ok = await confirm({
      title: "¿Dejar de repetir este gasto?",
      message: `«${r.concept}» ya no se apuntará solo. Los gastos ya apuntados se quedan.`,
      confirmLabel: "Sí, dejar de repetir",
    });
    if (ok) stop.mutate(r.id);
  }

  return (
    <Card>
      <h2 className="text-2xl font-bold">Gastos fijos</h2>
      <p className="mt-1 text-lg text-muted">Se apuntan solos cuando toca.</p>
      <ul className="mt-3 divide-y divide-border">
        {recurring.map((r) => {
          const payer = members.find((m) => m.id === r.paidBy)?.displayName ?? "Alguien";
          // Para cambiar el importe se edita el último recibo de la serie.
          const last = expenses.find((e) => e.recurringId === r.id);
          const canStop = isAdmin || r.createdBy === me.userId;
          return (
            <li key={r.id} className="py-3">
              <div className="flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl"
                >
                  {CATEGORIES[r.category].emoji}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-xl font-bold">{r.concept}</span>
                  <span className="block text-base text-muted">
                    🔁 {repeatLabel(r.everyMonths)} · paga {payer}
                  </span>
                </span>
                <span className="text-xl font-extrabold tabular-nums">{formatEuros(r.amount)}</span>
              </div>
              <p className="mt-2 text-lg">
                Próximo: <strong className="first-letter:uppercase">{shortDay(r.nextDate)}</strong>
              </p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {last && (
                  <Link
                    to={`/gastos/${last.id}`}
                    className="grid min-h-12 place-items-center rounded-xl border-2 border-accent bg-surface text-lg font-bold text-accent"
                  >
                    Cambiar
                  </Link>
                )}
                {canStop && (
                  <button
                    type="button"
                    disabled={stop.isPending}
                    onClick={() => void onStop(r)}
                    className="min-h-12 rounded-xl border-2 border-border bg-surface text-lg font-bold text-danger"
                  >
                    Dejar de repetir
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      {stop.isError && (
        <div className="mt-3">
          <ErrorMessage>{errorMessage(stop.error)}</ErrorMessage>
        </div>
      )}
      {dialog}
    </Card>
  );
}

function ExpenseList({ expenses, members }: { expenses: Expense[]; members: readonly Member[] }) {
  const [all, setAll] = useState(false);
  const shown = all ? expenses : expenses.slice(0, 15);
  return (
    <section aria-labelledby="lista-gastos">
      <h2 id="lista-gastos" className="mb-3 text-2xl font-bold">
        Gastos
      </h2>
      {expenses.length === 0 ? (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          Aún no hay gastos apuntados.
        </p>
      ) : (
        <ul className="space-y-3">
          {shown.map((e) => (
            <li key={e.id}>
              <ExpenseCard expense={e} members={members} />
            </li>
          ))}
        </ul>
      )}
      {!all && expenses.length > 15 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="mt-3 min-h-12 text-lg font-semibold text-accent underline"
        >
          Ver todos ({expenses.length})
        </button>
      )}
    </section>
  );
}

function ExpenseCard({ expense, members }: { expense: Expense; members: readonly Member[] }) {
  const cat = CATEGORIES[expense.category];
  const payer = members.find((m) => m.id === expense.paidBy)?.displayName ?? "Alguien";
  return (
    <Link
      to={`/gastos/${expense.id}`}
      className={`flex min-h-20 items-center gap-4 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.99] ${cardShadow}`}
    >
      <span
        aria-hidden="true"
        className="grid size-14 shrink-0 place-items-center rounded-2xl bg-accent-soft text-3xl"
      >
        {cat.emoji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xl font-bold">{expense.concept}</span>
        <span className="block text-base text-muted">
          {expense.recurringId && <span aria-label="Gasto fijo">🔁 </span>}
          Pagó {payer} · {format(parseISO(expense.date), "d MMM", { locale: es })} · {cat.label}
        </span>
      </span>
      <span className="text-xl font-extrabold tabular-nums">{formatEuros(expense.amount)}</span>
    </Link>
  );
}
