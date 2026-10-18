import { useId, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useConfirm } from "@/components/ConfirmDialog";
import {
  Card,
  ErrorMessage,
  PageTitle,
  backLink,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  inputClass,
} from "@/components/ui";
import { PrivacyHint } from "@/components/form";
import { useHouse } from "@/features/house/HouseGate";
import { errorMessage } from "@/features/house/house";
import { ImageError } from "@/lib/image";
import {
  guideInputSchema,
  moveStep,
  uploadStepPhoto,
  useDeleteGuide,
  useGuides,
  useSaveGuide,
  useStepPhotoUrl,
  type Guide,
  type GuideStep,
} from "./guides";

/** Escribir (/instrucciones/nueva) o cambiar (/instrucciones/:id/editar) unas instrucciones. */
export function GuideFormPage() {
  const { id } = useParams();
  const guides = useGuides();
  if (guides.isPending) return null;
  const guide = id ? (guides.data ?? []).find((g) => g.id === id) : undefined;
  if (id && !guide) {
    return (
      <>
        <PageTitle title="Instrucciones no encontradas" />
        <Link to="/instrucciones" className={buttonPrimary}>
          Volver a las instrucciones
        </Link>
      </>
    );
  }
  return <GuideForm key={id ?? "nueva"} guide={guide} />;
}

/** Cada paso con una clave estable para que React no mezcle los campos al reordenar. */
type DraftStep = GuideStep & { key: string };
const newStep = (text = "", photo: string | null = null): DraftStep => ({
  key: crypto.randomUUID(),
  text,
  photo,
});

function GuideForm({ guide }: { guide?: Guide }) {
  const { house } = useHouse();
  const navigate = useNavigate();
  const [dialog, confirm] = useConfirm();
  const [title, setTitle] = useState(guide?.title ?? "");
  const [intro, setIntro] = useState(guide?.intro ?? "");
  const [steps, setSteps] = useState<DraftStep[]>(() =>
    guide ? guide.steps.map((s) => newStep(s.text, s.photo)) : [newStep()],
  );
  const [error, setError] = useState<string | null>(null);
  const save = useSaveGuide(house.id);
  const remove = useDeleteGuide();

  const update = (key: string, changes: Partial<GuideStep>) =>
    setSteps((list) => list.map((s) => (s.key === key ? { ...s, ...changes } : s)));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const input = { title, intro, steps: steps.map(({ text, photo }) => ({ text, photo })) };
    const parsed = guideInputSchema.safeParse(input);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Revisa los datos.");
      return;
    }
    setError(null);
    save.mutate(
      { id: guide?.id, input },
      { onSuccess: (id) => navigate(`/instrucciones/${id}`, { replace: true }) },
    );
  }

  async function onDelete() {
    if (!guide) return;
    const ok = await confirm({
      title: "¿Borrar estas instrucciones?",
      message: guide.title,
      confirmLabel: "Sí, borrar",
    });
    if (ok)
      remove.mutate(guide, { onSuccess: () => navigate("/instrucciones", { replace: true }) });
  }

  async function onRemoveStep(step: DraftStep, index: number) {
    if (step.text.trim() || step.photo) {
      const ok = await confirm({
        title: `¿Quitar el paso ${index + 1}?`,
        message: step.text || "Este paso tiene una foto.",
        confirmLabel: "Sí, quitar",
      });
      if (!ok) return;
    }
    setSteps((list) => list.filter((s) => s.key !== step.key));
  }

  return (
    <>
      <Link to={guide ? `/instrucciones/${guide.id}` : "/instrucciones"} className={backLink}>
        ← Volver sin guardar
      </Link>
      <PageTitle title={guide ? "Cambiar instrucciones" : "Nuevas instrucciones"} />
      <form noValidate onSubmit={onSubmit} className="space-y-5">
        <div>
          <label htmlFor="g-title" className="mb-2 block text-xl font-semibold">
            ¿De qué son?
          </label>
          <input
            id="g-title"
            maxLength={80}
            placeholder="Por ejemplo: Cómo encender la caldera"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="g-intro" className="mb-2 block text-xl font-semibold">
            Explicación breve (opcional)
          </label>
          <textarea
            id="g-intro"
            rows={2}
            maxLength={500}
            aria-describedby="g-intro-hint"
            value={intro}
            onChange={(e) => setIntro(e.target.value)}
            className={`${inputClass} py-3`}
          />
          <PrivacyHint id="g-intro-hint" />
        </div>

        <h2 className="pt-2 text-2xl font-bold">Pasos</h2>
        <ol className="space-y-4">
          {steps.map((step, i) => (
            <li key={step.key}>
              <StepEditor
                houseId={house.id}
                step={step}
                index={i}
                total={steps.length}
                onChange={(changes) => update(step.key, changes)}
                onMove={(delta) => setSteps((list) => moveStep(list, i, delta))}
                onRemove={() => void onRemoveStep(step, i)}
              />
            </li>
          ))}
        </ol>
        {steps.length < 30 && (
          <button
            type="button"
            onClick={() => setSteps((list) => [...list, newStep()])}
            className={buttonSecondary}
          >
            + Añadir otro paso
          </button>
        )}

        {(error || save.error || remove.error) && (
          <ErrorMessage>{error ?? errorMessage(save.error ?? remove.error)}</ErrorMessage>
        )}
        <button type="submit" disabled={save.isPending} className={buttonPrimary}>
          {save.isPending ? "Guardando…" : "Guardar instrucciones"}
        </button>
        {guide && (
          <button type="button" onClick={() => void onDelete()} className={buttonDanger}>
            Borrar estas instrucciones
          </button>
        )}
      </form>
      {dialog}
    </>
  );
}

function StepEditor({
  houseId,
  step,
  index,
  total,
  onChange,
  onMove,
  onRemove,
}: {
  houseId: string;
  step: DraftStep;
  index: number;
  total: number;
  onChange: (changes: Partial<GuideStep>) => void;
  onMove: (delta: -1 | 1) => void;
  onRemove: () => void;
}) {
  const photoUrl = useStepPhotoUrl(step.photo);
  const inputId = useId();
  const [uploading, setUploading] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const n = index + 1;
  const small =
    "min-h-12 rounded-xl border-2 border-field px-3 text-lg font-semibold disabled:opacity-40";

  async function onFile(file: File) {
    setUploading(true);
    setPhotoError(null);
    try {
      onChange({ photo: await uploadStepPhoto(houseId, file) });
    } catch (e) {
      setPhotoError(e instanceof ImageError ? e.message : "No se pudo subir la foto.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <Card>
      <div className="mb-3 flex items-center gap-3">
        <span
          aria-hidden="true"
          className="grid size-10 shrink-0 place-items-center rounded-full bg-linear-to-br from-accent to-accent-2 text-xl font-extrabold text-accent-contrast"
        >
          {n}
        </span>
        <label htmlFor={`step-${step.key}`} className="text-xl font-semibold">
          Paso {n}
        </label>
      </div>
      <textarea
        id={`step-${step.key}`}
        rows={3}
        maxLength={500}
        placeholder={n === 1 ? "Por ejemplo: Abre la llave del gas (la amarilla)." : ""}
        value={step.text}
        onChange={(e) => onChange({ text: e.target.value })}
        className={`${inputClass} py-3`}
      />
      {photoUrl.data && (
        <img
          src={photoUrl.data}
          alt={`Foto del paso ${n}`}
          className="mt-3 aspect-[4/3] w-full rounded-2xl object-cover"
        />
      )}
      <div className="mt-3 flex flex-wrap gap-2">
        <label htmlFor={inputId} className={`${small} inline-flex cursor-pointer items-center`}>
          {uploading ? "Subiendo…" : step.photo ? "📷 Cambiar foto" : "📷 Añadir foto"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void onFile(file);
            e.target.value = "";
          }}
        />
        {step.photo && (
          <button type="button" onClick={() => onChange({ photo: null })} className={small}>
            Quitar foto
          </button>
        )}
        <button
          type="button"
          onClick={() => onMove(-1)}
          disabled={index === 0}
          aria-label={`Subir el paso ${n}`}
          className={small}
        >
          ↑ Subir
        </button>
        <button
          type="button"
          onClick={() => onMove(1)}
          disabled={index === total - 1}
          aria-label={`Bajar el paso ${n}`}
          className={small}
        >
          ↓ Bajar
        </button>
        {total > 1 && (
          <button type="button" onClick={onRemove} className={`${small} border-danger text-danger`}>
            Quitar paso
          </button>
        )}
      </div>
      {photoError && (
        <div className="mt-3">
          <ErrorMessage>{photoError}</ErrorMessage>
        </div>
      )}
    </Card>
  );
}
