import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { addDays } from "date-fns";
import { z } from "zod";
import { toKey, type DateKey } from "@/features/calendar/stays";
import { getSupabase } from "@/lib/supabase";

/** Evento del pueblo: fiestas, mercado, procesión… De un día o de varios. */
export type VillageEvent = {
  id: string;
  title: string;
  start: DateKey;
  end: DateKey;
  place: string;
  note: string;
  createdBy: string | null;
};

const eventRow = z.object({
  id: z.uuid(),
  title: z.string(),
  start_date: z.string(),
  end_date: z.string(),
  place: z.string(),
  note: z.string(),
  created_by: z.uuid().nullable(),
});

const dateKey = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige la fecha.");

export const eventInputSchema = z
  .object({
    title: z.string().trim().min(1, "Ponle un nombre al evento.").max(100, "Máximo 100 letras."),
    start: dateKey,
    end: dateKey,
    place: z.string().trim().max(100, "Máximo 100 letras."),
    note: z.string().trim().max(500, "Máximo 500 letras."),
  })
  .refine((e) => e.end >= e.start, {
    message: "La fecha de fin no puede ser antes que la de inicio.",
    path: ["end"],
  });
export type EventInput = z.input<typeof eventInputSchema>;

export const eventsKey = ["events"] as const;

/** Eventos que acaban hace menos de un mes, o más adelante; por fecha de inicio. */
export function useEvents() {
  return useQuery({
    queryKey: eventsKey,
    queryFn: async (): Promise<VillageEvent[]> => {
      const { data, error } = await getSupabase()
        .from("village_events")
        .select("id, title, start_date, end_date, place, note, created_by")
        .gte("end_date", toKey(addDays(new Date(), -31)))
        .order("start_date");
      if (error) throw error;
      return (data ?? [])
        .map((raw) => {
          const r = eventRow.parse(raw);
          return {
            id: r.id,
            title: r.title,
            start: r.start_date,
            end: r.end_date,
            place: r.place,
            note: r.note,
            createdBy: r.created_by,
          };
        })
        .sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
    },
  });
}

/** Eventos que están en marcha ese día. */
export const eventsOn = (events: readonly VillageEvent[], day: DateKey) =>
  events.filter((e) => e.start <= day && day <= e.end);

export function useSaveEvent(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: EventInput }) => {
      const e = eventInputSchema.parse(input);
      const row = {
        title: e.title,
        start_date: e.start,
        end_date: e.end,
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
