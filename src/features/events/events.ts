import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { z } from "zod";
import { toKey, type DateKey } from "@/features/calendar/stays";
import { getSupabase } from "@/lib/supabase";

/** Evento del pueblo: fiestas, mercado, procesión… */
export type VillageEvent = {
  id: string;
  title: string;
  date: DateKey;
  /** "HH:MM" o null si no tiene hora. */
  time: string | null;
  place: string;
  note: string;
  createdBy: string | null;
};

const eventRow = z.object({
  id: z.uuid(),
  title: z.string(),
  date: z.string(),
  start_time: z.string().nullable(),
  place: z.string(),
  note: z.string(),
  created_by: z.uuid().nullable(),
});

export const eventInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un nombre al evento.").max(100, "Máximo 100 letras."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige el día."),
  time: z
    .string()
    .refine((t) => t === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(t), "La hora no es válida."),
  place: z.string().trim().max(100, "Máximo 100 letras."),
  note: z.string().trim().max(500, "Máximo 500 letras."),
});
export type EventInput = z.input<typeof eventInputSchema>;

export const eventsKey = ["events"] as const;

/** Eventos desde hace un mes en adelante, por fecha y hora. */
export function useEvents() {
  return useQuery({
    queryKey: eventsKey,
    queryFn: async (): Promise<VillageEvent[]> => {
      const { data, error } = await getSupabase()
        .from("village_events")
        .select("id, title, date, start_time, place, note, created_by")
        .gte("date", toKey(addDays(new Date(), -31)))
        .order("date");
      if (error) throw error;
      return (data ?? [])
        .map((raw) => {
          const r = eventRow.parse(raw);
          return {
            id: r.id,
            title: r.title,
            date: r.date,
            time: r.start_time ? r.start_time.slice(0, 5) : null,
            place: r.place,
            note: r.note,
            createdBy: r.created_by,
          };
        })
        .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? "").localeCompare(b.time ?? ""));
    },
  });
}

export const eventsOn = (events: readonly VillageEvent[], day: DateKey) =>
  events.filter((e) => e.date === day);

export function useSaveEvent(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }) => {
      const e = eventInputSchema.parse(input);
      const row = {
        title: e.title,
        date: e.date,
        start_time: e.time || null,
        place: e.place,
        note: e.note,
      };
      const supabase = getSupabase();
      const { error } = id
        ? await supabase.from("village_events").update(row).eq("id", id)
        : await supabase.from("village_events").insert({ house_id: houseId, ...row });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey }),
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await getSupabase().from("village_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: eventsKey }),
  });
}
