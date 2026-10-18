/*
 * Dinero: siempre en CÉNTIMOS enteros. Nada de decimales en los cálculos (0,1 + 0,2 ≠ 0,3).
 * Funciones puras: fáciles de probar a fondo.
 */

export const MAX_CENTS = 10_000_000; // 100.000 €

const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });

/** 1234 → "12,34 €" */
export const formatEuros = (cents: number) => euros.format(cents / 100);

/**
 * Lo que escribe la persona → céntimos. Acepta "12", "12,5", "12,50", "12.50", "1.234,56",
 * "1234,5 €". Devuelve null si no es un importe válido (o es 0 o negativo).
 */
export function parseEuros(raw: string): number | null {
  let s = raw.trim().replace(/€/g, "").replace(/\s/g, "");
  if (s === "") return null;
  // Con coma decimal, los puntos son de miles ("1.234,56"). Sin coma, un punto con 1–2
  // decimales al final es decimal ("12.50"); si no, de miles ("1.234").
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  else if (!/^\d+\.\d{1,2}$/.test(s)) s = s.replace(/\./g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole = "0", fraction = ""] = s.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return cents > 0 && cents <= MAX_CENTS && Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Reparte `total` céntimos a partes iguales entre `ids`. Lo que no se puede dividir (como
 * mucho n−1 céntimos) se da de uno en uno empezando por la posición `seed`: así no le toca
 * siempre a la misma persona. La suma es SIEMPRE exactamente el total.
 */
export function splitEqually(total: number, ids: readonly string[], seed = 0): Map<string, number> {
  const result = new Map<string, number>();
  const n = ids.length;
  if (n === 0) return result;
  const base = Math.floor(total / n);
  const rest = total - base * n;
  const start = ((seed % n) + n) % n;
  ids.forEach((id, i) => {
    const extra = (i - start + n) % n < rest ? 1 : 0;
    result.set(id, base + extra);
  });
  return result;
}

/** Semilla estable para repartir los céntimos sobrantes (a partir de un texto, p. ej. la fecha). */
export function seedFrom(text: string): number {
  let h = 0;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1_000_003;
  return h;
}

export type ExpenseLike = { paidBy: string; amount: number; shares: ReadonlyMap<string, number> };
export type SettlementLike = { from: string; to: string; cents: number };

/**
 * Saldo de cada miembro: lo que pagó − lo que le toca, ajustado con los pagos entre ellos.
 * Positivo = le deben; negativo = debe. La suma de todos los saldos es siempre 0.
 */
export function balances(
  memberIds: readonly string[],
  expenses: readonly ExpenseLike[],
  settlements: readonly SettlementLike[],
): Map<string, number> {
  const b = new Map<string, number>(memberIds.map((id) => [id, 0]));
  const add = (id: string, cents: number) => b.set(id, (b.get(id) ?? 0) + cents);
  for (const e of expenses) {
    add(e.paidBy, e.amount);
    for (const [id, cents] of e.shares) add(id, -cents);
  }
  for (const s of settlements) {
    add(s.from, s.cents); // quien paga reduce lo que debe
    add(s.to, -s.cents); // quien cobra reduce lo que le deben
  }
  return b;
}

export type Transfer = { from: string; to: string; cents: number };

/**
 * «Cómo quedar en paz»: quién paga a quién y cuánto, con pocos pagos (como mucho n−1).
 * Se emparejan siempre el que más debe con el que más tiene que recibir.
 */
export function settleUp(balance: ReadonlyMap<string, number>): Transfer[] {
  const debtors = [...balance].filter(([, c]) => c < 0).map(([id, c]) => ({ id, c: -c }));
  const creditors = [...balance].filter(([, c]) => c > 0).map(([id, c]) => ({ id, c }));
  const byAmount = (a: { id: string; c: number }, b: { id: string; c: number }) =>
    b.c - a.c || a.id.localeCompare(b.id);
  const transfers: Transfer[] = [];
  while (debtors.length > 0 && creditors.length > 0) {
    debtors.sort(byAmount);
    creditors.sort(byAmount);
    const d = debtors[0];
    const c = creditors[0];
    if (!d || !c) break;
    const cents = Math.min(d.c, c.c);
    transfers.push({ from: d.id, to: c.id, cents });
    d.c -= cents;
    c.c -= cents;
    if (d.c === 0) debtors.shift();
    if (c.c === 0) creditors.shift();
  }
  return transfers;
}
