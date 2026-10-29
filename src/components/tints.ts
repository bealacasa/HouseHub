/*
 * Colores de cada sección, agrupados por pestaña para que la app no parezca un arcoíris:
 *  · Calendario: azul cielo · Gastos: violeta
 *  · Casa: tonos cálidos (naranja, ámbar, amarillo, rosa, rojo, piedra)
 *  · Pueblo: verdes (esmeralda y turquesa) · Ajustes: gris pizarra
 * Clases fijas (no estilos en línea: la CSP no los permite). Texto oscuro sobre fondo
 * claro (y al revés en modo oscuro) para mantener el contraste alto.
 */
export const TINTS = {
  calendar: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
  expenses: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
  // Casa
  leave: "bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
  guides: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  notes: "bg-yellow-100 text-yellow-900 dark:bg-yellow-950 dark:text-yellow-200",
  reminders: "bg-rose-100 text-rose-900 dark:bg-rose-950 dark:text-rose-200",
  contacts: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
  houseData: "bg-stone-200 text-stone-800 dark:bg-stone-800 dark:text-stone-100",
  // Pueblo
  events: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  excursions: "bg-teal-100 text-teal-800 dark:bg-teal-950 dark:text-teal-200",
  // Ajustes
  settings: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-100",
} as const;
