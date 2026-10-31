import { distanceLabel, profilePath, shapePath, trackStats, type TrackPoint } from "./gpx";

/**
 * La ruta sin mapa de fondo (la app no carga nada de fuera): su forma, el perfil de
 * subidas y bajadas y los datos que importan para decidir (km, desnivel, altura).
 * Solo SVG con clases (la CSP no permite estilos en línea).
 */
export function TrackView({ points }: { points: TrackPoint[] }) {
  const stats = trackStats(points);
  const shape = shapePath(points, 320, 200);
  const profile = profilePath(points, stats.cumulative, 320, 80);
  const toXY = (cmd: string | undefined) => {
    const [x, y] = (cmd ?? "").slice(1).split(",").map(Number);
    return x !== undefined && y !== undefined && Number.isFinite(x) && Number.isFinite(y)
      ? { x, y }
      : null;
  };
  const start = toXY(shape.split(" ")[0]);
  const end = toXY(shape.split(" ").at(-1));
  // Ruta circular: salida y llegada en el mismo sitio → un solo punto.
  const loop = start !== null && end !== null && Math.hypot(start.x - end.x, start.y - end.y) < 14;

  const facts = [
    { label: "Distancia", value: distanceLabel(stats.distance) },
    stats.ascent !== null && { label: "Sube", value: `${stats.ascent} m` },
    stats.descent !== null && { label: "Baja", value: `${stats.descent} m` },
    stats.maxEle !== null && { label: "Altura máxima", value: `${stats.maxEle} m` },
  ].filter((f): f is { label: string; value: string } => Boolean(f));

  return (
    <div className="space-y-3">
      <svg
        viewBox="0 0 320 200"
        role="img"
        aria-label={`Forma de la ruta: ${distanceLabel(stats.distance)}`}
        className="w-full rounded-2xl bg-surface-2"
      >
        <path
          d={shape}
          fill="none"
          strokeWidth={4}
          strokeLinejoin="round"
          strokeLinecap="round"
          className="stroke-teal-700 dark:stroke-teal-300"
        />
        {end && !loop && (
          <circle
            cx={end.x}
            cy={end.y}
            r={7}
            className="fill-red-700 stroke-white"
            strokeWidth={2}
          />
        )}
        {start && (
          <circle
            cx={start.x}
            cy={start.y}
            r={loop ? 9 : 7}
            className={loop ? "fill-emerald-600 stroke-red-700" : "fill-emerald-600 stroke-white"}
            strokeWidth={loop ? 4 : 2}
          />
        )}
      </svg>
      <p className="flex flex-wrap gap-x-5 gap-y-1 text-base text-muted">
        {loop ? (
          <span className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="size-4 rounded-full border-3 border-red-700 bg-emerald-600"
            />{" "}
            Salida y llegada (ruta circular)
          </span>
        ) : (
          <>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 rounded-full bg-emerald-600" /> Salida
            </span>
            <span className="flex items-center gap-2">
              <span aria-hidden="true" className="size-3.5 rounded-full bg-red-700" /> Llegada
            </span>
          </>
        )}
      </p>
      <dl className="grid grid-cols-2 gap-2">
        {facts.map((f) => (
          <div key={f.label} className="rounded-2xl bg-surface-2 px-4 py-3">
            <dt className="text-base text-muted">{f.label}</dt>
            <dd className="text-2xl font-extrabold tabular-nums">{f.value}</dd>
          </div>
        ))}
      </dl>
      {profile && (
        <figure>
          <figcaption className="mb-1 text-base font-semibold text-muted">
            Subidas y bajadas
            {stats.minEle !== null && stats.maxEle !== null && (
              <span className="font-normal">
                {" "}
                · de {stats.minEle} a {stats.maxEle} m
              </span>
            )}
          </figcaption>
          <svg
            viewBox="0 0 320 80"
            aria-hidden="true"
            className="w-full"
            preserveAspectRatio="none"
          >
            <path
              d={profile}
              className="fill-teal-200 stroke-teal-700 dark:fill-teal-900 dark:stroke-teal-300"
              strokeWidth={2}
            />
          </svg>
        </figure>
      )}
    </div>
  );
}
