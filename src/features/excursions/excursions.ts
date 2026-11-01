import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { processImage } from "@/lib/image";
import { isMissingInDatabase } from "@/lib/dbErrors";
import { getSupabase } from "@/lib/supabase";
import {
  GpxError,
  MAX_GPX_BYTES,
  parseGpxFull,
  toCleanGpx,
  type ParsedTrack,
  type TrackTimes,
} from "./gpx";
import { expectChanged } from "@/lib/write";

/*
 * Excursiones cerca de la casa: qué es, cómo se llega, cuánto dura, si es fácil,
 * enlace al mapa, una foto de portada, fotos en orden para encontrar el sitio y la ruta GPX.
 *
 * La portada va en photo_path y los pasos en photos. (Una versión anterior guardaba la
 * portada también como primera foto de photos, y la migración 0012 hizo lo mismo con las
 * existentes: al leer, esa copia se quita de los pasos.)
 */

/** Paso para encontrar el sitio: foto con su frase («Aparcar junto a la ermita»). */
export type ExcursionPhoto = { path: string; caption: string };

export const MAX_PHOTOS = 12;

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
  /** Foto de portada (no es un paso). */
  cover: string | null;
  /** Pasos para encontrar el sitio, en orden. */
  photos: ExcursionPhoto[];
  /** Ruta GPX (limpia, solo puntos), o null. */
  trackPath: string | null;
  /** Tiempo exacto puesto a mano, en minutos (va por delante del tiempo del GPX). */
  timeMinutes: number | null;
  createdBy: string | null;
};

/** Lo que devuelve la consulta: las excursiones y si ya caben varias fotos. */
export type ExcursionsData = {
  items: Excursion[];
  /** false = falta la migración 20261028000012: solo la portada, sin pasos con foto. */
  multiPhoto: boolean;
  /** false = falta la migración 20261031000017: sin rutas GPX. */
  tracks: boolean;
  /** false = falta la migración 20261101000018: sin tiempo exacto a mano. */
  manualTime: boolean;
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
  cover: z.string().min(1).nullable(),
  photos: z
    .array(
      z.object({
        path: z.string().min(1),
        caption: z.string().trim().max(200, "Máximo 200 letras en cada foto."),
      }),
    )
    .max(MAX_PHOTOS, `Máximo ${MAX_PHOTOS} fotos para encontrar el sitio.`),
  track: z.string().min(1).nullable(),
  timeMinutes: z
    .number()
    .int()
    .min(1, "El tiempo tiene que ser de al menos 1 minuto.")
    .max(2880, "Máximo 48 horas.")
    .nullable(),
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
  photos: z.array(z.object({ path: z.string(), caption: z.string() })).optional(),
  track_path: z.string().nullable().optional(),
  time_minutes: z.number().int().nullable().optional(),
  created_by: z.uuid().nullable(),
});

export const excursionsKey = ["excursions"] as const;

/**
 * Falta ejecutar la migración de excursiones en Supabase (la tabla o la función no
 * existen). La app sigue funcionando; esta sección enseña un aviso en vez de un error.
 */
export class ExcursionsNotReadyError extends Error {
  constructor() {
    super("Las excursiones aún no están activadas.");
  }
}

const notReadyOr = (error: unknown) =>
  isMissingInDatabase(error) ? new ExcursionsNotReadyError() : error;

/** Columna que no existe (Postgres 42703; PostgREST PGRST204 al escribir). */
const isMissingColumn = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "42703" || code === "PGRST204";
};

const COLUMNS =
  "id, title, description, getting_there, duration, difficulty, map_url, photo_path, created_by";

function toExcursion(raw: unknown): Excursion {
  const r = excursionRow.parse(raw);
  // La portada no se repite como paso (ver el comentario de arriba).
  const photos = (r.photos ?? []).filter((p) => p.path !== r.photo_path);
  return {
    id: r.id,
    title: r.title,
    description: r.description,
    gettingThere: r.getting_there,
    duration: r.duration,
    difficulty: r.difficulty,
    mapUrl: r.map_url,
    cover: r.photo_path,
    photos,
    trackPath: r.track_path ?? null,
    timeMinutes: r.time_minutes ?? null,
    createdBy: r.created_by,
  };
}

export function useExcursions() {
  return useQuery({
    queryKey: excursionsKey,
    // Si falta la migración, no tiene sentido reintentar.
    retry: (count, error) => !(error instanceof ExcursionsNotReadyError) && count < 2,
    queryFn: async (): Promise<ExcursionsData> => {
      const supabase = getSupabase();
      const select = (columns: string) =>
        supabase.from("excursions").select(columns).order("title") as unknown as Promise<{
          data: unknown[] | null;
          error: unknown;
        }>;
      // Columnas que llegan con migraciones posteriores, en orden. Si falta alguna, se
      // vuelve a pedir sin la última hasta que funcione: la app sigue con lo que haya.
      const optional = ["photos", "track_path", "time_minutes"];
      let result = await select([COLUMNS, ...optional].join(", "));
      while (result.error && isMissingColumn(result.error) && optional.length > 0) {
        optional.pop();
        result = await select([COLUMNS, ...optional].join(", "));
      }
      const multiPhoto = optional.includes("photos");
      const tracks = optional.includes("track_path");
      const manualTime = optional.includes("time_minutes");
      if (result.error) throw notReadyOr(result.error);
      const items = (result.data ?? [])
        .map(toExcursion)
        .sort((a, b) => a.title.localeCompare(b.title, "es"));
      return { items, multiPhoto, tracks, manualTime };
    },
  });
}

export function useSaveExcursion(houseId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      input,
      multiPhoto,
      tracks = false,
      manualTime = false,
    }: {
      id?: string;
      input: ExcursionInput;
      multiPhoto: boolean;
      tracks?: boolean;
      manualTime?: boolean;
    }) => {
      const e = excursionInputSchema.parse(input);
      const row: Record<string, unknown> = {
        title: e.title,
        description: e.description,
        getting_there: e.gettingThere,
        duration: e.duration,
        difficulty: e.difficulty,
        map_url: e.mapUrl === "" ? null : e.mapUrl,
        photo_path: e.cover,
      };
      if (multiPhoto) row.photos = e.photos;
      if (tracks) row.track_path = e.track;
      if (manualTime) row.time_minutes = e.timeMinutes;
      const supabase = getSupabase();
      if (id) {
        const result = await supabase.from("excursions").update(row).eq("id", id).select("id");
        if (result.error) throw notReadyOr(result.error);
        expectChanged(result);
        return id;
      }
      const { data, error } = await supabase
        .from("excursions")
        .insert({ house_id: houseId, ...row })
        .select("id")
        .single();
      if (error) throw notReadyOr(error);
      return z.object({ id: z.uuid() }).parse(data).id;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: excursionsKey }),
  });
}

export function useDeleteExcursion() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (excursion: Excursion) => {
      const supabase = getSupabase();
      expectChanged(await supabase.from("excursions").delete().eq("id", excursion.id).select("id"));
      const paths = [
        ...(excursion.cover ? [excursion.cover] : []),
        ...excursion.photos.map((p) => p.path),
      ];
      if (paths.length > 0) await supabase.storage.from("excursion-photos").remove(paths);
      if (excursion.trackPath) {
        await supabase.storage.from("excursion-tracks").remove([excursion.trackPath]);
      }
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

/**
 * Lee el GPX elegido, lo limpia (solo puntos) y lo sube. Devuelve su ruta en el bucket.
 * Los errores de archivo (no es GPX, sin puntos, muy grande) salen como GpxError.
 */
export async function uploadExcursionTrack(
  houseId: string,
  file: File,
  name: string,
): Promise<string> {
  if (file.size > MAX_GPX_BYTES) throw new GpxError("El archivo es demasiado grande (máx. 10 MB).");
  const { points, times } = parseGpxFull(await file.text());
  const clean = new Blob([toCleanGpx(points, name, times)], { type: "application/gpx+xml" });
  const path = `${houseId}/${crypto.randomUUID()}.gpx`;
  const { error } = await getSupabase()
    .storage.from("excursion-tracks")
    .upload(path, clean, { contentType: "application/gpx+xml", upsert: false });
  if (error) throw error;
  return path;
}

/** La ruta guardada: sus puntos (dibujo, km y desnivel) y cuánto se tardó, si se sabe. */
export function useExcursionTrack(path: string | null) {
  return useQuery({
    queryKey: ["excursion-track", path],
    enabled: path !== null,
    staleTime: Infinity,
    queryFn: async (): Promise<ParsedTrack> => {
      const { data, error } = await getSupabase()
        .storage.from("excursion-tracks")
        .download(path ?? "");
      if (error) throw error;
      return parseGpxFull(await data.text());
    },
  });
}

/** Enlace temporal (5 min) para descargar la ruta con el nombre de la excursión. */
export async function trackDownloadUrl(path: string, title: string): Promise<string> {
  const fileName = `${title.replace(/[^\p{L}\p{N} _-]/gu, "").trim() || "ruta"}.gpx`;
  const { data, error } = await getSupabase()
    .storage.from("excursion-tracks")
    .createSignedUrl(path, 300, { download: fileName });
  if (error) throw error;
  return data.signedUrl;
}

/**
 * El tiempo que se enseña: el puesto a mano; si no, el tiempo en movimiento del GPX (sin
 * las paradas); si no, ninguno (y se enseña «un rato / media jornada…»). Nunca inventado.
 */
export function shownTime(
  excursion: Pick<Excursion, "timeMinutes">,
  gpxTimes: TrackTimes | null,
): { seconds: number; source: "manual" | "gpx" } | null {
  if (excursion.timeMinutes) return { seconds: excursion.timeMinutes * 60, source: "manual" };
  if (gpxTimes && gpxTimes.moving > 0) return { seconds: gpxTimes.moving, source: "gpx" };
  return null;
}
