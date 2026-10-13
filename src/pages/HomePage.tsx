import { Card, PageTitle } from "@/components/ui";
import { useMe } from "@/features/auth/RequireAuth";
import { InstallCard } from "@/pwa/InstallCard";

/** Inicio. En las próximas fases: «Llego / Me voy», quién está, avisos y saldo. */
export function HomePage() {
  const { profile } = useMe();
  return (
    <>
      <PageTitle title={`Hola, ${profile.displayName}`} />
      <div className="space-y-4">
        <Card>
          <h2 className="text-2xl font-bold">Aún no tienes ninguna casa</h2>
          <p className="mt-2 text-lg">
            Muy pronto podrás crear la primera o entrar en la de tu familia con una invitación.
          </p>
        </Card>
        <InstallCard />
      </div>
    </>
  );
}
