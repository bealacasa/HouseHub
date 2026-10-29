import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays, format, parseISO } from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { toKey, type DateKey } from "@/features/calendar/stays";
import { isMissingInDatabase } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import { expectChanged } from "@/lib/write";

/**
 * Recordatorios personales: solo los ve quien los escribe (lo garantiza la base de
 * datos con RLS: user_id = auth.uid()). Fecha opcional; se tachan al hacerlos.
 */
export type Reminder = {
  id: string;
  text: string;
  due: DateKey | null;
  done: boolean;
  createdAt: string;
};

const reminderRow = z.object({
  id: z.uuid(),
  text: z.string(),
  due_date: z.string().nullable(),
  done_at: z.string().nullable(),
  created_at: z.string(),
});

export const reminderInputSchema = z.object({
  text: z.string().trim().min(1, "Escribe el recordatorio.").max(200, "Máximo 200 letras."),
  due: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día.")
    .nullable(),
});
export type ReminderInput = z.input<typeof reminderInputSchema>;

/** Falta ejecutar la migración de recordatorios: la sección enseña «Muy pronto». */
export class RemindersNotReadyError extends Error {
  constructor() {
    super("Los recordatorios aún no están activados.");
  }
}

const notReadyOr = (error: unknown) =>
  isMissingInDatabase(error) ? new RemindersNotReadyError() : error;

export const remindersKey = ["reminders"] as const;

/** Pendientes: primero los de fecha más cercana (y los pasados), los sin fecha al final. */
export function sortReminders(reminders: readonly Reminder[]): Reminder[] {
  return [...reminders].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      (a.due ?? "9999").localeCompare(b.due ?? "9999") ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** «Hoy», «Mañana», «Era para ayer», «vie 6 nov»… */
export function dueLabel(due: DateKey | null, today: DateKey): string | null {
  if (!due) return null;
  if (due === today) return "Hoy";
  if (due === toKey(addDays(parseISO(today), 1))) return "Mañana";
  if (due === toKey(addDays(parseISO(today), -1))) return "Era para ayer";
  const date = parseISO(due);
  const sameYear = date.getFullYear() === parseISO(today).getFullYear();
  const text = format(date, sameYear ? "EEE d MMM" : "d MMM yyyy", { locale: es });
  return due < today ? `Era para el ${text}` : text;
}

export function useReminders() {
  return useQuery({
    queryKey: remindersKey,
    retry: (count, error) => !(error instanceof RemindersNotReadyError) && count < 2,
    queryFn: async (): Promise<Reminder[]> => {
      const { data, error } = await getSupabase()
        .from("personal_reminders")
        .select("id, text, due_date, done_at, created_at")
        .order("created_at", { ascending: false })
        .limit(300);
      if (error) throw notReadyOr(error);
      return sortReminders(
        (data ?? []).map((raw) => {
          const r = reminderRow.parse(raw);
          return {
            id: r.id,
            text: r.text,
            due: r.due_date,
            done: r.done_at !== null,
            createdAt: r.created_at,
          };
        }),
      );
    },
  });
}

function useRemindersMutation<T>(fn: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: remindersKey }),
  });
}

export function useAddReminder(houseId: string) {
  return useRemindersMutation(async (input: ReminderInput) => {
    const r = reminderInputSchema.parse(input);
    const { error } = await getSupabase()
      .from("personal_reminders")
      .insert({ house_id: houseId, text: r.text, due_date: r.due });
    if (error) throw notReadyOr(error);
  });
}

export function useToggleReminder() {
  return useRemindersMutation(async ({ id, done }: { id: string; done: boolean }) => {
    expectChanged(
      await getSupabase()
        .from("personal_reminders")
        .update({ done_at: done ? new Date().toISOString() : null })
        .eq("id", id)
        .select("id"),
    );
  });
}

export function useDeleteReminders() {
  return useRemindersMutation(async (ids: string[]) => {
    const supabase = getSupabase();
    for (const id of ids) {
      expectChanged(await supabase.from("personal_reminders").delete().eq("id", id).select("id"));
    }
  });
}
