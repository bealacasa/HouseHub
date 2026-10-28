import { Link } from "react-router";
import { MapIcon } from "@/components/icons";
import { ErrorMessage, PageTitle, backLink, buttonPrimary, cardShadow } from "@/components/ui";
import { toKey } from "@/features/calendar/stays";
import {
  DIFFICULTIES,
  DURATIONS,
  ExcursionsNotReadyError,
  lastVisitedLabel,
  useExcursionPhotoUrl,
  useExcursions,
  type Excursion,
} from "./excursions";
import { ExcursionsNotReady } from "./NotReady";

/** Excursiones cerca de la casa: cascadas, miradores, pueblos de al lado… */
export function ExcursionsPage() {
  const excursions = useExcursions();
  const all = excursions.data?.items ?? [];
  const today = toKey(new Date());
  const notReady = excursions.error instanceof ExcursionsNotReadyError;
  return (
    <>
      <Link to="/mas" className={backLink}>
        ← Más
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
            <ExcursionCard excursion={x} today={today} />
          </li>
        ))}
      </ul>
    </>
  );
}

function ExcursionCard({ excursion, today }: { excursion: Excursion; today: string }) {
  const url = useExcursionPhotoUrl(excursion.photos[0]?.path ?? null);
  const duration = DURATIONS[excursion.duration];
  const difficulty = DIFFICULTIES[excursion.difficulty];
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
        <span className="block text-lg text-muted">
          {duration.label} · {difficulty.label}
        </span>
        <span className="block text-base text-muted">
          {lastVisitedLabel(excursion.lastVisited, today)}
        </span>
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
