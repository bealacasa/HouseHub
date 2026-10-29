import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { es } from "date-fns/locale";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { expectChanged } from "@/lib/write";

/** Fechas siempre como "YYYY-MM-DD" (día local, sin hora). */
export type DateKey = string;

export type Stay = {
  id: string;
  memberId: string;
  start: DateKey;
  end: DateKey;
  people: number;
  note: string;
  createdBy: string | null;
};

const stayRow = z.object({
  id: z.uuid(),
  member_id: z.uuid(),
  start_date: z.string(),
  end_date: z.string(),
  people: z.number().int(),
  note: z.string(),
  created_by: z.uuid().nullable(),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha.");

export const stayInputSchema = z
  .object({
    memberId: z.uuid("Elige quién va."),
    start: dateKey,
    end: dateKey,
    people: z.number().int().min(1, "Al menos 1 persona.").max(50, "Máximo 50 personas."),
    note: z.string().trim().max(500, "Máximo 500 letras."),
  })
  .refine((s) => s.end >= s.start, {
    message: "El día de vuelta no puede ser antes que el de llegada.",
    path: ["end"],
  })
  .refine((s) => differenceInDays(s.start, s.end) <= 366, {
    message: "Una reserva no puede durar más de un año.",
    path: ["end"],
  });
export type StayInput = z.input<typeof stayInputSchema>;

function differenceInDays(a: DateKey, b: DateKey): number {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86_400_000);
}

export const toKey = (date: Date): DateKey => format(date, "yyyy-MM-dd");

/** ¿Se pisan dos periodos (días incluidos)? */
export const overlaps = (
  a: { start: DateKey; end: DateKey },
  b: { start: DateKey; end: DateKey },
) => a.start <= b.end && b.start <= a.end;

/** Reservas que coinciden con ese periodo (sin contar la que se está editando). */
export function overlapping(
  stays: readonly Stay[],
  period: { start: DateKey; end: DateKey },
  excludeId?: string,
): Stay[] {
  return stays.filter((s) => s.id !== excludeId && overlaps(s, period));
}

export const staysOn = (stays: readonly Stay[], day: DateKey) =>
  stays.filter((s) => s.start <= day && day <= s.end);

/** Semanas (lunes a domingo) que cubren el mes, para la cuadrícula del calendario. */
export function monthGrid(month: Date): Date[][] {
  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  });
  const weeks: Date[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return weeks;
}

/** "sábado 17 de octubre" */
export const longDate = (key: DateKey) => format(parseISO(key), "EEEE d 'de' MMMM", { locale: es });
/** "17 oct" */
export const shortDate = (key: DateKey) => format(parseISO(key), "d MMM", { locale: es });

/** "Del 17 al 19 de octubre" / "El sábado 17 de octubre" */
export function periodLabel(stay: { start: DateKey; end: DateKey }): string {
  if (stay.start === stay.end) return `El ${longDate(stay.start)}`;
  const a = parseISO(stay.start);
  const b = parseISO(stay.end);
  if (a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear()) {
    return `Del ${format(a, "d")} al ${format(b, "d 'de' MMMM", { locale: es })}`;
  }
  return `Del ${format(a, "d 'de' MMMM", { locale: es })} al ${format(b, "d 'de' MMMM", { locale: es })}`;
}

export const nightsLabel = (stay: { start: DateKey; end: DateKey }) => {
  const n = differenceInDays(stay.start, stay.end);
  return n === 0 ? "1 día" : n === 1 ? "1 noche" : `${n} noches`;
};

// ---------------------------------------------------------------------------
// Datos
// ---------------------------------------------------------------------------

export const staysKey = ["stays"] as const;

/** Reservas desde hace 2 meses en adelante (suficiente para el calendario y el inicio). */
export function useStays() {
  return useQuery({
    queryKey: staysKey,
    queryFn: async (): Promise<Stay[]> => {
      const since = toKey(addDays(new Date(), -62));
      const { data, error } = await getSupabase()
        .from("stays")
        .select("id, member_id, start_date, end_date, people, note, created_by")
        .gte("end_date", since)
        .order("start_date");
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const r = stayRow.parse(raw);
        return {
          id: r.id,
          memberId: r.member_id,
          start: r.start_date,
          end: r.end_date,
          people: r.people,
          note: r.note,
          createdBy: r.created_by,
        };
      });
    },
  });
}

export function useSaveStay(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: StayInput }) => {
      const s = stayInputSchema.parse(input);
      const row = {
        member_id: s.memberId,
        start_date: s.start,
        end_date: s.end,
        people: s.people,
        note: s.note,
      };
      const supabase = getSupabase();
      if (id) {
        expectChanged(await supabase.from("stays").update(row).eq("id", id).select("id"));
        return;
      }
      const { error } = await supabase.from("stays").insert({ house_id: houseId, ...row });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staysKey }),
  });
}

export function useDeleteStay() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      expectChanged(await getSupabase().from("stays").delete().eq("id", id).select("id"));
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: staysKey }),
  });
}
