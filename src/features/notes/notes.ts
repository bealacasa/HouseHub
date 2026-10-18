import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";

/** Nota de la casa: «falta aceite», «acordarse de…». Se tacha cuando está hecha. */
export type Note = {
  id: string;
  text: string;
  done: boolean;
  createdBy: string | null;
  createdAt: string;
};

const noteRow = z.object({
  id: z.uuid(),
  text: z.string(),
  done_at: z.string().nullable(),
  created_by: z.uuid().nullable(),
  created_at: z.string(),
});

export const noteTextSchema = z
  .string()
  .trim()
  .min(1, "Escribe la nota.")
  .max(200, "Máximo 200 letras.");

export const notesKey = ["notes"] as const;

/** Pendientes primero (las más nuevas arriba); después las hechas. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort(
    (a, b) => Number(a.done) - Number(b.done) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function useNotes() {
  return useQuery({
    queryKey: notesKey,
    queryFn: async (): Promise<Note[]> => {
      const { data, error } = await getSupabase()
        .from("house_notes")
        .select("id, text, done_at, created_by, created_at")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return sortNotes(
        (data ?? []).map((raw) => {
          const r = noteRow.parse(raw);
          return {
            id: r.id,
            text: r.text,
            done: r.done_at !== null,
            createdBy: r.created_by,
            createdAt: r.created_at,
          };
        }),
      );
    },
  });
}

function useNotesMutation<T>(fn: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: notesKey }),
  });
}

export function useAddNote(houseId: string) {
  return useNotesMutation(async (raw: string) => {
    const text = noteTextSchema.parse(raw);
    const { error } = await getSupabase().from("house_notes").insert({ house_id: houseId, text });
    if (error) throw error;
  });
}

export function useToggleNote() {
  return useNotesMutation(async ({ id, done }: { id: string; done: boolean }) => {
    const { error } = await getSupabase()
      .from("house_notes")
      .update({ done_at: done ? new Date().toISOString() : null })
      .eq("id", id);
    if (error) throw error;
  });
}

export function useDeleteNotes() {
  return useNotesMutation(async (ids: string[]) => {
    const supabase = getSupabase();
    for (const id of ids) {
      const { error } = await supabase.from("house_notes").delete().eq("id", id);
      if (error) throw error;
    }
  });
}
