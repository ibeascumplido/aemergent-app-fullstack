import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Shuffle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const ZONA_LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

// Relleno automatico de la rejilla segun unas pautas. No guarda nada hasta
// pulsar "Aplicar": primero genera una propuesta que se ve en pantalla y se
// puede volver a generar. Las pautas se recuerdan por cliente en el navegador.

const PAUTAS_DEFECTO = {
  minPorDia: 1,
  maxPorDia: 3,
  soloLaborables: true,
  noConsecutivo: true,
  modo: "anadir", // "anadir" (respeta lo marcado) | "reemplazar" (borra y rellena)
  usarZonas: true,
  zonasDisponibles: ["A", "B", "C", "D", "E", "F"],
  maxZonasPorCelda: 2,
  tareas: {}, // { tarea_id: { incluida, maxVeces, primeraSemana } }
};

const claveStorage = (slug) => `rejilla-pautas-${slug || "general"}`;

const leerPautas = (slug) => {
  try {
    const raw = window.localStorage.getItem(claveStorage(slug));
    return raw ? { ...PAUTAS_DEFECTO, ...JSON.parse(raw) } : PAUTAS_DEFECTO;
  } catch {
    return PAUTAS_DEFECTO;
  }
};

const guardarPautas = (slug, pautas) => {
  try {
    window.localStorage.setItem(claveStorage(slug), JSON.stringify(pautas));
  } catch {
    /* sin almacenamiento: no pasa nada */
  }
};

const randInt = (min, max) => min + Math.floor(Math.random() * (max - min + 1));

const barajar = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// Elige n elementos distintos segun su peso
const elegirPonderado = (candidatos, n) => {
  const pool = [...candidatos];
  const elegidos = [];
  while (elegidos.length < n && pool.length) {
    const total = pool.reduce((s, c) => s + c.peso, 0);
    let r = Math.random() * total;
    let idx = 0;
    for (; idx < pool.length - 1; idx++) {
      r -= pool[idx].peso;
      if (r <= 0) break;
    }
    elegidos.push(pool[idx].id);
    pool.splice(idx, 1);
  }
  return elegidos;
};

const esFinDeSemana = (iso) => {
  const g = new Date(iso + "T00:00:00").getDay();
  return g === 0 || g === 6;
};

const generarPropuesta = ({ dias, tareas, celdasActuales, pautas }) => {
  const confTarea = (id) => pautas.tareas[id] || { incluida: true, maxVeces: "", primeraSemana: false };
  const tareasIncluidas = tareas.filter((t) => confTarea(t.tarea_id).incluida);
  const primeraSemana = new Set(dias.slice(0, 7));
  const reemplazar = pautas.modo === "reemplazar";

  // Punto de partida: vacio o lo que ya hay marcado
  const resultado = {}; // { tarea_id: { fecha: zonas } }
  const usos = {}; // veces que aparece cada tarea
  if (!reemplazar) {
    Object.entries(celdasActuales).forEach(([tid, porFecha]) => {
      resultado[tid] = { ...porFecha };
      usos[tid] = Object.keys(porFecha).length;
    });
  }

  // Cola de zonas por tarea para repartirlas y no repetir siempre la misma
  const colas = {};
  const sacarZonas = (tid) => {
    if (!pautas.usarZonas || !pautas.zonasDisponibles.length) return ["X"];
    const k = Math.min(randInt(1, pautas.maxZonasPorCelda), pautas.zonasDisponibles.length);
    const out = [];
    while (out.length < k) {
      if (!colas[tid] || !colas[tid].length) colas[tid] = barajar(pautas.zonasDisponibles);
      const z = colas[tid].shift();
      if (!out.includes(z)) out.push(z);
    }
    return out.sort();
  };

  const tieneTarea = (tid, fecha) => Boolean(resultado[tid]?.[fecha]);

  dias.forEach((fecha, i) => {
    if (pautas.soloLaborables && esFinDeSemana(fecha)) return;
    const yaHoy = tareas.filter((t) => tieneTarea(t.tarea_id, fecha)).length;
    const objetivo = randInt(pautas.minPorDia, pautas.maxPorDia);
    const faltan = objetivo - yaHoy;
    if (faltan <= 0) return;
    const ayer = i > 0 ? dias[i - 1] : null;

    const candidatos = tareasIncluidas
      .filter((t) => {
        const c = confTarea(t.tarea_id);
        const max = Number(c.maxVeces);
        if (max > 0 && (usos[t.tarea_id] || 0) >= max) return false;
        if (tieneTarea(t.tarea_id, fecha)) return false;
        // Las tareas de "1ª semana" pueden repetirse seguidas dentro de esa semana
        const intensiva = c.primeraSemana && primeraSemana.has(fecha);
        if (pautas.noConsecutivo && !intensiva && ayer && tieneTarea(t.tarea_id, ayer)) return false;
        return true;
      })
      .map((t) => {
        const c = confTarea(t.tarea_id);
        let peso = 1 / (1 + (usos[t.tarea_id] || 0)); // reparte: lo menos usado pesa mas
        if (c.primeraSemana) peso = primeraSemana.has(fecha) ? 10 : peso * 0.5;
        return { id: t.tarea_id, peso };
      });

    elegirPonderado(candidatos, faltan).forEach((tid) => {
      if (!resultado[tid]) resultado[tid] = {};
      resultado[tid][fecha] = sacarZonas(tid);
      usos[tid] = (usos[tid] || 0) + 1;
    });
  });

  return resultado;
};

const igualZonas = (a, b) => (a || []).join(",") === (b || []).join(",");

const RejillaRellenoAleatorio = ({ workOrderId, clientSlug, dias, tareas, celdas, onAplicado }) => {
  const [open, setOpen] = useState(false);
  const [pautas, setPautas] = useState(() => leerPautas(clientSlug));
  const [propuesta, setPropuesta] = useState(null);
  const [aplicando, setAplicando] = useState(false);
  const [progreso, setProgreso] = useState(0);

  useEffect(() => {
    setPautas(leerPautas(clientSlug));
  }, [clientSlug]);

  const actualizar = (cambios) => {
    setPautas((prev) => {
      const nuevas = { ...prev, ...cambios };
      guardarPautas(clientSlug, nuevas);
      return nuevas;
    });
    setPropuesta(null);
  };

  const confTarea = (id) => pautas.tareas[id] || { incluida: true, maxVeces: "", primeraSemana: false };
  const actualizarTarea = (id, cambios) =>
    actualizar({ tareas: { ...pautas.tareas, [id]: { ...confTarea(id), ...cambios } } });

  const toggleZona = (z) => {
    const set = new Set(pautas.zonasDisponibles);
    if (set.has(z)) set.delete(z);
    else set.add(z);
    actualizar({ zonasDisponibles: ZONA_LETRAS.filter((l) => set.has(l)) });
  };

  const generar = () => {
    if (pautas.minPorDia > pautas.maxPorDia) {
      toast.error("El mínimo de tareas por día no puede ser mayor que el máximo");
      return;
    }
    if (!tareas.some((t) => confTarea(t.tarea_id).incluida)) {
      toast.error("Marca al menos una tarea");
      return;
    }
    if (pautas.usarZonas && !pautas.zonasDisponibles.length) {
      toast.error("Elige al menos una zona o desactiva las zonas");
      return;
    }
    setPropuesta(generarPropuesta({ dias, tareas, celdasActuales: celdas, pautas }));
  };

  // Cambios reales respecto a la rejilla actual
  const operaciones = useMemo(() => {
    if (!propuesta) return [];
    const ops = [];
    tareas.forEach((t) => {
      const nuevo = propuesta[t.tarea_id] || {};
      const actual = celdas[t.tarea_id] || {};
      dias.forEach((fecha) => {
        if (!igualZonas(nuevo[fecha], actual[fecha])) {
          ops.push({ tarea_id: t.tarea_id, fecha, zonas: nuevo[fecha] || null });
        }
      });
    });
    return ops;
  }, [propuesta, celdas, tareas, dias]);

  const resumen = useMemo(() => {
    if (!propuesta) return [];
    return tareas
      .map((t) => ({ nombre: t.tarea_nombre, veces: Object.keys(propuesta[t.tarea_id] || {}).length }))
      .filter((r) => r.veces > 0);
  }, [propuesta, tareas]);

  const aplicar = async () => {
    if (!operaciones.length) {
      toast.info("No hay cambios que aplicar");
      return;
    }
    setAplicando(true);
    setProgreso(0);
    let fallos = 0;
    let hechas = 0;
    const LOTE = 4;
    for (let i = 0; i < operaciones.length; i += LOTE) {
      const lote = operaciones.slice(i, i + LOTE);
      const res = await Promise.allSettled(
        lote.map((op) => axios.put(`${API}/work-orders/${workOrderId}/rejilla-zonas/celda`, op))
      );
      fallos += res.filter((r) => r.status === "rejected").length;
      hechas += lote.length;
      setProgreso(Math.round((hechas / operaciones.length) * 100));
    }
    setAplicando(false);
    if (fallos) toast.error(`${fallos} casillas no se pudieron guardar; revisa la rejilla`);
    else toast.success("Rejilla rellenada. Revísala antes de cerrar el parte.");
    setOpen(false);
    setPropuesta(null);
    onAplicado?.();
  };

  const numInput = "w-16 h-8 rounded-md border border-slate-200 px-2 text-sm";

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => {
          setPropuesta(null);
          setOpen(true);
        }}
        className="border-slate-200"
        data-testid="relleno-aleatorio-btn"
      >
        <Shuffle className="w-4 h-4 mr-2" />
        Relleno automático
      </Button>

      <Dialog open={open} onOpenChange={(v) => !aplicando && setOpen(v)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Relleno automático de la rejilla</DialogTitle>
          </DialogHeader>

          {/* Pautas generales */}
          <div className="grid sm:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <p className="font-medium text-slate-700">Tareas por día</p>
              <div className="flex items-center gap-2">
                <span className="text-slate-500">Mínimo</span>
                <input
                  type="number" min={0} max={10} className={numInput}
                  value={pautas.minPorDia}
                  onChange={(e) => actualizar({ minPorDia: Math.max(0, Number(e.target.value) || 0) })}
                />
                <span className="text-slate-500">Máximo</span>
                <input
                  type="number" min={1} max={10} className={numInput}
                  value={pautas.maxPorDia}
                  onChange={(e) => actualizar({ maxPorDia: Math.max(1, Number(e.target.value) || 1) })}
                />
              </div>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pautas.soloLaborables}
                  onChange={(e) => actualizar({ soloLaborables: e.target.checked })} />
                Solo días laborables (sin sábados ni domingos)
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={pautas.noConsecutivo}
                  onChange={(e) => actualizar({ noConsecutivo: e.target.checked })} />
                No repetir la misma tarea en días seguidos
              </label>
              <div className="flex flex-col gap-1 pt-1">
                <label className="flex items-center gap-2">
                  <input type="radio" name="modo" checked={pautas.modo === "anadir"}
                    onChange={() => actualizar({ modo: "anadir" })} />
                  Respetar lo ya marcado y completar
                </label>
                <label className="flex items-center gap-2">
                  <input type="radio" name="modo" checked={pautas.modo === "reemplazar"}
                    onChange={() => actualizar({ modo: "reemplazar" })} />
                  <span>Borrar la rejilla y rellenar de cero</span>
                </label>
              </div>
            </div>

            <div className="space-y-2">
              <label className="flex items-center gap-2 font-medium text-slate-700">
                <input type="checkbox" checked={pautas.usarZonas}
                  onChange={(e) => actualizar({ usarZonas: e.target.checked })} />
                Poner zonas (si no, se marca "X")
              </label>
              {pautas.usarZonas && (
                <>
                  <p className="text-xs text-slate-500">Zonas que existen en este centro:</p>
                  <div className="flex flex-wrap gap-1">
                    {ZONA_LETRAS.map((z) => (
                      <button
                        type="button" key={z} onClick={() => toggleZona(z)}
                        className={`w-8 h-8 rounded text-xs font-medium ${
                          pautas.zonasDisponibles.includes(z)
                            ? "bg-indigo-600 text-white"
                            : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {z}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">Máx. zonas por casilla</span>
                    <select
                      className="h-8 rounded-md border border-slate-200 px-2"
                      value={pautas.maxZonasPorCelda}
                      onChange={(e) => actualizar({ maxZonasPorCelda: Number(e.target.value) })}
                    >
                      <option value={1}>1</option>
                      <option value={2}>2</option>
                      <option value={3}>3</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Pautas por tarea */}
          <div className="mt-4">
            <p className="font-medium text-slate-700 text-sm mb-1">Tareas</p>
            <p className="text-xs text-slate-400 mb-2">
              "Máx. veces" = 1 para no repetirla en todo el periodo (ej. fumigación). Vacío = sin límite.
              "1ª semana" = se concentra sobre todo en los primeros 7 días (ej. desbroce).
            </p>
            <div className="border border-slate-100 rounded-lg divide-y divide-slate-100 max-h-64 overflow-y-auto">
              {tareas.map((t) => {
                const c = confTarea(t.tarea_id);
                return (
                  <div key={t.tarea_id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                    <label className="flex items-center gap-2 flex-1 min-w-0">
                      <input type="checkbox" checked={c.incluida}
                        onChange={(e) => actualizarTarea(t.tarea_id, { incluida: e.target.checked })} />
                      <span className={`truncate ${c.incluida ? "text-slate-700" : "text-slate-400"}`}>
                        {t.tarea_nombre}
                      </span>
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                      Máx. veces
                      <input
                        type="number" min={0} className="w-14 h-7 rounded border border-slate-200 px-1"
                        disabled={!c.incluida}
                        value={c.maxVeces}
                        onChange={(e) => actualizarTarea(t.tarea_id, { maxVeces: e.target.value })}
                      />
                    </label>
                    <label className="flex items-center gap-1 text-xs text-slate-500 shrink-0">
                      <input type="checkbox" disabled={!c.incluida} checked={c.primeraSemana}
                        onChange={(e) => actualizarTarea(t.tarea_id, { primeraSemana: e.target.checked })} />
                      1ª semana
                    </label>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-2 mt-4">
            <Button onClick={generar} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {propuesta ? <RefreshCw className="w-4 h-4 mr-2" /> : <Shuffle className="w-4 h-4 mr-2" />}
              {propuesta ? "Generar otra" : "Generar propuesta"}
            </Button>
            {propuesta && (
              <Button onClick={aplicar} disabled={aplicando} variant="outline">
                {aplicando ? `Aplicando... ${progreso}%` : `Aplicar (${operaciones.length} cambios)`}
              </Button>
            )}
          </div>

          {/* Vista previa */}
          {propuesta && (
            <div className="mt-4">
              <p className="text-xs text-slate-500 mb-2">
                {resumen.map((r) => `${r.nombre}: ${r.veces}`).join(" · ") || "Sin tareas"}
              </p>
              <div className="border border-slate-200 rounded-lg overflow-auto">
                <table className="border-collapse text-[10px] min-w-max">
                  <thead>
                    <tr>
                      <th className="sticky left-0 bg-slate-50 px-2 py-1 text-left font-medium text-slate-600 min-w-[160px]">
                        Tarea
                      </th>
                      {dias.map((f) => (
                        <th key={f}
                          className={`px-0.5 py-1 w-9 font-medium text-slate-500 ${esFinDeSemana(f) ? "bg-slate-200" : "bg-slate-50"}`}>
                          {Number(f.slice(8))}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tareas
                      .filter((t) => propuesta[t.tarea_id] && Object.keys(propuesta[t.tarea_id]).length)
                      .map((t) => (
                        <tr key={t.tarea_id} className="odd:bg-white even:bg-slate-50/50">
                          <td className="sticky left-0 bg-inherit px-2 py-0.5 text-slate-700 truncate max-w-[160px]">
                            {t.tarea_nombre}
                          </td>
                          {dias.map((f) => {
                            const z = propuesta[t.tarea_id]?.[f];
                            const yaEstaba = z && igualZonas(z, celdas[t.tarea_id]?.[f]);
                            return (
                              <td key={f}
                                className={`text-center border-l border-slate-100 ${
                                  z ? (yaEstaba ? "text-slate-400" : "text-indigo-700 font-semibold") : "text-slate-200"
                                }`}>
                                {z ? z.join(",") : "·"}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[11px] text-slate-400 mt-2">
                En azul lo nuevo; en gris lo que ya estaba. Nada se guarda hasta pulsar "Aplicar".
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RejillaRellenoAleatorio;
