import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { toKey } from "@/features/calendar/stays";
import { getSupabase } from "@/lib/supabase";
import { MAX_CENTS } from "./money";

export const CATEGORIES = {
  ibi: { label: "IBI", emoji: "🏛️" },
  comunidad: { label: "Comunidad", emoji: "🏘️" },
  luz: { label: "Luz", emoji: "💡" },
  agua: { label: "Agua", emoji: "🚰" },
  gas: { label: "Gas", emoji: "🔥" },
  internet: { label: "Internet", emoji: "📶" },
  seguro: { label: "Seguro", emoji: "🛡️" },
  reparacion: { label: "Reparación", emoji: "🔧" },
  compra: { label: "Compra", emoji: "🛒" },
  otros: { label: "Otros", emoji: "📦" },
} as const;
export type Category = keyof typeof CATEGORIES;
const categoryKeys = Object.keys(CATEGORIES) as [Category, ...Category[]];

export type Expense = {
  id: string;
  concept: string;
  category: Category;
  amount: number;
  date: string;
  paidBy: string;
  split: "equal" | "custom";
  note: string;
  createdBy: string | null;
  shares: Map<string, number>;
};

export type Settlement = {
  id: string;
  from: string;
  to: string;
  cents: number;
  date: string;
  createdBy: string | null;
};

const expenseRow = z.object({
  id: z.uuid(),
  concept: z.string(),
  category: z.enum(categoryKeys),
  amount_cents: z.number().int(),
  date: z.string(),
  paid_by: z.uuid(),
  split_mode: z.enum(["equal", "custom"]),
  note: z.string(),
  created_by: z.uuid().nullable(),
  expense_shares: z.array(z.object({ member_id: z.uuid(), cents: z.number().int() })),
});

const settlementRow = z.object({
  id: z.uuid(),
  from_member: z.uuid(),
  to_member: z.uuid(),
  cents: z.number().int(),
  date: z.string(),
  created_by: z.uuid().nullable(),
});

export const expenseInputSchema = z
  .object({
    concept: z.string().trim().min(1, "Escribe qué es (por ejemplo: «Butano»).").max(100),
    category: z.enum(categoryKeys),
    amount: z
      .number()
      .int()
      .min(1, "Escribe el importe.")
      .max(MAX_CENTS, "Importe demasiado alto."),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha."),
    paidBy: z.uuid("Elige quién pagó."),
    split: z.enum(["equal", "custom"]),
    note: z.string().trim().max(300, "Máximo 300 letras."),
    shares: z
      .array(z.object({ member: z.uuid(), cents: z.number().int().min(0) }))
      .min(1, "Elige entre quiénes se reparte."),
  })
  .refine((e) => e.shares.reduce((s, x) => s + x.cents, 0) === e.amount, {
    message: "Las partes no suman el total.",
    path: ["shares"],
  });
export type ExpenseInput = z.input<typeof expenseInputSchema>;

export const expensesKey = ["expenses"] as const;

export type Ledger = { expenses: Expense[]; settlements: Settlement[] };

/** Todos los gastos (con sus partes) y los pagos para quedar en paz. */
export function useLedger() {
  return useQuery({
    queryKey: expensesKey,
    queryFn: async (): Promise<Ledger> => {
      const supabase = getSupabase();
      const [e, s] = await Promise.all([
        supabase
          .from("expenses")
          .select(
            "id, concept, category, amount_cents, date, paid_by, split_mode, note, created_by, expense_shares(member_id, cents)",
          )
          .order("date", { ascending: false }),
        supabase
          .from("settlements")
          .select("id, from_member, to_member, cents, date, created_by")
          .order("date", { ascending: false }),
      ]);
      if (e.error) throw e.error;
      if (s.error) throw s.error;
      return {
        expenses: (e.data ?? []).map((raw) => {
          const r = expenseRow.parse(raw);
          return {
            id: r.id,
            concept: r.concept,
            category: r.category,
            amount: r.amount_cents,
            date: r.date,
            paidBy: r.paid_by,
            split: r.split_mode,
            note: r.note,
            createdBy: r.created_by,
            shares: new Map(r.expense_shares.map((x) => [x.member_id, x.cents])),
          };
        }),
        settlements: (s.data ?? []).map((raw) => {
          const r = settlementRow.parse(raw);
          return {
            id: r.id,
            from: r.from_member,
            to: r.to_member,
            cents: r.cents,
            date: r.date,
            createdBy: r.created_by,
          };
        }),
      };
    },
  });
}

function useLedgerMutation<T, R = void>(fn: (input: T) => Promise<R>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: expensesKey }),
  });
}

export function useSaveExpense() {
  return useLedgerMutation(async ({ id, input }: { id?: string; input: ExpenseInput }) => {
    const e = expenseInputSchema.parse(input);
    const { data, error } = await getSupabase().rpc("save_expense", {
      p_id: id ?? null,
      p_concept: e.concept,
      p_category: e.category,
      p_amount: e.amount,
      p_date: e.date,
      p_paid_by: e.paidBy,
      p_split: e.split,
      p_note: e.note,
      p_shares: e.shares,
    });
    if (error) throw error;
    return z.uuid().parse(data);
  });
}

export function useDeleteExpense() {
  return useLedgerMutation(async (id: string) => {
    const { error } = await getSupabase().from("expenses").delete().eq("id", id);
    if (error) throw error;
  });
}

/** Apunta un pago para quedar en paz («Ana pagó 20 € a Luis»). */
export function useSettle(houseId: string) {
  return useLedgerMutation(async (t: { from: string; to: string; cents: number }) => {
    const { error } = await getSupabase()
      .from("settlements")
      .insert({
        house_id: houseId,
        from_member: t.from,
        to_member: t.to,
        cents: t.cents,
        date: toKey(new Date()),
      });
    if (error) throw error;
  });
}

export function useDeleteSettlement() {
  return useLedgerMutation(async (id: string) => {
    const { error } = await getSupabase().from("settlements").delete().eq("id", id);
    if (error) throw error;
  });
}
