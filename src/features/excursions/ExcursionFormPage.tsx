import { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import { FormSection, fieldLabel } from "@/components/form";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  inputClass,
  buttonSmall,
  buttonSmallDanger,
} from "@/components/ui";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import { moveStep } from "@/features/guides/guides";
import { ImageError } from "@/lib/image";
import {
  DIFFICULTIES,
  DURATIONS,
  ExcursionsNotReadyError,
  MAX_PHOTOS,
  excursionInputSchema,
  uploadExcursionPhoto,
  uploadExcursionTrack,
  useExcursionTrack,
  useDeleteExcursion,
  useExcursionPhotoUrl,
  useExcursions,
  useSaveExcursion,
  type Difficulty,
  type Duration,
  type Excursion,
  type ExcursionPhoto,
} from "./excursions";
import { CoverBadge } from "./CoverBadge";
import { GpxError } from "./gpx";
import { ExcursionsNotReady } from "./NotReady";
import { TrackView } from "./TrackView";

/** Añadir (/excursiones/nueva) o cambiar (/excursiones/:id/editar) una excursión. */
export function ExcursionFormPage() {
  const { id } = useParams();
  const excursions = useExcursions();
  if (excursions.isPending) return null;
  if (excursions.error instanceof ExcursionsNotReadyError) {
    return (
      <>
        <PageTitle title="Excursiones" />
        <ExcursionsNotReady />
      </>
    );
  }
  const excursion = id ? (excursions.data?.items ?? []).find((x) => x.id === id) : undefined;
  if (id && !excursion) {
    return (
      <>
        <PageTitle title="Excursión no encontrada" />
        <Link to="/excursiones" className={buttonPrimary}>
          Volver a las excursiones
        </Link>
      </>
    );
  }
  return (
    <ExcursionForm
      key={id ?? "nueva"}
      excursion={excursion}
      multiPhoto={excursions.data?.multiPhoto ?? true}
      tracks={excursions.data?.tracks ?? false}
    />
  );
}

const choice =
  "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-border bg-surface px-2 py-2 text-center leading-tight has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-3 has-focus-visible:ring-focus";

/** Foto en el formulario, con una clave estable para React al reordenar. */
type DraftPhoto = ExcursionPhoto & { key: string };
const draft = (p: ExcursionPhoto): DraftPhoto => ({ ...p, key: crypto.randomUUID() });

function ExcursionForm({
  excursion,
  multiPhoto,
  tracks,
}: {
  excursion?: Excursion;
  multiPhoto: boolean;
  tracks: boolean;
}) {
  const { house } = useHouse();
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const photoInput = useId();
  const coverInput = useId();
  const [title, setTitle] = useState(excursion?.title ?? "");
  const [description, setDescription] = useState(excursion?.description ?? "");
  const [gettingThere, setGettingThere] = useState(excursion?.gettingThere ?? "");
  const [duration, setDuration] = useState<Duration>(excursion?.duration ?? "medio");
  const [difficulty, setDifficulty] = useState<Difficulty>(excursion?.difficulty ?? "facil");
  const [mapUrl, setMapUrl] = useState(excursion?.mapUrl ?? "");
  const [cover, setCover] = useState<string | null>(excursion?.cover ?? null);
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => (excursion?.photos ?? []).map(draft));
  const [track, setTrack] = useState<string | null>(excursion?.trackPath ?? null);
  const trackInput = useId();
  const [uploading, setUploading] = useState<"cover" | "steps" | "track" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const coverUrl = useExcursionPhotoUrl(cover);
  const save = useSaveExcursion(house.id);
  const remove = useDeleteExcursion();
  const back = excursion ? `/excursiones/${excursion.id}` : "/excursiones";

  async function onCoverFile(file: File) {
    setUploading("cover");
    setError(null);
    try {
      setCover(await uploadExcursionPhoto(house.id, file));
    } catch (e) {
      setError(e instanceof ImageError ? e.message : "No se pudo subir la foto.");
    } finally {
      setUploading(null);
    }
  }

  async function onTrackFile(file: File) {
    setUploading("track");
    setError(null);
    try {
      setTrack(await uploadExcursionTrack(house.id, file, title));
    } catch (e) {
      setError(e instanceof GpxError ? e.message : "No se pudo subir la ruta.");
    } finally {
      setUploading(null);
    }
  }

  /** Sube una o varias fotos (en el orden elegido) y las añade al final de los pasos. */
  async function onFiles(files: File[]) {
    const room = MAX_PHOTOS - photos.length;
    if (room <= 0) return;
    setUploading("steps");
    setError(null);
    try {
      for (const file of files.slice(0, room)) {
        const path = await uploadExcursionPhoto(house.id, file);
        setPhotos((list) => [...list, draft({ path, caption: "" })]);
      }
      if (files.length > room)
        setError(`Solo caben ${MAX_PHOTOS} fotos; el resto no se ha añadido.`);
    } catch (e) {
      setError(e instanceof ImageError ? e.message : "No se pudo subir la foto.");
    } finally {
      setUploading(null);
    }
  }

  /** Un paso pasa a ser la portada; la portada anterior, si había, pasa a ser el paso 1. */
  function makeCover(key: string) {
    const step = photos.find((p) => p.key === key);
    if (!step) return;
    setPhotos((list) => [
      ...(cover ? [draft({ path: cover, caption: "" })] : []),
      ...list.filter((p) => p.key !== key),
    ]);
    setCover(step.path);
  }

  const changePhoto = (key: string, caption: string) =>
    setPhotos((list) => list.map((p) => (p.key === key ? { ...p, caption } : p)));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = {
      title,
      description,
      gettingThere,
      duration,
      difficulty,
      mapUrl,
      cover,
      track,
      photos: photos.map(({ path, caption }) => ({ path, caption })),
    };
    const parsed = excursionInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      { id: excursion?.id, input, multiPhoto, tracks },
      { onSuccess: (id) => navigate(`/excursiones/${id}`, { replace: true }) },
    );
  }

  async function onDelete() {
    if (!excursion) return;
    const ok = await confirm({
      title: "¿Borrar esta excursión?",
      message: excursion.title,
      confirmLabel: "Sí, borrar",
    });
    if (ok)
      remove.mutate(excursion, { onSuccess: () => navigate("/excursiones", { replace: true }) });
  }

  return (
    <>
      <Link to={back} className={backLink}>
        ← {excursion ? excursion.title : "Excursiones"}
      </Link>
      <PageTitle title={excursion ? "Cambiar la excursión" : "Nueva excursión"} />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <fieldset className="space-y-5">
          <FormSection>
            <div>
              <label htmlFor="exc-title" className={fieldLabel}>
                ¿A dónde?
              </label>
              <input
                id="exc-title"
                maxLength={100}
                placeholder="Por ejemplo: Cascada del Molino"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className={`${inputClass} text-xl font-semibold`}
              />
            </div>
            <div>
              <label htmlFor="exc-getting" className={fieldLabel}>
                ¿Cómo se llega? <span className="font-normal text-muted">(opcional)</span>
              </label>
              <input
                id="exc-getting"
                maxLength={150}
                placeholder="Por ejemplo: 20 minutos en coche"
                value={gettingThere}
                onChange={(e) => setGettingThere(e.target.value)}
                className={inputClass}
              />
            </div>
          </FormSection>

          <FormSection title="¿Cuánto dura?" as="fieldset">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DURATIONS) as Duration[]).map((d) => (
                <label key={d} className={choice}>
                  <input
                    type="radio"
                    name="exc-duration"
                    checked={duration === d}
                    onChange={() => setDuration(d)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className="text-2xl">
                    {DURATIONS[d].icon}
                  </span>
                  <span className="text-lg font-semibold">{DURATIONS[d].label}</span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="¿Es fácil?" as="fieldset">
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DIFFICULTIES) as Difficulty[]).map((d) => (
                <label key={d} className={choice}>
                  <input
                    type="radio"
                    name="exc-difficulty"
                    checked={difficulty === d}
                    onChange={() => setDifficulty(d)}
                    className="sr-only"
                  />
                  <span aria-hidden="true" className="text-2xl">
                    {DIFFICULTIES[d].icon}
                  </span>
                  <span className="text-lg font-semibold">{DIFFICULTIES[d].label}</span>
                  <span className="text-sm text-muted">{DIFFICULTIES[d].hint}</span>
                </label>
              ))}
            </div>
          </FormSection>

          <FormSection title="Más detalles" hint="Todo esto es opcional.">
            <div>
              <label htmlFor="exc-desc" className={fieldLabel}>
                ¿Qué hay que ver?
              </label>
              <textarea
                id="exc-desc"
                rows={4}
                maxLength={1000}
                placeholder="Por ejemplo: camino junto al río, hay sombra y una fuente. Aparcar en la ermita."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={`${inputClass} py-3`}
              />
            </div>
            <div>
              <label htmlFor="exc-map" className={fieldLabel}>
                Enlace al mapa
              </label>
              <input
                id="exc-map"
                type="url"
                inputMode="url"
                autoCapitalize="none"
                maxLength={300}
                placeholder="https://maps.google.com/…"
                aria-describedby="exc-map-hint"
                value={mapUrl}
                onChange={(e) => setMapUrl(e.target.value)}
                className={inputClass}
              />
              <p id="exc-map-hint" className="mt-1.5 text-base text-muted">
                En el mapa del móvil, busca el sitio, pulsa «Compartir» y «Copiar enlace».
              </p>
            </div>
          </FormSection>

          <FormSection title="Foto de portada" hint="La que se ve en la lista de excursiones.">
            {coverUrl.data && (
              <div className="relative">
                <img
                  src={coverUrl.data}
                  alt="Foto de portada"
                  className="aspect-[4/3] w-full rounded-2xl object-cover ring-4 ring-accent"
                />
                <CoverBadge />
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <label htmlFor={coverInput} className={`${buttonSmall} cursor-pointer`}>
                {uploading === "cover"
                  ? "Subiendo…"
                  : cover
                    ? "📷 Cambiar la portada"
                    : "📷 Poner foto de portada"}
              </label>
              <input
                id={coverInput}
                type="file"
                accept="image/*"
                disabled={uploading !== null}
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void onCoverFile(file);
                  e.target.value = "";
                }}
              />
              {cover && (
                <button type="button" onClick={() => setCover(null)} className={buttonSmall}>
                  Quitar la portada
                </button>
              )}
            </div>
          </FormSection>

          <FormSection
            title="Fotos para encontrar el sitio"
            hint={
              multiPhoto
                ? "Paso a paso, con una frase cada una: dónde aparcar, el cruce, el camino…"
                : "Muy pronto: falta un paso en Supabase para poder añadirlas."
            }
          >
            {photos.length > 0 && (
              <ol className="space-y-3">
                {photos.map((p, i) => (
                  <li key={p.key}>
                    <PhotoEditor
                      photo={p}
                      index={i}
                      total={photos.length}
                      onCaption={(caption) => changePhoto(p.key, caption)}
                      onMove={(delta) => setPhotos((list) => moveStep(list, i, delta))}
                      onMakeCover={() => makeCover(p.key)}
                      onRemove={() => setPhotos((list) => list.filter((x) => x.key !== p.key))}
                    />
                  </li>
                ))}
              </ol>
            )}
            {multiPhoto && photos.length < MAX_PHOTOS && (
              <>
                <label
                  htmlFor={photoInput}
                  className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-field text-lg font-semibold"
                >
                  {uploading === "steps"
                    ? "Subiendo…"
                    : photos.length === 0
                      ? "📷 Añadir fotos"
                      : "📷 Añadir más fotos"}
                </label>
                <input
                  id={photoInput}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploading !== null}
                  className="sr-only"
                  onChange={(e) => {
                    const files = Array.from(e.target.files ?? []);
                    if (files.length > 0) void onFiles(files);
                    e.target.value = "";
                  }}
                />
              </>
            )}
          </FormSection>

          {tracks && (
            <FormSection
              title="Ruta (archivo GPX)"
              hint="De Wikiloc, Komoot, el reloj… Se guardan solo los puntos de la ruta."
            >
              {track && <TrackPreview path={track} />}
              <div className="flex flex-wrap gap-2">
                <label htmlFor={trackInput} className={`${buttonSmall} cursor-pointer`}>
                  {uploading === "track"
                    ? "Subiendo…"
                    : track
                      ? "🗺️ Cambiar la ruta"
                      : "🗺️ Añadir archivo GPX"}
                </label>
                <input
                  id={trackInput}
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  disabled={uploading !== null}
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void onTrackFile(file);
                    e.target.value = "";
                  }}
                />
                {track && (
                  <button type="button" onClick={() => setTrack(null)} className={buttonSmall}>
                    Quitar la ruta
                  </button>
                )}
              </div>
            </FormSection>
          )}
        </fieldset>

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        <>
          <button
            type="submit"
            disabled={save.isPending || uploading !== null}
            className={buttonPrimary}
          >
            {save.isPending ? "Guardando…" : excursion ? "Guardar cambios" : "Añadir excursión"}
          </button>
          {excursion && (
            <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
              Borrar la excursión
            </button>
          )}
        </>
      </form>
      {dialog}
    </>
  );
}

/** Un paso del formulario: foto, su frase y botones para ordenarlo, hacerlo portada o quitarlo. */
function PhotoEditor({
  photo,
  index,
  total,
  onCaption,
  onMove,
  onMakeCover,
  onRemove,
}: {
  photo: DraftPhoto;
  index: number;
  total: number;
  onCaption: (caption: string) => void;
  onMove: (delta: -1 | 1) => void;
  onMakeCover: () => void;
  onRemove: () => void;
}) {
  const url = useExcursionPhotoUrl(photo.path);
  const n = index + 1;
  return (
    <Card className="bg-surface-2!">
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 text-xl font-extrabold text-accent-contrast"
        >
          {n}
        </span>
        <label htmlFor={`exc-photo-${photo.key}`} className="text-xl font-semibold">
          Paso {n}
        </label>
      </div>
      {url.data && (
        <img
          src={url.data}
          alt={`Foto del paso ${n}`}
          className="mb-3 aspect-[4/3] w-full rounded-2xl object-cover"
        />
      )}
      <input
        id={`exc-photo-${photo.key}`}
        maxLength={200}
        placeholder={n === 1 ? "Por ejemplo: aparcar junto a la ermita" : "¿Qué se ve aquí?"}
        value={photo.caption}
        onChange={(e) => onCaption(e.target.value)}
        className={inputClass}
      />
      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Subir el paso ${n}`}
          className={buttonSmall}
        >
          ↑ Subir
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Bajar el paso ${n}`}
          className={buttonSmall}
        >
          ↓ Bajar
        </button>
        <button
          type="button"
          onClick={onMakeCover}
          aria-label={`Poner la foto del paso ${n} de portada`}
          className={buttonSmall}
        >
          ⭐ Poner de portada
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar el paso ${n}`}
          className={buttonSmallDanger}
        >
          Quitar
        </button>
      </div>
    </Card>
  );
}

/** Vista previa de la ruta en el formulario (la misma que en la ficha). */
function TrackPreview({ path }: { path: string }) {
  const track = useExcursionTrack(path);
  if (track.isPending) return <p className="text-lg text-muted">Leyendo la ruta…</p>;
  if (track.isError) return <p className="text-lg text-danger">No se ha podido leer la ruta.</p>;
  return <TrackView points={track.data} />;
}
