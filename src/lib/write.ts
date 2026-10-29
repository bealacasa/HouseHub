/*
 * Al cambiar o borrar, la seguridad de la base de datos (RLS) no da error si no tienes
 * permiso: simplemente no toca ninguna fila. Por eso se pide la fila cambiada
 * (.select("id")) y, si no vuelve ninguna, se avisa en vez de fingir que se guardó.
 */
export class NothingChangedError extends Error {
  constructor() {
    super(
      "No se ha podido guardar el cambio. Puede que falte un paso en Supabase: avisa a quien administra la casa.",
    );
  }
}

export function expectChanged(result: { data: unknown[] | null; error: unknown }): void {
  if (result.error) throw result.error;
  if (!result.data || result.data.length === 0) throw new NothingChangedError();
}
