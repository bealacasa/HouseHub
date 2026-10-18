import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { useState } from "react";
import { Link, useSearchParams } from "react-router";
import { Avatar } from "@/components/Avatar";
import { useConfirm } from "@/components/ConfirmDialog";
import { Card, ErrorMessage, PageTitle, buttonPrimary } from "@/components/ui";
import { shortDay } from "@/components/form";
import { toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage, type Member } from "@/features/house/house";
import {
  CATEGORIES,
  repeatLabel,
  useDeleteSettlement,
  useLedger,
  useSettle,
  useStopRecurring,
  type Expense,
  type Recurring,
  type Settlement,
} from "./expenses";
import { balances, formatEuros, settleUp, type Transfer } from "./money";

const TABS = [
  { id: "resumen", label: "Resumen" },
  { id: "gastos", label: "Gastos" },
  { id: "pagos", label: "Pagos" },
] as const;
type Tab = (typeof TABS)[number]["id"];

/**
 * Gastos compartidos. Arriba, tu saldo; debajo tres pestañas para no amontonar:
 * Resumen (cómo quedar en paz y saldos), Gastos (por meses) y Pagos (historial).
 */
export function ExpensesPage() {
  const { members, me } = useHouse();
  const ledger = useLedger();
  const [params, setParams] = useSearchParams();
  const tab: Tab = TABS.find((t) => t.id === params.get("ver"))?.id ?? "resumen";
  const data = ledger.data ?? { expenses: [], settlements: [], recurring: [] };
  const balance = balances(
    members.map((m) => m.id),
    data.expenses,
    data.settlements,
  );
  const thisMonth = toKey(new Date()).slice(0, 7);
  const spentThisMonth = data.expenses
    .filter((e) => e.date.startsWith(thisMonth))
    .reduce((s, e) => s + e.amount, 0);

  return (
    <>
      <PageTitle title="Gastos" />
      {ledger.isError && <ErrorMessage>No se han podido cargar los gastos.</ErrorMessage>}
      {ledger.isSuccess && (
        <MyBalance cents={balance.get(me.id) ?? 0} spentThisMonth={spentThisMonth} />
      )}
      <Link to="/gastos/nuevo" className={`${buttonPrimary} my-5`}>
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Apuntar un gasto
      </Link>

      <div
        role="tablist"
        aria-label="Qué ver"
        className="mb-5 grid grid-cols-3 gap-1 rounded-2xl bg-surface-2 p-1"
      >
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setParams(t.id === "resumen" ? {} : { ver: t.id }, { replace: true })}
            className={`min-h-14 rounded-xl text-lg font-bold ${
              tab === t.id ? "bg-accent text-accent-contrast shadow-sm" : "text-muted"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {ledger.isSuccess && (
        <div
          role="tabpanel"
          aria-label={TABS.find((t) => t.id === tab)?.label}
          className="space-y-5"
        >
          {tab === "resumen" && (
            <>
              <SettleCard transfers={settleUp(balance)} members={members} />
              <BalancesCard balance={balance} members={members} />
            </>
          )}
          {tab === "gastos" && (
            <>
              <RecurringCard
                recurring={data.recurring}
                expenses={data.expenses}
                members={members}
              />
              <ExpenseList expenses={data.expenses} members={members} />
            </>
          )}
          {tab === "pagos" && <PaymentHistory settlements={data.settlements} members={members} />}
        </div>
      )}
    </>
  );
}

/** «Debes 20 €» / «Te deben 35 €» / «Estás en paz» (+ lo gastado este mes). */
export function MyBalance({ cents, spentThisMonth }: { cents: number; spentThisMonth?: number }) {
  const owe = cents < 0;
  const even = cents === 0;
  return (
    <Card
      className={
        even
          ? "bg-accent-soft!"
          : owe
            ? "border-amber-500/60 bg-amber-50! dark:bg-amber-950/40!"
            : "border-emerald-600/50 bg-emerald-50! dark:bg-emerald-950/40!"
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
      {spentThisMonth !== undefined && (
        <p className="mt-2 text-lg text-muted">
          Gastado en la casa este mes:{" "}
          <strong className="text-text">{formatEuros(spentThisMonth)}</strong>
        </p>
      )}
    </Card>
  );
}

const nameIn = (members: readonly Member[], id: string) =>
  members.find((m) => m.id === id)?.displayName ?? "Alguien";

function SettleCard({ transfers, members }: { transfers: Transfer[]; members: readonly Member[] }) {
  const { house } = useHouse();
  const settle = useSettle(house.id);
  const [dialog, confirm] = useConfirm();
  const name = (id: string) => nameIn(members, id);

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
      {transfers.length === 0 ? (
        <div className="text-center">
          <p className="text-2xl font-bold">Todos estáis en paz ✓</p>
          <p className="mt-1 text-lg text-muted">Nadie debe nada a nadie.</p>
        </div>
      ) : (
        <>
          <h2 className="text-2xl font-bold">Cómo quedar en paz</h2>
          <ul className="mt-2 divide-y divide-border">
            {transfers.map((t) => (
              <li key={`${t.from}-${t.to}`} className="py-3">
                <p className="text-xl">
                  <strong>{name(t.from)}</strong> paga <strong>{formatEuros(t.cents)}</strong> a{" "}
                  <strong>{name(t.to)}</strong>
                </p>
                <button
                  type="button"
                  disabled={settle.isPending}
                  onClick={() => void markPaid(t)}
                  className="mt-2 min-h-12 w-full rounded-xl border-2 border-accent bg-surface text-lg font-bold text-accent"
                >
                  Marcar como pagado
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
      {settle.isSuccess && (
        <p
          role="status"
          className="mt-3 text-center text-lg font-semibold text-emerald-700 dark:text-emerald-300"
        >
          ✓ Pago apuntado. Lo verás en la pestaña «Pagos».
        </p>
      )}
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
      <ul className="mt-2 divide-y divide-border">
        {members.map((m) => {
          const c = balance.get(m.id) ?? 0;
          return (
            <li key={m.id} className="flex items-center gap-3 py-3">
              <Avatar member={m} members={members} size="sm" />
              <span className="flex-1 text-lg font-semibold">{m.displayName}</span>
              <span
                className={`text-right text-lg font-bold tabular-nums ${
                  c > 0
                    ? "text-emerald-700 dark:text-emerald-300"
                    : c < 0
                      ? "text-amber-800 dark:text-amber-300"
                      : "text-muted"
                }`}
              >
                {c === 0
                  ? "En paz"
                  : c > 0
                    ? `Le deben ${formatEuros(c)}`
                    : `Debe ${formatEuros(-c)}`}
              </span>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

/** Gastos fijos (internet cada mes…). Se tocan para cambiarlos o dejar de repetirlos. */
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
    <section aria-labelledby="fijos">
      <h2 id="fijos" className="mb-2 text-xl font-bold">
        Gastos fijos
      </h2>
      <Card className="overflow-hidden p-0!">
        <ul className="divide-y divide-border">
          {recurring.map((r) => {
            // Se cambia desde el último recibo de la serie («¿Se repite?» → «No» lo para).
            const last = expenses.find((e) => e.recurringId === r.id);
            const body = (
              <>
                <CategoryTile category={r.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-lg font-bold">{r.concept}</span>
                  <span className="block text-base text-muted">
                    🔁 {repeatLabel(r.everyMonths)} · próximo {shortDay(r.nextDate).toLowerCase()}
                  </span>
                </span>
                <span className="text-lg font-extrabold tabular-nums">{formatEuros(r.amount)}</span>
              </>
            );
            return (
              <li key={r.id}>
                {last ? (
                  <Link
                    to={`/gastos/${last.id}`}
                    aria-label={`${r.concept}, ${formatEuros(r.amount)}, ${repeatLabel(r.everyMonths).toLowerCase()}. Paga ${nameIn(members, r.paidBy)}. Tocar para cambiar`}
                    className="flex min-h-18 items-center gap-3 px-4 py-3"
                  >
                    {body}
                  </Link>
                ) : (
                  <div className="px-4 py-3">
                    <div className="flex items-center gap-3">{body}</div>
                    {(isAdmin || r.createdBy === me.userId) && (
                      <button
                        type="button"
                        disabled={stop.isPending}
                        onClick={() => void onStop(r)}
                        className="mt-2 min-h-12 w-full rounded-xl border-2 border-border text-lg font-bold text-danger"
                      >
                        Dejar de repetir
                      </button>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </Card>
      <p className="mt-2 text-base text-muted">
        Toca uno para cambiar el importe o dejar de repetirlo.
      </p>
      {stop.isError && (
        <div className="mt-3">
          <ErrorMessage>{errorMessage(stop.error)}</ErrorMessage>
        </div>
      )}
      {dialog}
    </section>
  );
}

function CategoryTile({ category }: { category: Expense["category"] }) {
  return (
    <span
      aria-hidden="true"
      className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent-soft text-2xl"
    >
      {CATEGORIES[category].emoji}
    </span>
  );
}

/** "2026-10" → "Octubre 2026". */
const monthTitle = (ym: string) => {
  const t = format(parseISO(`${ym}-01`), "MMMM yyyy", { locale: es });
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/** Agrupa por mes, en el orden en que vienen (los más recientes primero). */
function byMonth<T extends { date: string }>(items: readonly T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const ym = item.date.slice(0, 7);
    groups.set(ym, [...(groups.get(ym) ?? []), item]);
  }
  return [...groups];
}

/** Gastos por meses, con el total de cada mes. */
function ExpenseList({ expenses, members }: { expenses: Expense[]; members: readonly Member[] }) {
  const [all, setAll] = useState(false);
  if (expenses.length === 0) return <Empty>Aún no hay gastos apuntados.</Empty>;
  const months = byMonth(expenses);
  const shown = all ? months : months.slice(0, 3);
  return (
    <>
      {shown.map(([ym, list]) => (
        <section key={ym} aria-label={monthTitle(ym)}>
          <h2 className="mb-2 flex items-baseline justify-between gap-2 text-xl font-bold">
            {monthTitle(ym)}
            <span className="text-lg font-semibold text-muted tabular-nums">
              {formatEuros(list.reduce((s, e) => s + e.amount, 0))}
            </span>
          </h2>
          <Card className="overflow-hidden p-0!">
            <ul className="divide-y divide-border">
              {list.map((e) => (
                <li key={e.id}>
                  <ExpenseRow expense={e} members={members} />
                </li>
              ))}
            </ul>
          </Card>
        </section>
      ))}
      {!all && months.length > 3 && (
        <button
          type="button"
          onClick={() => setAll(true)}
          className="min-h-12 text-lg font-semibold text-accent underline"
        >
          Ver meses anteriores
        </button>
      )}
    </>
  );
}

function ExpenseRow({ expense, members }: { expense: Expense; members: readonly Member[] }) {
  return (
    <Link to={`/gastos/${expense.id}`} className="flex min-h-18 items-center gap-3 px-4 py-3">
      <CategoryTile category={expense.category} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-lg font-bold">
          {expense.recurringId && <span aria-label="Gasto fijo">🔁 </span>}
          {expense.concept}
        </span>
        <span className="block truncate text-base text-muted">
          {format(parseISO(expense.date), "d MMM", { locale: es })} · pagó{" "}
          {nameIn(members, expense.paidBy)}
        </span>
      </span>
      <span className="text-lg font-extrabold tabular-nums">{formatEuros(expense.amount)}</span>
    </Link>
  );
}

/** Historial de pagos para quedar en paz («Carmen pagó 20 € a Ana»). */
function PaymentHistory({
  settlements,
  members,
}: {
  settlements: Settlement[];
  members: readonly Member[];
}) {
  const { me, isAdmin } = useHouse();
  const remove = useDeleteSettlement();
  const [dialog, confirm] = useConfirm();
  if (settlements.length === 0) {
    return (
      <Empty>
        Aún no hay pagos. Cuando alguien pulse «Marcar como pagado» en el Resumen, quedará apuntado
        aquí.
      </Empty>
    );
  }

  async function onDelete(s: Settlement) {
    const ok = await confirm({
      title: "¿Borrar este pago?",
      message: `${nameIn(members, s.from)} pagó ${formatEuros(s.cents)} a ${nameIn(members, s.to)}. Si lo borras, volverá a deberse.`,
      confirmLabel: "Sí, borrarlo",
    });
    if (ok) remove.mutate(s.id);
  }

  return (
    <>
      {byMonth(settlements).map(([ym, list]) => (
        <section key={ym} aria-label={`Pagos de ${monthTitle(ym)}`}>
          <h2 className="mb-2 text-xl font-bold">{monthTitle(ym)}</h2>
          <Card className="overflow-hidden p-0!">
            <ul className="divide-y divide-border">
              {list.map((s) => {
                const from = members.find((m) => m.id === s.from);
                return (
                  <li key={s.id} className="flex min-h-18 items-center gap-3 px-4 py-3">
                    {from && <Avatar member={from} members={members} size="sm" />}
                    <span className="min-w-0 flex-1">
                      <span className="block text-lg">
                        <strong>{nameIn(members, s.from)}</strong> pagó a{" "}
                        <strong>{nameIn(members, s.to)}</strong>
                      </span>
                      <span className="block text-base text-muted first-letter:uppercase">
                        {format(parseISO(s.date), "EEEE d MMM", { locale: es })}
                      </span>
                    </span>
                    <span className="text-right">
                      <span className="block text-lg font-extrabold tabular-nums">
                        {formatEuros(s.cents)}
                      </span>
                      {(isAdmin || s.createdBy === me.userId) && (
                        <button
                          type="button"
                          disabled={remove.isPending}
                          onClick={() => void onDelete(s)}
                          aria-label={`Borrar el pago de ${nameIn(members, s.from)} a ${nameIn(members, s.to)}`}
                          className="min-h-12 text-base font-semibold text-danger underline"
                        >
                          Borrar
                        </button>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </Card>
        </section>
      ))}
      {remove.isError && <ErrorMessage>{errorMessage(remove.error)}</ErrorMessage>}
      {dialog}
    </>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
      {children}
    </p>
  );
}
