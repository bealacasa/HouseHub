/*
 * Temas de temporada: se activan solos por fecha (sin volver a desplegar) y se quitan
 * solos al acabar. Solo cambian colores y algún adorno: nunca el tamaño ni el contraste
 * mínimo (los colores de cada tema también cumplen 7:1 en texto).
 */

export type Season = "halloween";

/** Halloween 2026: 15 días, del 26 de octubre al 9 de noviembre (ambos incluidos). */
const SEASONS: readonly { season: Season; from: string; to: string }[] = [
  { season: "halloween", from: "2026-10-26", to: "2026-11-09" },
];

/** Fecha local del móvil como "aaaa-mm-dd" (no UTC: que cambie a medianoche de aquí). */
function localKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function seasonOn(date: Date): Season | null {
  const day = localKey(date);
  return SEASONS.find((s) => s.from <= day && day <= s.to)?.season ?? null;
}

/** Pone (o quita) data-season en <html>; el CSS cambia los colores con eso. */
export function applySeason(date = new Date()): Season | null {
  const season = seasonOn(date);
  if (season) document.documentElement.dataset.season = season;
  else delete document.documentElement.dataset.season;
  return season;
}

/** Tema de hoy (para los adornos en pantalla). */
export const currentSeason = (): Season | null =>
  typeof document === "undefined"
    ? null
    : ((document.documentElement.dataset.season as Season | undefined) ?? null);
