import { Link } from "react-router";
import { ListIcon } from "@/components/icons";
import { ErrorMessage, PageTitle, backLink, buttonPrimary, cardShadow } from "@/components/ui";
import { useGuides, useStepPhotoUrl, type Guide } from "./guides";

/** Instrucciones de la casa: cómo usar la placa, la caldera, la alarma del agua… */
export function GuidesPage() {
  const guides = useGuides();
  const all = guides.data ?? [];
  return (
    <>
      <Link to="/casa" className={backLink}>
        ← Casa
      </Link>
      <PageTitle title="Instrucciones" subtitle="Cómo funcionan las cosas de la casa." />
      <Link to="/instrucciones/nueva" className={`${buttonPrimary} mb-6`}>
        <span aria-hidden="true" className="text-2xl leading-none">
          +
        </span>
        Escribir unas instrucciones
      </Link>
      {guides.isError && <ErrorMessage>No se han podido cargar las instrucciones.</ErrorMessage>}
      {guides.isSuccess && all.length === 0 && (
        <p className="rounded-3xl border-2 border-dashed border-border p-5 text-center text-lg text-muted">
          Aún no hay instrucciones. Por ejemplo: «Cómo encender la caldera».
        </p>
      )}
      <ul className="space-y-3">
        {all.map((g) => (
          <li key={g.id}>
            <GuideCard guide={g} />
          </li>
        ))}
      </ul>
    </>
  );
}

function GuideCard({ guide }: { guide: Guide }) {
  const cover = guide.steps.find((s) => s.photo)?.photo ?? null;
  const url = useStepPhotoUrl(cover);
  return (
    <Link
      to={`/instrucciones/${guide.id}`}
      className={`flex min-h-24 items-center gap-4 rounded-3xl border border-border/70 bg-surface p-4 active:scale-[0.99] ${cardShadow}`}
    >
      {url.data ? (
        <img src={url.data} alt="" className="size-16 shrink-0 rounded-2xl object-cover" />
      ) : (
        <span
          aria-hidden="true"
          className="grid size-16 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent"
        >
          <ListIcon />
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-xl font-bold">{guide.title}</span>
        <span className="block text-lg text-muted">
          {guide.steps.length} {guide.steps.length === 1 ? "paso" : "pasos"}
        </span>
      </span>
      <span aria-hidden="true" className="text-3xl text-muted">
        ›
      </span>
    </Link>
  );
}
