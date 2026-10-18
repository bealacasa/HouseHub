import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { processImage } from "@/lib/image";
import { getSupabase } from "@/lib/supabase";

/*
 * Instrucciones de la casa: título, introducción y pasos ordenados (texto + foto opcional).
 * Los pasos viajan juntos (jsonb): se guardan de una vez y la base de datos valida su forma.
 */

export type GuideStep = { text: string; photo: string | null };

export type Guide = {
  id: string;
  title: string;
  intro: string;
  steps: GuideStep[];
  createdBy: string | null;
};

const stepSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1, "Escribe qué hay que hacer en cada paso.")
    .max(500, "Máximo 500 letras por paso."),
  photo: z.string().nullable(),
});

export const guideInputSchema = z.object({
  title: z.string().trim().min(1, "Ponle un título.").max(80, "Máximo 80 letras."),
  intro: z.string().trim().max(500, "Máximo 500 letras."),
  steps: z.array(stepSchema).min(1, "Añade al menos un paso.").max(30, "Máximo 30 pasos."),
});
export type GuideInput = z.input<typeof guideInputSchema>;

const guideRow = z.object({
  id: z.uuid(),
  title: z.string(),
  intro: z.string(),
  steps: z.array(z.object({ text: z.string(), photo: z.string().nullable().optional() })),
  created_by: z.uuid().nullable(),
});

export const guidesKey = ["guides"] as const;

export function useGuides() {
  return useQuery({
    queryKey: guidesKey,
    queryFn: async (): Promise<Guide[]> => {
      const { data, error } = await getSupabase()
        .from("guides")
        .select("id, title, intro, steps, created_by")
        .order("title");
      if (error) throw error;
      return (data ?? []).map((raw) => {
        const r = guideRow.parse(raw);
        return {
          id: r.id,
          title: r.title,
          intro: r.intro,
          steps: r.steps.map((s) => ({ text: s.text, photo: s.photo ?? null })),
          createdBy: r.created_by,
        };
      });
    },
  });
}

/** Mueve un paso arriba (-1) o abajo (+1). */
export function moveStep<T>(steps: readonly T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (target < 0 || target >= steps.length) return [...steps];
  const next = [...steps];
  [next[index], next[target]] = [next[target] as T, next[index] as T];
  return next;
}

export function useSaveGuide(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: GuideInput }) => {
      const g = guideInputSchema.parse(input);
      const row = { title: g.title, intro: g.intro, steps: g.steps };
      const supabase = getSupabase();
      if (id) {
        const { error } = await supabase.from("guides").update(row).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("guides")
        .insert({ house_id: houseId, ...row })
        .select("id")
        .single();
      if (error) throw error;
      return z.object({ id: z.uuid() }).parse(data).id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guidesKey }),
  });
}

export function useDeleteGuide() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (guide: Guide) => {
      const supabase = getSupabase();
      const { error } = await supabase.from("guides").delete().eq("id", guide.id);
      if (error) throw error;
      const photos = guide.steps.flatMap((s) => (s.photo ? [s.photo] : []));
      if (photos.length > 0) await supabase.storage.from("guide-photos").remove(photos);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: guidesKey }),
  });
}

/** Sube la foto de un paso (reducida y sin datos ocultos) y devuelve su ruta. */
export async function uploadStepPhoto(houseId: string, file: File): Promise<string> {
  const blob = await processImage(file, 1200);
  const path = `${houseId}/${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await getSupabase()
    .storage.from("guide-photos")
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}

/** URL temporal (5 min) de la foto de un paso. */
export function useStepPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["guide-photo", path],
    enabled: path !== null,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .storage.from("guide-photos")
        .createSignedUrl(path ?? "", 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}
