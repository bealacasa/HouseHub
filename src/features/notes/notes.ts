import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { getSupabase } from "@/lib/supabase";
import { expectChanged } from "@/lib/write";

/**
 * Nota de la casa: «falta aceite», «acordarse de…». Se tacha cuando está hecha. Las
 * importantes (⭐) son las que salen en el inicio.
 */
export type Note = {
  id: string;
  text: string;
  done: boolean;
  important: boolean;
  createdBy: string | null;
  createdAt: string;
};

const noteRow = z.object({
  id: z.uuid(),
  text: z.string(),
  done_at: z.string().nullable(),
  // Opcional: sin la migración 0016 no existe la columna.
  important: z.boolean().optional(),
  created_by: z.uuid().nullable(),
  created_at: z.string(),
});

export const noteTextSchema = z
  .string()
  .trim()
  .min(1, "Escribe la nota.")
  .max(200, "Máximo 200 letras.");

export const notesKey = ["notes"] as const;

/** Pendientes primero (las importantes arriba y luego las más nuevas); después las hechas. */
export function sortNotes(notes: readonly Note[]): Note[] {
  return [...notes].sort(
    (a, b) =>
      Number(a.done) - Number(b.done) ||
      Number(b.important) - Number(a.important) ||
      b.createdAt.localeCompare(a.createdAt),
  );
}

/** Las notas y si ya se pueden marcar como importantes (falta la migración 0016 si no). */
export type NotesData = { items: Note[]; canMarkImportant: boolean };

const COLUMNS = "id, text, done_at, created_by, created_at";
const isMissingColumn = (error: unknown) =>
  ["42703", "PGRST204"].includes(String((error as { code?: unknown } | null)?.code));

export function useNotes() {
  return useQuery({
    queryKey: notesKey,
    queryFn: async (): Promise<NotesData> => {
      const supabase = getSupabase();
      let canMarkImportant = true;
      let result: { data: unknown[] | null; error: unknown } = await supabase
        .from("house_notes")
        .select(`${COLUMNS}, important`)
        .order("created_at", { ascending: false })
        .limit(200);
      if (result.error && isMissingColumn(result.error)) {
        canMarkImportant = false;
        result = await supabase
          .from("house_notes")
          .select(COLUMNS)
          .order("created_at", { ascending: false })
          .limit(200);
      }
      if (result.error) throw result.error;
      const items = sortNotes(
        (result.data ?? []).map((raw) => {
          const r = noteRow.parse(raw);
          return {
            id: r.id,
            text: r.text,
            done: r.done_at !== null,
            important: r.important ?? false,
            createdBy: r.created_by,
            createdAt: r.created_at,
          };
        }),
      );
      return { items, canMarkImportant };
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

/** Añade una nota; «important» solo se envía si es importante (así funciona sin la 0016). */
export function useAddNote(houseId: string) {
  return useNotesMutation(async (input: string | { text: string; important: boolean }) => {
    const { text: raw, important } =
      typeof input === "string" ? { text: input, important: false } : input;
    const text = noteTextSchema.parse(raw);
    const row: Record<string, unknown> = { house_id: houseId, text };
    if (important) row.important = true;
    const { error } = await getSupabase().from("house_notes").insert(row);
    if (error) throw error;
  });
}

/** Marcar o quitar «importante» (⭐): las importantes salen en el inicio. */
export function useSetImportant() {
  return useNotesMutation(async ({ id, important }: { id: string; important: boolean }) => {
    expectChanged(
      await getSupabase().from("house_notes").update({ important }).eq("id", id).select("id"),
    );
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
