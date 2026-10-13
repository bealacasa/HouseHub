import { Card, PageTitle } from "@/components/ui";

/** Secciones que llegan en las próximas fases. */
export function ComingSoonPage({ title, text }: { title: string; text: string }) {
  return (
    <>
      <PageTitle title={title} />
      <Card>
        <p className="text-xl">{text}</p>
      </Card>
    </>
  );
}
