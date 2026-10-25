import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { processImage } from "@/lib/image";
import { getSupabase } from "@/lib/supabase";
import type { DateKey } from "@/features/calendar/stays";

/*
 * Excursiones cerca de la casa: qué es, cómo se llega, cuánto dura, si es fácil,
 * enlace al mapa, una foto y «la última vez que fuimos».
 */

export const DURATIONS = {
  rato: { label: "Un rato", hint: "Menos de 2 horas", icon: "⏱️" },
  medio: { label: "Media jornada", hint: "Mañana o tarde", icon: "🌤️" },
  dia: { label: "Día entero", hint: "Llevar comida", icon: "🧺" },
} as const;
export type Duration = keyof typeof DURATIONS;

export const DIFFICULTIES = {
  facil: { label: "Fácil", hint: "Para todos", icon: "🟢" },
  media: { label: "Media", hint: "Algo de cuesta", icon: "🟠" },
  dificil: { label: "Difícil", hint: "Solo con buena forma", icon: "🔴" },
} as const;
export type Difficulty = keyof typeof DIFFICULTIES;

const durationKeys = Object.keys(DURATIONS) as [Duration, ...Duration[]];
const difficultyKeys = Object.keys(DIFFICULTIES) as [Difficulty, ...Difficulty[]];

export type Excursion = {
  id: string;
  title: string;
  description: string;
  gettingThere: string;
  duration: Duration;
  difficulty: Difficulty;
  mapUrl: string | null;
  photo: string | null;
  lastVisited: DateKey | null;
  createdBy: string | null;
};

export const excursionInputSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, "Escribe a dónde es la excursión.")
    .max(100, "Máximo 100 letras."),
  description: z.string().trim().max(1000, "Máximo 1000 letras."),
  gettingThere: z.string().trim().max(150, "Máximo 150 letras."),
  duration: z.enum(durationKeys, "Elige cuánto dura."),
  difficulty: z.enum(difficultyKeys, "Elige si es fácil o difícil."),
  mapUrl: z
    .string()
    .trim()
    .max(300, "El enlace es demasiado largo.")
    .refine((v) => v === "" || /^https:\/\/\S+$/.test(v), "El enlace debe empezar por https://"),
  photo: z.string().nullable(),
});
export type ExcursionInput = z.input<typeof excursionInputSchema>;

const excursionRow = z.object({
  id: z.uuid(),
  title: z.string(),
  description: z.string(),
  getting_there: z.string(),
  duration: z.enum(durationKeys),
  difficulty: z.enum(difficultyKeys),
  map_url: z.string().nullable(),
  photo_path: z.string().nullable(),
  last_visited: z.string().nullable(),
  created_by: z.uuid().nullable(),
});

export const excursionsKey = ["excursions"] as const;

export function useExcursions() {
  return useQuery({
    queryKey: excursionsKey,
    queryFn: async (): Promise<Excursion[]> => {
      const { data, error } = await getSupabase()
        .from("excursions")
        .select(
          "id, title, description, getting_there, duration, difficulty, map_url, photo_path, last_visited, created_by",
        )
        .order("title");
      if (error) throw error;
      return (data ?? [])
        .map((raw) => {
          const r = excursionRow.parse(raw);
          return {
            id: r.id,
            title: r.title,
            description: r.description,
            gettingThere: r.getting_there,
            duration: r.duration,
            difficulty: r.difficulty,
            mapUrl: r.map_url,
            photo: r.photo_path,
            lastVisited: r.last_visited,
            createdBy: r.created_by,
          };
        })
        .sort((a, b) => a.title.localeCompare(b.title, "es"));
    },
  });
}

export function useSaveExcursion(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, input }: { id?: string; input: ExcursionInput }) => {
      const e = excursionInputSchema.parse(input);
      const row = {
        title: e.title,
        description: e.description,
        getting_there: e.gettingThere,
        duration: e.duration,
        difficulty: e.difficulty,
        map_url: e.mapUrl === "" ? null : e.mapUrl,
        photo_path: e.photo,
      };
      const supabase = getSupabase();
      if (id) {
        const { error } = await supabase.from("excursions").update(row).eq("id", id);
        if (error) throw error;
        return id;
      }
      const { data, error } = await supabase
        .from("excursions")
        .insert({ house_id: houseId, ...row })
        .select("id")
        .single();
      if (error) throw error;
      return z.object({ id: z.uuid() }).parse(data).id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: excursionsKey }),
  });
}

/** «Hoy hemos ido» (cualquier miembro de la casa). */
export function useMarkVisited() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, date }: { id: string; date: DateKey }) => {
      const { error } = await getSupabase().rpc("mark_excursion_visited", {
        p_excursion: id,
        p_date: date,
      });
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: excursionsKey }),
  });
}

export function useDeleteExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (excursion: Excursion) => {
      const supabase = getSupabase();
      const { error } = await supabase.from("excursions").delete().eq("id", excursion.id);
      if (error) throw error;
      if (excursion.photo)
        await supabase.storage.from("excursion-photos").remove([excursion.photo]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: excursionsKey }),
  });
}

/** Sube la foto (reducida y sin datos ocultos, ni GPS) y devuelve su ruta. */
export async function uploadExcursionPhoto(houseId: string, file: File): Promise<string> {
  const blob = await processImage(file, 1200);
  const path = `${houseId}/${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
  const { error } = await getSupabase()
    .storage.from("excursion-photos")
    .upload(path, blob, { contentType: blob.type, upsert: false });
  if (error) throw error;
  return path;
}

/** URL temporal (5 min) de la foto. */
export function useExcursionPhotoUrl(path: string | null) {
  return useQuery({
    queryKey: ["excursion-photo", path],
    enabled: path !== null,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .storage.from("excursion-photos")
        .createSignedUrl(path ?? "", 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

/** "Fuimos hace 3 días" / "Aún no hemos ido". */
export function lastVisitedLabel(lastVisited: DateKey | null, today: DateKey): string {
  if (!lastVisited) return "Aún no hemos ido";
  const days = Math.round((Date.parse(today) - Date.parse(lastVisited)) / 86_400_000);
  if (days <= 0) return "Fuimos hoy";
  if (days === 1) return "Fuimos ayer";
  if (days < 31) return `Fuimos hace ${days} días`;
  const months = Math.round(days / 30.4);
  if (months < 12) return months === 1 ? "Fuimos hace un mes" : `Fuimos hace ${months} meses`;
  const years = Math.round(days / 365);
  return years === 1 ? "Fuimos hace un año" : `Fuimos hace ${years} años`;
}
