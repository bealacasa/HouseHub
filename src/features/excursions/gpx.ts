/*
 * Rutas GPX: leer el archivo, quedarse SOLO con los puntos (latitud, longitud y altura) y
 * calcular km, desnivel y alturas. Todo en el móvil, sin mapas ni servicios de fuera.
 *
 * Seguridad: el GPX se lee con DOMParser como XML (no ejecuta nada) y se valida a mano:
 * números dentro de rango y un máximo de puntos. Lo que se sube es un GPX nuevo, escrito
 * por la app solo con esos números: sin horas, autor, aparato ni nada que traiga el original.
 */

export type TrackPoint = { lat: number; lon: number; ele: number | null };

/**
 * Cuánto se tardó, en segundos: total (de la salida a la llegada) y en movimiento (sin
 * las paradas). Solo duraciones: la fecha y las horas del GPX original no se guardan.
 */
export type TrackTimes = { total: number; moving: number };

/** Lo que se saca de un GPX: los puntos y, si venía grabado con horas, cuánto se tardó. */
export type ParsedTrack = { points: TrackPoint[]; times: TrackTimes | null };

/** Espacio de nombres propio para guardar la duración dentro del GPX limpio. */
const HH_NS = "https://househub.app/gpx/1";

export class GpxError extends Error {}

/** Archivo original de hasta 10 MB (rutas largas con muchos puntos). */
export const MAX_GPX_BYTES = 10 * 1024 * 1024;
/** Puntos que se guardan como mucho (de sobra para una excursión; se reparten si hay más). */
export const MAX_POINTS = 5000;

const num = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined || value.trim() === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};

/** Se queda con `max` puntos repartidos a lo largo de la ruta (siempre el primero y el último). */
export function thin<T>(points: readonly T[], max: number): T[] {
  if (points.length <= max) return [...points];
  const out: T[] = [];
  const step = (points.length - 1) / (max - 1);
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)] as T);
  return out;
}

/** Lee un GPX y devuelve sus puntos (de la ruta grabada o, si no hay, de la ruta planificada). */
export function parseGpx(text: string): TrackPoint[] {
  return parseGpxFull(text).points;
}

/** Como parseGpx, y además cuánto se tardó si el GPX trae las horas de cada punto. */
export function parseGpxFull(text: string): ParsedTrack {
  const doc = new DOMParser().parseFromString(text, "application/xml");
  if (
    doc.getElementsByTagName("parsererror").length > 0 ||
    doc.documentElement.localName !== "gpx"
  ) {
    throw new GpxError("Ese archivo no es una ruta GPX.");
  }
  type Timed = TrackPoint & { time: number | null };
  const read = (tag: string) =>
    Array.from(doc.getElementsByTagNameNS("*", tag)).flatMap((el): Timed[] => {
      const lat = num(el.getAttribute("lat"));
      const lon = num(el.getAttribute("lon"));
      if (lat === null || lon === null || Math.abs(lat) > 90 || Math.abs(lon) > 180) return [];
      const child = (name: string) => Array.from(el.children).find((c) => c.localName === name);
      const ele = num(child("ele")?.textContent);
      const ms = Date.parse(child("time")?.textContent ?? "");
      return [
        {
          lat,
          lon,
          ele: ele !== null && ele > -500 && ele < 9000 ? ele : null,
          time: Number.isFinite(ms) ? ms : null,
        },
      ];
    });
  let timed = read("trkpt");
  if (timed.length < 2) timed = read("rtept");
  if (timed.length < 2) throw new GpxError("La ruta no tiene puntos suficientes.");
  const points = thin(
    timed.map(({ lat, lon, ele }) => ({ lat, lon, ele })),
    MAX_POINTS,
  );
  return { points, times: timesFromPoints(timed) ?? savedTimes(doc) };
}

/** Duración a partir de las horas de los puntos (o null si no las hay o no tienen sentido). */
function timesFromPoints(
  points: readonly (TrackPoint & { time: number | null })[],
): TrackTimes | null {
  const withTime = points.filter((p): p is TrackPoint & { time: number } => p.time !== null);
  if (withTime.length < 2 || withTime.length < points.length * 0.8) return null;
  const first = withTime[0];
  const last = withTime.at(-1);
  if (!first || !last) return null;
  const total = (last.time - first.time) / 1000;
  if (total <= 0 || total > 7 * 24 * 3600) return null;
  // En movimiento: tramos a más de ~1 km/h (en las paradas apenas se avanza y no cuentan).
  let moving = 0;
  withTime.forEach((p, i) => {
    const prev = withTime[i - 1];
    if (!prev) return;
    const dt = (p.time - prev.time) / 1000;
    if (dt > 0 && meters(prev, p) / dt >= 0.3) moving += dt;
  });
  return { total: Math.round(total), moving: Math.round(Math.min(moving, total)) };
}

/** La duración que la propia app guardó en un GPX limpio (sin horas). */
function savedTimes(doc: Document): TrackTimes | null {
  const el = doc.getElementsByTagNameNS(HH_NS, "tiempo")[0];
  const total = num(el?.getAttribute("total"));
  const moving = num(el?.getAttribute("movimiento"));
  if (total === null || moving === null || total <= 0 || total > 7 * 24 * 3600) return null;
  return { total: Math.round(total), moving: Math.round(Math.min(Math.max(moving, 0), total)) };
}

const round = (n: number, decimals: number) => Number(n.toFixed(decimals));
const escapeXml = (s: string) =>
  s.replace(
    /[<>&'"]/g,
    (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c] ?? c,
  );

/**
 * GPX limpio escrito por la app: nombre de la excursión, los puntos y, si se sabe, cuánto
 * se tardó (solo la duración, sin fecha ni horas). Nada más del archivo original.
 */
export function toCleanGpx(
  points: readonly TrackPoint[],
  name: string,
  times: TrackTimes | null = null,
): string {
  const pts = points
    .map(
      (p) =>
        `<trkpt lat="${round(p.lat, 6)}" lon="${round(p.lon, 6)}">${
          p.ele === null ? "" : `<ele>${round(p.ele, 1)}</ele>`
        }</trkpt>`,
    )
    .join("");
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<gpx version="1.1" creator="House Hub" xmlns="http://www.topografix.com/GPX/1/1" xmlns:hh="${HH_NS}">` +
    (times
      ? `<metadata><extensions><hh:tiempo total="${times.total}" movimiento="${times.moving}"/></extensions></metadata>`
      : "") +
    `<trk><name>${escapeXml(name || "Ruta")}</name><trkseg>${pts}</trkseg></trk></gpx>\n`
  );
}

/** Distancia entre dos puntos en metros (fórmula del haversine). */
function meters(a: TrackPoint, b: TrackPoint): number {
  const R = 6_371_000;
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLon = (b.lon - a.lon) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type TrackStats = {
  /** Distancia total en metros. */
  distance: number;
  /** Metros que se suben (suma de subidas), o null si el GPX no trae alturas. */
  ascent: number | null;
  descent: number | null;
  minEle: number | null;
  maxEle: number | null;
  /** Distancia acumulada (m) en cada punto, para el perfil. */
  cumulative: number[];
};

export function trackStats(points: readonly TrackPoint[]): TrackStats {
  const cumulative = [0];
  points.forEach((p, i) => {
    const prev = points[i - 1];
    if (prev) cumulative.push((cumulative[i - 1] ?? 0) + meters(prev, p));
  });
  const eles = points.map((p) => p.ele).filter((e): e is number => e !== null);
  let ascent: number | null = null;
  let descent: number | null = null;
  if (eles.length >= 2) {
    // Con un umbral de 3 m para no sumar el «ruido» del GPS como si fueran cuestas.
    ascent = 0;
    descent = 0;
    let ref = eles[0] ?? 0;
    for (const e of eles.slice(1)) {
      if (e - ref >= 3) {
        ascent += e - ref;
        ref = e;
      } else if (ref - e >= 3) {
        descent += ref - e;
        ref = e;
      }
    }
  }
  return {
    distance: cumulative.at(-1) ?? 0,
    ascent: ascent === null ? null : Math.round(ascent),
    descent: descent === null ? null : Math.round(descent),
    minEle: eles.length ? Math.round(Math.min(...eles)) : null,
    maxEle: eles.length ? Math.round(Math.max(...eles)) : null,
    cumulative,
  };
}

/** «8,4 km» / «850 m». */
export function distanceLabel(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} m`;
  return `${(m / 1000).toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;
}

/** Dibujo de la forma de la ruta en un recuadro de `w`×`h` (el norte arriba). */
export function shapePath(points: readonly TrackPoint[], w: number, h: number, pad = 8): string {
  const pts = thin(points, 600);
  const midLat = (pts.reduce((s, p) => s + p.lat, 0) / pts.length) * (Math.PI / 180);
  // Proyección sencilla: la longitud se encoge con la latitud para no deformar la forma.
  const xy = pts.map((p) => [p.lon * Math.cos(midLat), -p.lat] as const);
  const xs = xy.map(([x]) => x);
  const ys = xy.map(([, y]) => y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const spanX = Math.max(...xs) - minX || 1e-9;
  const spanY = Math.max(...ys) - minY || 1e-9;
  const scale = Math.min((w - 2 * pad) / spanX, (h - 2 * pad) / spanY);
  const offX = (w - spanX * scale) / 2;
  const offY = (h - spanY * scale) / 2;
  return xy
    .map(
      ([x, y], i) =>
        `${i === 0 ? "M" : "L"}${(offX + (x - minX) * scale).toFixed(1)},${(offY + (y - minY) * scale).toFixed(1)}`,
    )
    .join(" ");
}

/** Perfil de alturas (área) en un recuadro de `w`×`h`, o null si no hay alturas. */
export function profilePath(
  points: readonly TrackPoint[],
  cumulative: readonly number[],
  w: number,
  h: number,
): string | null {
  const data = points
    .map((p, i) => ({ d: cumulative[i] ?? 0, e: p.ele }))
    .filter((x): x is { d: number; e: number } => x.e !== null);
  if (data.length < 2) return null;
  const sampled = thin(data, 300);
  const maxD = sampled.at(-1)?.d || 1;
  const minE = Math.min(...sampled.map((x) => x.e));
  const spanE = Math.max(...sampled.map((x) => x.e)) - minE || 1;
  const line = sampled
    .map(
      (x, i) =>
        `${i === 0 ? "M" : "L"}${((x.d / maxD) * w).toFixed(1)},${(h - 4 - ((x.e - minE) / spanE) * (h - 8)).toFixed(1)}`,
    )
    .join(" ");
  return `${line} L${w},${h} L0,${h} Z`;
}

/** «3 h 20 min» / «45 min» (redondeado a 5 minutos si pasa de una hora). */
export function durationLabel(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const rounded = Math.round(minutes / 5) * 5;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}
