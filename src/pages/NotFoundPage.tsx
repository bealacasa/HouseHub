import { Link } from "react-router";
import { PageTitle, buttonPrimary } from "@/components/ui";

export function NotFoundPage() {
  return (
    <>
      <PageTitle title="No encontramos esta página" />
      <Link to="/" className={buttonPrimary}>
        Ir al inicio
      </Link>
    </>
  );
}
