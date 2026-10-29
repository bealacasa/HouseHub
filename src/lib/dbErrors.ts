/**
 * ¿Falta una migración en Supabase? PostgREST: tabla (PGRST205) o función (PGRST202)
 * que no existe; Postgres: 42P01. Con esto cada sección enseña «Muy pronto» en vez de
 * un error mientras no se ejecute su SQL.
 */
export function isMissingInDatabase(error: unknown): boolean {
  const code = (error as { code?: unknown } | null)?.code;
  return code === "PGRST205" || code === "PGRST202" || code === "42P01";
}
