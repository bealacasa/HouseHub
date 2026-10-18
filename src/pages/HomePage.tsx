import { Link } from "react-router";
import { Card, PageTitle, buttonSecondary } from "@/components/ui";
import { useMe } from "@/features/auth/RequireAuth";
import { useHouse } from "@/features/house/HouseGate";
import { useHousePhotoUrl } from "@/features/house/photo";
import { InstallCard } from "@/pwa/InstallCard";

/** Inicio. En las próximas fases: «Llego / Me voy», quién está, avisos y saldo. */
export function HomePage() {
  const { profile } = useMe();
  const { house, members, isAdmin } = useHouse();
  const photo = useHousePhotoUrl(house.photoPath);
  const onlyMe = members.length === 1;

  return (
    <>
      <PageTitle title={`Hola, ${profile.displayName}`} />
      <div className="space-y-4">
        {photo.data && (
          <img
            src={photo.data}
            alt={`Foto de ${house.name}`}
            className="aspect-[4/3] w-full rounded-3xl object-cover"
          />
        )}
        {isAdmin && onlyMe && (
          <Card className="border-accent">
            <h2 className="text-2xl font-bold">Invita a la familia</h2>
            <p className="mt-2 text-lg">
              Manda un enlace por WhatsApp a cada persona para que entre en {house.name}.
            </p>
            <Link to="/familia" className={`${buttonSecondary} mt-4`}>
              Invitar a alguien
            </Link>
          </Card>
        )}
        {house.notes && (
          <Card>
            <h2 className="text-2xl font-bold">Notas de la casa</h2>
            <p className="mt-2 whitespace-pre-line text-lg">{house.notes}</p>
          </Card>
        )}
        <Card>
          <p className="text-lg">
            Muy pronto: «Llego a la casa», «Me voy de la casa», calendario, gastos y avisos.
          </p>
        </Card>
        <InstallCard />
      </div>
    </>
  );
}
