/** Etiqueta «Portada» sobre la foto, para distinguirla de los pasos. */
export function CoverBadge() {
  return (
    <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-base font-bold text-accent-contrast shadow-md">
      <span aria-hidden="true">⭐ </span>Portada
    </span>
  );
}
