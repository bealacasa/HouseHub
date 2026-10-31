import { describe, expect, it } from "vitest";
import {
  GpxError,
  distanceLabel,
  parseGpx,
  profilePath,
  shapePath,
  thin,
  toCleanGpx,
  trackStats,
} from "./gpx";

const GPX = `<?xml version="1.0"?>
<gpx version="1.1" creator="Reloj de Ana" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata><author><name>Ana García</name></author><time>2026-10-01T08:00:00Z</time></metadata>
  <trk><name>Cascada</name><trkseg>
    <trkpt lat="41.000000" lon="-2.000000"><ele>1000</ele><time>2026-10-01T08:00:00Z</time></trkpt>
    <trkpt lat="41.009000" lon="-2.000000"><ele>1100</ele><time>2026-10-01T08:20:00Z</time></trkpt>
    <trkpt lat="41.009000" lon="-1.988000"><ele>1050</ele><time>2026-10-01T08:40:00Z</time></trkpt>
  </trkseg></trk>
</gpx>`;

describe("rutas GPX", () => {
  it("lee los puntos con su altura", () => {
    const points = parseGpx(GPX);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ lat: 41, lon: -2, ele: 1000 });
  });

  it("el GPX limpio no lleva horas, autor ni aparato", () => {
    const clean = toCleanGpx(parseGpx(GPX), "Cascada <del> Molino");
    expect(clean).not.toMatch(/time|Ana García|Reloj/);
    expect(clean).toContain("<name>Cascada &lt;del&gt; Molino</name>");
    expect(parseGpx(clean)).toEqual(parseGpx(GPX));
  });

  it("calcula la distancia y el desnivel", () => {
    const stats = trackStats(parseGpx(GPX));
    // 0,009° de latitud ≈ 1 km; 0,012° de longitud a 41° ≈ 1 km.
    expect(stats.distance).toBeGreaterThan(1900);
    expect(stats.distance).toBeLessThan(2100);
    expect(stats.ascent).toBe(100);
    expect(stats.descent).toBe(50);
    expect(stats.maxEle).toBe(1100);
    expect(distanceLabel(stats.distance)).toMatch(/^2 km$|^1,9 km$|^2,1 km$/);
    expect(distanceLabel(850)).toBe("850 m");
  });

  it("sin alturas sigue sirviendo (sin desnivel ni perfil)", () => {
    const gpx = `<gpx xmlns="http://www.topografix.com/GPX/1/1"><rte>
      <rtept lat="41" lon="-2"/><rtept lat="41.01" lon="-2"/></rte></gpx>`;
    const points = parseGpx(gpx);
    expect(points.map((p) => p.ele)).toEqual([null, null]);
    const stats = trackStats(points);
    expect(stats.ascent).toBeNull();
    expect(profilePath(points, stats.cumulative, 320, 80)).toBeNull();
    expect(shapePath(points, 320, 200)).toMatch(/^M[\d.]+,[\d.]+ L[\d.]+,[\d.]+$/);
  });

  it("rechaza lo que no es una ruta", () => {
    expect(() => parseGpx("hola")).toThrow(GpxError);
    expect(() => parseGpx("<html><body>no</body></html>")).toThrow(GpxError);
    expect(() =>
      parseGpx(
        `<gpx><trk><trkseg><trkpt lat="200" lon="0"/><trkpt lat="1" lon="1"/></trkseg></trk></gpx>`,
      ),
    ).toThrow("La ruta no tiene puntos suficientes.");
  });

  it("reparte los puntos si hay demasiados (siempre el primero y el último)", () => {
    const many = Array.from({ length: 10 }, (_, i) => i);
    expect(thin(many, 4)).toEqual([0, 3, 6, 9]);
  });
});
