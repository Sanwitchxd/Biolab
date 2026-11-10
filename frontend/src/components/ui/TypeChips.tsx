import { STUDY_TYPES, type StudyType } from "../../utils/validation";

export type TypeFilter = "Todos" | StudyType;

/** Botones para filtrar estudios por tipo (Sangre, Orina, Heces, Otros, Externo) con su cantidad. */
export default function TypeChips({ value, onChange, counts }: { value: TypeFilter; onChange: (v: TypeFilter) => void; counts: Record<TypeFilter, number> }) {
  const items: TypeFilter[] = ["Todos", ...STUDY_TYPES];
  return (
    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por tipo de estudio">
      {items.map((t) => (
        <button
          key={t} type="button" onClick={() => onChange(t)} aria-pressed={value === t}
          className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${value === t ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:text-blue-600"}`}
        >
          {t} <span className={value === t ? "text-blue-100" : "text-slate-400"}>{counts[t]}</span>
        </button>
      ))}
    </div>
  );
}

export const countByType = <T,>(items: T[], typeOf: (x: T) => StudyType): Record<TypeFilter, number> => {
  const c: Record<TypeFilter, number> = { Todos: items.length, Sangre: 0, Orina: 0, Heces: 0, Otros: 0, Externo: 0 };
  items.forEach((i) => { c[typeOf(i)] += 1; });
  return c;
};
