import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { isMissingInDatabase } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import { expectChanged } from "@/lib/write";

/*
 * Lista para irse (cerrar la casa): la familia la escribe una vez; al irse se va tachando
 * (en este móvil) y, al terminar, se apunta quién y cuándo. La base de datos admite también
 * una lista «al llegar» (kind = 'arrive'), que de momento la app no usa.
 */

export type ChecklistKind = "leave";

export const CHECKLISTS = {
  leave: {
    path: "/irse",
    title: "Al irse de la casa",
    short: "Al irse",
    done: "¡Casa cerrada!",
    lastVerb: "cerró la casa",
    defaults: [
      "Cerrar la llave del gas",
      "Cerrar la llave del agua",
      "Apagar el calentador",
      "Vaciar la nevera y dejarla abierta",
      "Sacar la basura",
      "Cerrar ventanas y bajar persianas",
      "Cerrar la puerta con llave",
    ],
  },
} as const satisfies Record<
  ChecklistKind,
  {
    path: string;
    title: string;
    short: string;
    done: string;
    lastVerb: string;
    defaults: readonly string[];
  }
>;

export type ChecklistItem = { id: string; text: string; position: number };
export type ChecklistRun = { userId: string | null; checked: number; total: number; at: string };

export const itemTextSchema = z
  .string()
  .trim()
  .min(1, "Escribe qué hay que hacer.")
  .max(150, "Máximo 150 letras.");

const itemRow = z.object({ id: z.uuid(), text: z.string(), position: z.number().int() });
const runRow = z.object({
  user_id: z.uuid().nullable(),
  checked: z.number().int(),
  total: z.number().int(),
  finished_at: z.string(),
});

/** Falta ejecutar la migración de listas: la sección enseña «Muy pronto». */
export class ChecklistsNotReadyError extends Error {
  constructor() {
    super("Las listas aún no están activadas.");
  }
}
const notReadyOr = (error: unknown) =>
  isMissingInDatabase(error) ? new ChecklistsNotReadyError() : error;
const noRetryIfNotReady = (count: number, error: unknown) =>
  !(error instanceof ChecklistsNotReadyError) && count < 2;

const itemsKey = (kind: ChecklistKind) => ["checklist", kind] as const;
const runKey = (kind: ChecklistKind) => ["checklist-run", kind] as const;

export function useChecklist(kind: ChecklistKind) {
  return useQuery({
    queryKey: itemsKey(kind),
    retry: noRetryIfNotReady,
    queryFn: async (): Promise<ChecklistItem[]> => {
      const { data, error } = await getSupabase()
        .from("checklist_items")
        .select("id, text, position")
        .eq("kind", kind)
        .order("position");
      if (error) throw notReadyOr(error);
      return (data ?? []).map((raw) => itemRow.parse(raw)).sort((a, b) => a.position - b.position);
    },
  });
}

/** La última vez que alguien terminó esta lista. */
export function useLastRun(kind: ChecklistKind) {
  return useQuery({
    queryKey: runKey(kind),
    retry: noRetryIfNotReady,
    queryFn: async (): Promise<ChecklistRun | null> => {
      const { data, error } = await getSupabase()
        .from("checklist_runs")
        .select("user_id, checked, total, finished_at")
        .eq("kind", kind)
        .order("finished_at", { ascending: false })
        .limit(1);
      if (error) throw notReadyOr(error);
      const raw = data?.[0];
      if (!raw) return null;
      const r = runRow.parse(raw);
      return { userId: r.user_id, checked: r.checked, total: r.total, at: r.finished_at };
    },
  });
}

function useItemsMutation<T>(kind: ChecklistKind, fn: (input: T) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: itemsKey(kind) }),
  });
}

/** Añade cosas al final de la lista (una o varias, p. ej. las típicas). */
export function useAddItems(houseId: string, kind: ChecklistKind) {
  return useItemsMutation(kind, async ({ texts, after }: { texts: string[]; after: number }) => {
    const rows = texts.map((t, i) => ({
      house_id: houseId,
      kind,
      text: itemTextSchema.parse(t),
      position: after + i + 1,
    }));
    const supabase = getSupabase();
    for (const row of rows) {
      const { error } = await supabase.from("checklist_items").insert(row);
      if (error) throw notReadyOr(error);
    }
  });
}

export function useRemoveItem(kind: ChecklistKind) {
  return useItemsMutation(kind, async (id: string) => {
    expectChanged(await getSupabase().from("checklist_items").delete().eq("id", id).select("id"));
  });
}

/** Intercambia el orden de dos cosas (subir o bajar una). */
export function useSwapItems(kind: ChecklistKind) {
  return useItemsMutation(kind, async ({ a, b }: { a: ChecklistItem; b: ChecklistItem }) => {
    const supabase = getSupabase();
    expectChanged(
      await supabase
        .from("checklist_items")
        .update({ position: b.position })
        .eq("id", a.id)
        .select("id"),
    );
    expectChanged(
      await supabase
        .from("checklist_items")
        .update({ position: a.position })
        .eq("id", b.id)
        .select("id"),
    );
  });
}

export function useFinishRun(houseId: string, kind: ChecklistKind) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ checked, total }: { checked: number; total: number }) => {
      const { error } = await getSupabase()
        .from("checklist_runs")
        .insert({ house_id: houseId, kind, checked, total });
      if (error) throw notReadyOr(error);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: runKey(kind) }),
  });
}

/*
 * Lo tachado se guarda en este móvil (por si se cierra la app a medias) y solo vale
 * para el día de hoy: mañana la lista empieza de nuevo.
 */
const storageKey = (kind: ChecklistKind) => `househub:checklist:${kind}`;

export function loadTicks(kind: ChecklistKind, today: string): string[] {
  try {
    const raw = localStorage.getItem(storageKey(kind));
    if (!raw) return [];
    const parsed = z.object({ day: z.string(), ids: z.array(z.string()) }).parse(JSON.parse(raw));
    return parsed.day === today ? parsed.ids : [];
  } catch {
    return [];
  }
}

export function saveTicks(kind: ChecklistKind, today: string, ids: string[]): void {
  try {
    if (ids.length === 0) localStorage.removeItem(storageKey(kind));
    else localStorage.setItem(storageKey(kind), JSON.stringify({ day: today, ids }));
  } catch {
    // Sin almacenamiento (modo privado): se tacha igual, solo que no se recuerda.
  }
}
