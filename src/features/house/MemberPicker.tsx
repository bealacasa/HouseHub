import { Avatar } from "@/components/Avatar";
import { useHouse } from "./HouseGate";

/** Elegir a una persona de la familia tocando su foto (más fácil que un desplegable). */
export function MemberPicker({
  name,
  value,
  onChange,
}: {
  name: string;
  value: string;
  onChange: (id: string) => void;
}) {
  const { members, me } = useHouse();
  return (
    <div className="grid grid-cols-3 gap-2">
      {members.map((m) => (
        <label
          key={m.id}
          className="flex min-h-28 cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-transparent bg-surface-2 p-2 text-center has-checked:border-accent has-checked:bg-accent-soft has-focus-visible:ring-3 has-focus-visible:ring-focus"
        >
          <input
            type="radio"
            name={name}
            value={m.id}
            checked={value === m.id}
            onChange={() => onChange(m.id)}
            className="sr-only"
          />
          <Avatar member={m} members={members} />
          <span className="text-base font-bold leading-tight">
            {m.id === me.id ? "Yo" : m.displayName}
          </span>
        </label>
      ))}
    </div>
  );
}
