import { useQuery } from "@tanstack/react-query";
import type { Member } from "@/features/house/house";
import { getSupabase } from "@/lib/supabase";

/** Colores fijos por persona (clases, no estilos en línea: lo exige la CSP). Alto contraste. */
const COLORS = [
  {
    solid: "bg-sky-700 text-white",
    soft: "bg-sky-100 text-sky-950 dark:bg-sky-950 dark:text-sky-100",
    ring: "ring-sky-700",
  },
  {
    solid: "bg-emerald-700 text-white",
    soft: "bg-emerald-100 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100",
    ring: "ring-emerald-700",
  },
  {
    solid: "bg-rose-700 text-white",
    soft: "bg-rose-100 text-rose-950 dark:bg-rose-950 dark:text-rose-100",
    ring: "ring-rose-700",
  },
  {
    solid: "bg-violet-700 text-white",
    soft: "bg-violet-100 text-violet-950 dark:bg-violet-950 dark:text-violet-100",
    ring: "ring-violet-700",
  },
  {
    solid: "bg-amber-700 text-white",
    soft: "bg-amber-100 text-amber-950 dark:bg-amber-950 dark:text-amber-100",
    ring: "ring-amber-700",
  },
  {
    solid: "bg-teal-700 text-white",
    soft: "bg-teal-100 text-teal-950 dark:bg-teal-950 dark:text-teal-100",
    ring: "ring-teal-700",
  },
  {
    solid: "bg-orange-700 text-white",
    soft: "bg-orange-100 text-orange-950 dark:bg-orange-950 dark:text-orange-100",
    ring: "ring-orange-700",
  },
  {
    solid: "bg-slate-700 text-white",
    soft: "bg-slate-200 text-slate-950 dark:bg-slate-800 dark:text-slate-100",
    ring: "ring-slate-700",
  },
] as const;

export type MemberColor = (typeof COLORS)[number];

/** Color estable de cada persona (según su orden en la familia). */
export function memberColor(members: readonly Member[], id: string): MemberColor {
  const index = members.findIndex((m) => m.id === id);
  return COLORS[(index < 0 ? 0 : index) % COLORS.length] ?? COLORS[0];
}

/** URL temporal (5 min) de una foto de perfil. */
export function useAvatarUrl(path: string | null) {
  return useQuery({
    queryKey: ["avatar", path],
    enabled: path !== null,
    staleTime: 4 * 60_000,
    queryFn: async () => {
      const { data, error } = await getSupabase()
        .storage.from("avatars")
        .createSignedUrl(path ?? "", 300);
      if (error) throw error;
      return data.signedUrl;
    },
  });
}

const SIZES = {
  sm: "size-10 text-lg",
  md: "size-14 text-2xl",
  lg: "size-24 text-4xl",
} as const;

/** Foto redonda de la persona o, si no tiene, su inicial sobre su color. */
export function Avatar({
  member,
  members,
  size = "md",
}: {
  member: Member;
  members: readonly Member[];
  size?: keyof typeof SIZES;
}) {
  const url = useAvatarUrl(member.avatarPath);
  const color = memberColor(members, member.id);
  if (url.data) {
    return (
      <img
        src={url.data}
        alt=""
        className={`${SIZES[size]} shrink-0 rounded-full object-cover ring-3 ${color.ring}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${SIZES[size]} grid shrink-0 place-items-center rounded-full font-bold ${color.solid}`}
    >
      {member.displayName.trim().charAt(0).toUpperCase() || "?"}
    </span>
  );
}
