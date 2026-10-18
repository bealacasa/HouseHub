import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useId } from "react";
import { Avatar } from "@/components/Avatar";
import { ErrorMessage } from "@/components/ui";
import { ImageError, processImage } from "@/lib/image";
import { getSupabase } from "@/lib/supabase";
import { errorMessage, houseKey, type Member } from "./house";

/** Sube la foto (reducida a 512 px y sin datos ocultos) y la asigna al miembro. */
function useSetAvatar(houseId: string, member: Member) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (file: File | null) => {
      const supabase = getSupabase();
      let path: string | null = null;
      if (file) {
        const blob = await processImage(file, 512);
        path = `${houseId}/${crypto.randomUUID()}.${blob.type === "image/webp" ? "webp" : "jpg"}`;
        const { error } = await supabase.storage
          .from("avatars")
          .upload(path, blob, { contentType: blob.type, upsert: false });
        if (error) throw error;
      }
      const { error } = await supabase.rpc("set_member_avatar", {
        p_member: member.id,
        p_path: path,
      });
      if (error) throw error;
      // La foto anterior ya no se usa: se borra (si no se puede, no pasa nada).
      if (member.avatarPath) await supabase.storage.from("avatars").remove([member.avatarPath]);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: houseKey }),
  });
}

/** Foto de perfil con botones grandes para ponerla, cambiarla o quitarla. */
export function AvatarPicker({
  houseId,
  member,
  members,
}: {
  houseId: string;
  member: Member;
  members: readonly Member[];
}) {
  const setAvatar = useSetAvatar(houseId, member);
  const inputId = useId();
  const error =
    setAvatar.error instanceof ImageError
      ? setAvatar.error.message
      : setAvatar.error
        ? errorMessage(setAvatar.error)
        : null;

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar member={member} members={members} size="lg" />
      <div className="flex flex-wrap justify-center gap-2">
        <label
          htmlFor={inputId}
          className="inline-flex min-h-12 cursor-pointer items-center rounded-full bg-accent-soft px-5 text-lg font-semibold text-accent"
        >
          {setAvatar.isPending ? "Subiendo…" : member.avatarPath ? "Cambiar foto" : "Poner foto"}
        </label>
        <input
          id={inputId}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) setAvatar.mutate(file);
            e.target.value = "";
          }}
        />
        {member.avatarPath && (
          <button
            type="button"
            onClick={() => setAvatar.mutate(null)}
            className="min-h-12 rounded-full px-4 text-lg font-semibold text-danger underline"
          >
            Quitar
          </button>
        )}
      </div>
      {error && <ErrorMessage>{error}</ErrorMessage>}
    </div>
  );
}
