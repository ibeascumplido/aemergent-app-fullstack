import { useState } from "react";

// Momento (antes/después) + tema (poda, césped...) -> etiqueta de texto que
// sale al pie de la foto en el PDF. Ej.: "Antes · Poda".
const MOMENTOS = ["Antes", "Después"];
const TEMAS_BASE = ["Poda", "Césped", "Riego", "Plantación", "Limpieza", "Plagas"];
const CLAVE_TEMAS = "etiquetas_foto_temas_v1";

const leerTemasPropios = () => {
  try {
    const v = JSON.parse(localStorage.getItem(CLAVE_TEMAS) || "[]");
    return Array.isArray(v) ? v.slice(0, 12) : [];
  } catch {
    return [];
  }
};

export const componerEtiqueta = (momento, tema) => [momento, tema].filter(Boolean).join(" · ");

// Separa una etiqueta ya guardada en momento + tema (para editar).
export const partirEtiqueta = (etiqueta) => {
  if (!etiqueta) return { momento: "", tema: "" };
  const [a, ...resto] = etiqueta.split(" · ");
  if (MOMENTOS.includes(a)) return { momento: a, tema: resto.join(" · ") };
  return { momento: "", tema: etiqueta };
};

const chip = (activo, color) =>
  `px-3 py-1.5 rounded-full text-sm border transition-colors ${
    activo ? `${color} text-white border-transparent` : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
  }`;

const SelectorEtiquetaFoto = ({ value, onChange }) => {
  const { momento, tema } = partirEtiqueta(value);
  const [propios, setPropios] = useState(leerTemasPropios);
  const [otro, setOtro] = useState("");
  const temas = [...TEMAS_BASE, ...propios.filter((t) => !TEMAS_BASE.includes(t))];

  const poner = (m, t) => onChange(componerEtiqueta(m, t));

  const anadirOtro = () => {
    const t = otro.trim().slice(0, 30);
    if (!t) return;
    const nuevos = [t, ...propios.filter((x) => x !== t)].slice(0, 12);
    setPropios(nuevos);
    try { localStorage.setItem(CLAVE_TEMAS, JSON.stringify(nuevos)); } catch { /* ignorar */ }
    setOtro("");
    poner(momento, t);
  };

  return (
    <div className="space-y-3" data-testid="selector-etiqueta-foto">
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">Momento</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={chip(!momento, "bg-slate-700")} onClick={() => poner("", tema)}>Ninguno</button>
          <button type="button" className={chip(momento === "Antes", "bg-amber-500")} onClick={() => poner("Antes", tema)}>Antes</button>
          <button type="button" className={chip(momento === "Después", "bg-emerald-500")} onClick={() => poner("Después", tema)}>Después</button>
        </div>
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-1.5">Tipo de trabajo</p>
        <div className="flex gap-2 flex-wrap">
          <button type="button" className={chip(!tema, "bg-slate-700")} onClick={() => poner(momento, "")}>Ninguno</button>
          {temas.map((t) => (
            <button key={t} type="button" className={chip(tema === t, "bg-indigo-600")} onClick={() => poner(momento, t)}>{t}</button>
          ))}
          {tema && !temas.includes(tema) && (
            <button type="button" className={chip(true, "bg-indigo-600")}>{tema}</button>
          )}
        </div>
        <div className="flex gap-2 mt-2">
          <input
            value={otro}
            onChange={(e) => setOtro(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); anadirOtro(); } }}
            placeholder="Otro tipo (ej. Seto, Fuente...)"
            maxLength={30}
            className="flex-1 border border-slate-200 rounded-lg px-3 py-1.5 text-sm"
          />
          <button type="button" onClick={anadirOtro} className="px-3 py-1.5 rounded-lg text-sm border border-slate-200 bg-white hover:bg-slate-50">
            Añadir
          </button>
        </div>
      </div>
      <p className="text-sm text-slate-600">
        Pie de foto: <strong>{value || "sin etiqueta"}</strong>
      </p>
    </div>
  );
};

export default SelectorEtiquetaFoto;
