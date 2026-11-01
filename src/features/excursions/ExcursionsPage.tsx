import { Link } from "react-router";
import { MapIcon } from "@/components/icons";
import { ErrorMessage, PageTitle, backLink, buttonPrimary, cardShadow } from "@/components/ui";
import {
  DIFFICULTIES,
  DURATIONS,
  ExcursionsNotReadyError,
  useExcursionPhotoUrl,
  shownTime,
  useExcursionTrack,
  useExcursions,
  type Excursion,
} from "./excursions";
import { distanceLabel, durationLabel, trackStats } from "./gpx";
import { ExcursionsNotReady } from "./NotReady";

/** Excursiones cerca de la casa: cascadas, miradores, pueblos de al lado… */
export function ExcursionsPage() {
  const excursions = useExcursions();
  const all = excursions.data?.items ?? [];
  const notReady = excursions.error instanceof ExcursionsNotReadyError;
  return (
    <>
      <Link to="/pueblo" className={backLink}>
        ← Pueblo
      </Link>
      <PageTitle title="Excursiones" subtitle="Sitios bonitos cerca de la casa." />
      {notReady ? (
        <ExcursionsNotReady />
      ) : (
        <Link to="/excursiones/nueva" className={`${buttonPrimary} mb-6`}>
          <span aria-hidden="true" className="text-2xl leading-none">
            +
          </span>
          Añadir una excursión
        </Link>
      )}
      {excursions.isError && !notReady && (
        <ErrorMessage>No se han podido cargar las excursiones.</ErrorMessage>
      )}
      {excursions.isSuccess && all.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          Aún no hay excursiones. Por ejemplo: «Cascada del Molino».
        </p>
      )}
      <ul className="space-y-3">
        {all.map((x) => (
          <li key={x.id}>
            <ExcursionCard excursion={x} />
          </li>
        ))}
      </ul>
    </>
  );
}

/**
 * Tarjeta de excursión: portada, nombre, cuánto dura y si es fácil. El tiempo exacto puesto
 * a mano o, si no, el del GPX (con sus km); si no hay, lo que se eligió (un rato…).
 */
export function ExcursionCard({ excursion }: { excursion: Excursion }) {
  const url = useExcursionPhotoUrl(excursion.cover ?? excursion.photos[0]?.path ?? null);
  const track = useExcursionTrack(excursion.trackPath);
  const duration = DURATIONS[excursion.duration];
  const difficulty = DIFFICULTIES[excursion.difficulty];
  const time = shownTime(excursion, track.data?.times ?? null);
  const km = track.data ? distanceLabel(trackStats(track.data.points).distance) : null;
  const details = [time ? durationLabel(time.seconds) : duration.label, km, difficulty.label]
    .filter(Boolean)
    .join(" · ");
  return (
    <Link
      to={`/excursiones/${excursion.id}`}
      className={`flex min-h-24 items-center gap-4 rounded-3xl border border-teal-300/70 bg-surface p-4 active:scale-[0.99] dark:border-teal-900 ${cardShadow}`}
    >
      {url.data ? (
        <img src={url.data} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200"
        >
          <MapIcon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">{excursion.title}</span>
        <span className="block text-lg text-muted">{details}</span>
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
