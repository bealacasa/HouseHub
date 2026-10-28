import { Link, useParams } from "react-router";
import {
  Card,
  ErrorMessage,
  PageTitle,
  SuccessMessage,
  backLink,
  buttonPrimary,
  buttonSecondary,
} from "@/components/ui";
import { longDate, toKey } from "@/features/calendar/stays";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import {
  DIFFICULTIES,
  DURATIONS,
  ExcursionsNotReadyError,
  lastVisitedLabel,
  useExcursionPhotoUrl,
  useExcursions,
  useMarkVisited,
  type ExcursionPhoto,
} from "./excursions";
import { CoverBadge } from "./CoverBadge";
import { ExcursionsNotReady } from "./NotReady";

/** Ver una excursión: foto grande, lo esencial con palabras, el mapa y «Hoy hemos ido». */
export function ExcursionPage() {
  const { id } = useParams();
  const excursions = useExcursions();
  const { isAdmin, me } = useHouse();
  const visited = useMarkVisited();
  const excursion = (excursions.data?.items ?? []).find((x) => x.id === id);
  const photos = excursion?.photos ?? [];
  const cover = useExcursionPhotoUrl(excursion?.cover ?? null);
  if (excursions.isPending) return null;
  if (excursions.error instanceof ExcursionsNotReadyError) {
    return (
      <>
        <PageTitle title="Excursiones" />
        <ExcursionsNotReady />
      </>
    );
  }
  if (!excursion) {
    return (
      <>
        <PageTitle title="Excursión no encontrada" />
        <Link to="/excursiones" className={buttonPrimary}>
          Volver a las excursiones
        </Link>
      </>
    );
  }
  const today = toKey(new Date());
  const canEdit = isAdmin || excursion.createdBy === me.userId;
  const duration = DURATIONS[excursion.duration];
  const difficulty = DIFFICULTIES[excursion.difficulty];
  const wentToday = excursion.lastVisited === today;

  return (
    <>
      <Link to="/excursiones" className={backLink}>
        ← Excursiones
      </Link>
      <PageTitle title={excursion.title} />
      {cover.data && (
        <div className="relative mb-5">
          <img
            src={cover.data}
            alt={`Foto de ${excursion.title}`}
            className="aspect-[4/3] w-full rounded-3xl object-cover"
          />
          <CoverBadge />
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3">
        <Card className="text-center">
          <p aria-hidden="true" className="text-3xl">
            {duration.icon}
          </p>
          <p className="mt-1 text-xl font-bold">{duration.label}</p>
          <p className="text-base text-muted">{duration.hint}</p>
        </Card>
        <Card className="text-center">
          <p aria-hidden="true" className="text-3xl">
            {difficulty.icon}
          </p>
          <p className="mt-1 text-xl font-bold">{difficulty.label}</p>
          <p className="text-base text-muted">{difficulty.hint}</p>
        </Card>
      </div>

      {excursion.gettingThere && (
        <Card className="mb-5">
          <h2 className="text-xl font-bold">Cómo se llega</h2>
          <p className="mt-1 text-xl">{excursion.gettingThere}</p>
        </Card>
      )}
      {photos.length > 0 && (
        <section aria-labelledby="como-encontrarlo" className="mb-5">
          <h2 id="como-encontrarlo" className="mb-3 text-2xl font-bold">
            Cómo encontrar el sitio
          </h2>
          <ol className="space-y-4">
            {photos.map((p, i) => (
              <li key={p.path}>
                <PhotoCard photo={p} number={i + 1} total={photos.length} />
              </li>
            ))}
          </ol>
        </section>
      )}
      {excursion.description && (
        <Card className="mb-5 bg-accent-soft!">
          <p className="whitespace-pre-line text-xl leading-relaxed">{excursion.description}</p>
        </Card>
      )}

      <div className="space-y-3">
        {excursion.mapUrl && (
          <a
            href={excursion.mapUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonPrimary}
          >
            <span aria-hidden="true">🗺️</span>
            Ver en el mapa
          </a>
        )}

        <Card>
          <p className="text-xl font-semibold">{lastVisitedLabel(excursion.lastVisited, today)}</p>
          {excursion.lastVisited && (
            <p className="text-lg text-muted first-letter:uppercase">
              {longDate(excursion.lastVisited)}
            </p>
          )}
          {!wentToday && (
            <button
              type="button"
              disabled={visited.isPending}
              onClick={() => visited.mutate({ id: excursion.id, date: today })}
              className={`${buttonSecondary} mt-4`}
            >
              ✓ Hoy hemos ido
            </button>
          )}
          {visited.isError && (
            <div className="mt-3">
              <ErrorMessage>{errorMessage(visited.error)}</ErrorMessage>
            </div>
          )}
          {visited.isSuccess && wentToday && (
            <div className="mt-3">
              <SuccessMessage>¡Apuntado!</SuccessMessage>
            </div>
          )}
        </Card>

        {canEdit && (
          <Link to={`/excursiones/${excursion.id}/editar`} className={buttonSecondary}>
            Cambiar esta excursión
          </Link>
        )}
      </div>
    </>
  );
}

/** Foto numerada con su frase (como los pasos de las instrucciones). */
function PhotoCard({
  photo,
  number,
  total,
}: {
  photo: ExcursionPhoto;
  number: number;
  total: number;
}) {
  const url = useExcursionPhotoUrl(photo.path);
  return (
    <Card className="overflow-hidden p-0!">
      {url.data && (
        <img
          src={url.data}
          alt={photo.caption || `Foto del paso ${number}`}
          className="aspect-[4/3] w-full rounded-t-3xl object-cover"
        />
      )}
      <div className="flex gap-4 p-5">
        <span
          aria-hidden="true"
          className="grid size-12 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 text-2xl font-extrabold text-accent-contrast"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-base font-semibold text-muted">
            Paso {number} de {total}
          </p>
          {photo.caption && <p className="mt-1 text-xl leading-relaxed">{photo.caption}</p>}
        </div>
      </div>
    </Card>
  );
}
