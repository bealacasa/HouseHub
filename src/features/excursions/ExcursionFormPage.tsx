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
  useDeleteExcursion,
  useExcursionPhotoUrl,
  useExcursions,
  useSaveExcursion,
  type Difficulty,
  type Duration,
  type Excursion,
  type ExcursionPhoto,
} from "./excursions";
import { ExcursionsNotReady } from "./NotReady";

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
    />
  );
}

const choice =
  "flex min-h-16 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-border bg-surface px-2 py-2 text-center leading-tight has-checked:border-accent has-checked:bg-accent-soft has-checked:text-accent has-focus-visible:ring-3 has-focus-visible:ring-focus";

/** Foto en el formulario, con una clave estable para React al reordenar. */
type DraftPhoto = ExcursionPhoto & { key: string };
const draft = (p: ExcursionPhoto): DraftPhoto => ({ ...p, key: crypto.randomUUID() });

function ExcursionForm({ excursion, multiPhoto }: { excursion?: Excursion; multiPhoto: boolean }) {
  const { house, me, isAdmin } = useHouse();
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const photoInput = useId();
  const [title, setTitle] = useState(excursion?.title ?? "");
  const [description, setDescription] = useState(excursion?.description ?? "");
  const [gettingThere, setGettingThere] = useState(excursion?.gettingThere ?? "");
  const [duration, setDuration] = useState<Duration>(excursion?.duration ?? "medio");
  const [difficulty, setDifficulty] = useState<Difficulty>(excursion?.difficulty ?? "facil");
  const [mapUrl, setMapUrl] = useState(excursion?.mapUrl ?? "");
  const [photos, setPhotos] = useState<DraftPhoto[]>(() => (excursion?.photos ?? []).map(draft));
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sin la migración de varias fotos, solo cabe una (la portada).
  const maxPhotos = multiPhoto ? MAX_PHOTOS : 1;
  const save = useSaveExcursion(house.id);
  const remove = useDeleteExcursion();
  const canEdit = !excursion || isAdmin || excursion.createdBy === me.userId;
  const back = excursion ? `/excursiones/${excursion.id}` : "/excursiones";

  /** Sube una o varias fotos (en el orden elegido) y las añade al final. */
  async function onFiles(files: File[]) {
    const room = maxPhotos - photos.length;
    if (room <= 0) return;
    setUploading(true);
    setError(null);
    try {
      for (const file of files.slice(0, room)) {
        const path = await uploadExcursionPhoto(house.id, file);
        setPhotos((list) => [...list, draft({ path, caption: "" })]);
      }
      if (files.length > room)
        setError(`Solo caben ${maxPhotos} fotos; el resto no se ha añadido.`);
    } catch (e) {
      setError(e instanceof ImageError ? e.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
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
      photos: photos.map(({ path, caption }) => ({ path, caption })),
    };
    const parsed = excursionInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      { id: excursion?.id, input, multiPhoto },
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
        <fieldset disabled={!canEdit} className="space-y-5">
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

          <FormSection
            title="Fotos para encontrar el sitio"
            hint={
              multiPhoto
                ? "En orden, con una frase cada una. La primera es la portada."
                : "De momento solo cabe una foto (falta un paso en Supabase para poner más)."
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
                      onRemove={() => setPhotos((list) => list.filter((x) => x.key !== p.key))}
                    />
                  </li>
                ))}
              </ol>
            )}
            {photos.length < maxPhotos && (
              <>
                <label
                  htmlFor={photoInput}
                  className="flex min-h-14 cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-field text-lg font-semibold"
                >
                  {uploading
                    ? "Subiendo…"
                    : photos.length === 0
                      ? "📷 Añadir fotos"
                      : "📷 Añadir más fotos"}
                </label>
                <input
                  id={photoInput}
                  type="file"
                  accept="image/*"
                  multiple={multiPhoto}
                  disabled={uploading}
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
        </fieldset>

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        {canEdit ? (
          <>
            <button type="submit" disabled={save.isPending || uploading} className={buttonPrimary}>
              {save.isPending ? "Guardando…" : excursion ? "Guardar cambios" : "Añadir excursión"}
            </button>
            {excursion && (
              <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
                Borrar la excursión
              </button>
            )}
          </>
        ) : (
          <p className="text-lg text-muted">
            Solo quien la añadió (o quien administra) puede cambiarla.
          </p>
        )}
      </form>
      {dialog}
    </>
  );
}

/** Una foto del formulario: imagen, su frase y botones para ordenarla o quitarla. */
function PhotoEditor({
  photo,
  index,
  total,
  onCaption,
  onMove,
  onRemove,
}: {
  photo: DraftPhoto;
  index: number;
  total: number;
  onCaption: (caption: string) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const url = useExcursionPhotoUrl(photo.path);
  const n = index + 1;
  const small =
    "min-h-12 rounded-xl border-2 border-field px-3 text-lg font-semibold disabled:opacity-40";
  return (
    <Card className="bg-surface-2!">
      {url.data && (
        <img
          src={url.data}
          alt={`Foto ${n}`}
          className="mb-3 aspect-[4/3] w-full rounded-2xl object-cover"
        />
      )}
      <label htmlFor={`exc-photo-${photo.key}`} className={fieldLabel}>
        Foto {n} {n === 1 && <span className="font-normal text-muted">(portada)</span>}
      </label>
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
          aria-label={`Subir la foto ${n}`}
          className={small}
        >
          ↑ Subir
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Bajar la foto ${n}`}
          className={small}
        >
          ↓ Bajar
        </button>
        <button
          type="button"
          onClick={onRemove}
          aria-label={`Quitar la foto ${n}`}
          className={`${small} border-danger text-danger`}
        >
          Quitar
        </button>
      </div>
    </Card>
  );
}
