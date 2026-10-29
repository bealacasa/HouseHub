import { Link, useParams } from "react-router";
import { Card, PageTitle, backLink, buttonPrimary, buttonSecondary } from "@/components/ui";
import { useGuides, useStepPhotoUrl, type GuideStep } from "./guides";

/** Ver unas instrucciones: pasos grandes, numerados, con su foto. */
export function GuidePage() {
  const { id } = useParams();
  const guides = useGuides();
  if (guides.isPending) return null;
  const guide = (guides.data ?? []).find((g) => g.id === id);
  if (!guide) {
    return (
      <>
        <PageTitle title="Instrucciones no encontradas" />
        <Link to="/instrucciones" className={buttonPrimary}>
          Volver a las instrucciones
        </Link>
      </>
    );
  }

  return (
    <>
      <Link to="/instrucciones" className={backLink}>
        ← Instrucciones
      </Link>
      <PageTitle title={guide.title} />
      {guide.intro && (
        <Card className="mb-5 bg-accent-soft!">
          <p className="whitespace-pre-line text-xl">{guide.intro}</p>
        </Card>
      )}
      <ol className="space-y-4" aria-label="Pasos">
        {guide.steps.map((step, i) => (
          <li key={`${i}-${step.text}`}>
            <StepCard step={step} number={i + 1} total={guide.steps.length} />
          </li>
        ))}
      </ol>
      <p className="mt-6 text-center text-xl font-bold">✓ ¡Listo!</p>
      {
        <Link to={`/instrucciones/${guide.id}/editar`} className={`${buttonSecondary} mt-6`}>
          Cambiar estas instrucciones
        </Link>
      }
    </>
  );
}

function StepCard({ step, number, total }: { step: GuideStep; number: number; total: number }) {
  const url = useStepPhotoUrl(step.photo);
  return (
    <Card className="overflow-hidden p-0!">
      {url.data && (
        <img
          src={url.data}
          alt={`Foto del paso ${number}`}
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
          <p className="mt-1 whitespace-pre-line text-xl leading-relaxed">{step.text}</p>
        </div>
      </div>
    </Card>
  );
}
