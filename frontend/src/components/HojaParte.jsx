import { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { X, Plus, Settings2, FileDown, PenLine } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import SignaturePad from "@/components/SignaturePad";
import BotonDictado from "@/components/BotonDictado";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const aMin = (h) => {
  const m = /^(\d{2}):(\d{2})$/.exec(h || "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : null;
};
const totalHoras = (ini, fin) => {
  const a = aMin(ini), b = aMin(fin);
  if (a == null || b == null || b <= a) return "";
  const m = b - a;
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, "0")} h`;
};
const fechaLarga = (iso) => {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "long", year: "numeric" });
  } catch { return iso; }
};

const Caja = ({ titulo, children, extra }) => (
  <div className="border border-slate-400 rounded-sm">
    <div className="flex items-center justify-center bg-slate-50 border-b border-slate-400 px-2 py-1 relative">
      <p className="font-serif font-bold text-sm tracking-wide">{titulo}</p>
      {extra && <div className="absolute right-1">{extra}</div>}
    </div>
    <div className="p-2">{children}</div>
  </div>
);

const Campo = ({ etiqueta, children, className = "" }) => (
  <label className={`flex items-center gap-2 text-xs text-slate-600 ${className}`}>
    <span className="shrink-0">{etiqueta}</span>
    {children}
  </label>
);
const entrada = "border border-slate-400 rounded-sm px-2 py-1 text-sm text-slate-900 bg-white w-full min-w-0 focus:outline-none focus:ring-1 focus:ring-slate-500";

/**
 * Hoja de parte: pantalla con el mismo formato que el PDF en papel.
 * Todo lo que se cambia aqui se guarda solo en la sesion (o en el parte,
 * para nº de pedido y domicilio).
 */
const HojaParte = ({
  open, onOpenChange, parte, cliente, centro, sesionId,
  tareasCatalogo, operariosCatalogo, onRefrescar, onAjustes, onFirmaCliente, onPdf, pdfGenerando,
}) => {
  const sesion = useMemo(() => (parte?.sessions || []).find((s) => s.id === sesionId), [parte, sesionId]);
  const [f, setF] = useState(null);
  const [nuevaTarea, setNuevaTarea] = useState("");
  const [pedido, setPedido] = useState("");
  const [domicilio, setDomicilio] = useState("");
  const [clienteH, setClienteH] = useState("");
  const [presupH, setPresupH] = useState("");
  const sembrado = useRef(null);
  const temporizador = useRef({});

  // Se siembra el estado local una vez por sesion abierta; las recargas del
  // parte no pisan lo que el operario esta escribiendo.
  useEffect(() => {
    if (!open || !sesion) return;
    if (sembrado.current === sesion.id) return;
    sembrado.current = sesion.id;
    setF({
      fecha: sesion.fecha, hora_inicio: sesion.hora_inicio, hora_fin: sesion.hora_fin,
      horas_desplazamiento: sesion.horas_desplazamiento || "", materiales: sesion.materiales || "",
      notas: sesion.notas || "",
      personal_texto: sesion.personal_texto || "",
      num_operarios_texto: sesion.num_operarios_texto || "",
      total_horas_texto: sesion.total_horas_texto || "",
    });
    setPedido(parte.numero_pedido || "");
    setDomicilio(parte.domicilio || centro?.direccion || "");
    setClienteH(parte.cliente_hoja || "");
    setPresupH(parte.presupuesto_hoja || "");
  }, [open, sesion, parte, centro]);
  useEffect(() => { if (!open) sembrado.current = null; }, [open]);

  const patchSesion = async (campos) => {
    try {
      await axios.patch(`${API}/work-orders/${parte.id}/sessions/${sesion.id}`, campos);
      onRefrescar && onRefrescar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo guardar el cambio");
    }
  };
  // Guarda con un pequeño retraso para campos de texto.
  const cambia = (campo, valor, inmediato = false) => {
    setF((p) => ({ ...p, [campo]: valor }));
    clearTimeout(temporizador.current[campo]);
    if (inmediato) return patchSesion({ [campo]: valor });
    temporizador.current[campo] = setTimeout(() => patchSesion({ [campo]: valor }), 700);
  };
  const patchParte = async (campos) => {
    try {
      await axios.patch(`${API}/work-orders/${parte.id}`, campos);
      onRefrescar && onRefrescar();
    } catch (e) {
      toast.error(e.response?.data?.detail || "No se pudo guardar el cambio");
    }
  };

  const catalogoPorId = useMemo(() => Object.fromEntries((tareasCatalogo || []).map((t) => [t.id, t.nombre])), [tareasCatalogo]);
  const operariosPorId = useMemo(() => Object.fromEntries((operariosCatalogo || []).map((o) => [o.user_id, o.name])), [operariosCatalogo]);

  if (!sesion || !f) return null;

  const tareas = [
    ...(sesion.tareas_ids || []).map((id) => ({ clave: `id:${id}`, id, nombre: catalogoPorId[id] || "Tarea" })),
    ...(sesion.tareas_libres || []).map((t, i) => ({ clave: `libre:${i}`, libre: i, nombre: t })),
  ];
  const quitar = (t) => {
    if (t.id) patchSesion({ tareas_ids: sesion.tareas_ids.filter((x) => x !== t.id) });
    else patchSesion({ tareas_libres: sesion.tareas_libres.filter((_, i) => i !== t.libre) });
  };
  const editarTarea = (t, texto) => {
    const nuevo = texto.trim();
    if (!nuevo || nuevo === t.nombre) return;
    if (t.id) {
      // Una tarea del catalogo editada pasa a ser texto libre de este parte.
      patchSesion({
        tareas_ids: sesion.tareas_ids.filter((x) => x !== t.id),
        tareas_libres: [...(sesion.tareas_libres || []), nuevo],
      });
    } else {
      patchSesion({ tareas_libres: sesion.tareas_libres.map((x, i) => (i === t.libre ? nuevo : x)) });
    }
  };
  const anadir = (texto) => {
    const t = (texto ?? nuevaTarea).trim();
    if (!t) return;
    const enCatalogo = (tareasCatalogo || []).find((c) => c.nombre.toLowerCase() === t.toLowerCase());
    if (enCatalogo) {
      if ((sesion.tareas_ids || []).includes(enCatalogo.id)) return toast.info("Esa tarea ya está");
      patchSesion({ tareas_ids: [...(sesion.tareas_ids || []), enCatalogo.id] });
    } else {
      patchSesion({ tareas_libres: [...(sesion.tareas_libres || []), t] });
    }
    setNuevaTarea("");
  };
  const sugeridas = (tareasCatalogo || [])
    .filter((c) => !(sesion.tareas_ids || []).includes(c.id))
    .filter((c) => !nuevaTarea || c.nombre.toLowerCase().includes(nuevaTarea.toLowerCase()))
    .slice(0, nuevaTarea ? 8 : 12);

  const nombres = [
    ...(sesion.operarios_ids || []).map((id) => operariosPorId[id] || "Operario"),
    ...((sesion.operarios_texto_libre || "").split(",").map((x) => x.trim()).filter(Boolean)),
  ];
  const abierto = parte.estado === "abierto";
  const clienteTxt = [cliente?.nombre || parte.client_libre, centro?.nombre || parte.centro_libre]
    .filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl w-[98vw] max-h-[96vh] overflow-y-auto p-3 sm:p-5 bg-slate-100" data-testid="hoja-parte">
        <DialogTitle className="sr-only">Hoja de parte</DialogTitle>
        <DialogDescription className="sr-only">Hoja de parte con el formato del parte en papel</DialogDescription>

        <div className="flex flex-wrap items-center gap-2 pr-6">
          <Button variant="outline" size="sm" onClick={() => onAjustes && onAjustes(sesion)}>
            <Settings2 className="w-4 h-4 mr-1" />Operarios, visibilidad…
          </Button>
          <Button variant="outline" size="sm" onClick={onPdf} disabled={pdfGenerando}>
            <FileDown className="w-4 h-4 mr-1" />{pdfGenerando ? "Generando…" : "PDF"}
          </Button>
          <span className="text-xs text-slate-500 ml-auto">Se guarda solo</span>
        </div>

        {/* La hoja */}
        <div className="bg-white border border-slate-300 shadow-sm p-4 sm:p-6 space-y-3 text-slate-900">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
            <div>
              <img src="/logo-inicia.png" alt="Inicia" className="h-12 object-contain" onError={(e) => { e.currentTarget.style.display = "none"; }} />
              <p className="text-[10px] text-slate-500">C.I.F.: B-73.692.725</p>
            </div>
            <div className="space-y-1.5 sm:w-72">
              <Campo etiqueta="Nº PEDIDO:">
                <input className={entrada} value={pedido} disabled={!abierto}
                  onChange={(e) => setPedido(e.target.value)}
                  onBlur={() => pedido !== (parte.numero_pedido || "") && patchParte({ numero_pedido: pedido.trim() })} />
              </Campo>
              <Campo etiqueta="Nº PRESUPUESTO:">
                <input className={entrada} value={presupH || (parte.budget_number || "")} disabled={!abierto}
                  onChange={(e) => setPresupH(e.target.value)}
                  onBlur={() => presupH !== (parte.presupuesto_hoja || "") && patchParte({ presupuesto_hoja: presupH.trim() })} />
              </Campo>
              <Campo etiqueta="En Madrid a">
                <input type="date" className={entrada} value={f.fecha} disabled={!abierto}
                  onChange={(e) => e.target.value && cambia("fecha", e.target.value, true)} />
              </Campo>
              <p className="text-[11px] text-slate-500 text-right">{fechaLarga(f.fecha)}</p>
            </div>
          </div>

          <Campo etiqueta="Cliente:">
            <input className={entrada} value={clienteH || clienteTxt} disabled={!abierto}
              onChange={(e) => setClienteH(e.target.value)}
              onBlur={() => clienteH !== (parte.cliente_hoja || "") && patchParte({ cliente_hoja: clienteH.trim() === clienteTxt ? "" : clienteH.trim() })} />
          </Campo>
          <Campo etiqueta="Domicilio:">
            <input className={entrada} value={domicilio} disabled={!abierto} placeholder="Dirección del trabajo"
              onChange={(e) => setDomicilio(e.target.value)}
              onBlur={() => domicilio !== (parte.domicilio || centro?.direccion || "") && patchParte({ domicilio: domicilio.trim() })} />
          </Campo>

          <Caja titulo="DESCRIPCION DE TRABAJOS">
            <div className="min-h-[9rem] space-y-1">
              {tareas.length === 0 && <p className="text-xs text-slate-400">Añade las tareas realizadas…</p>}
              {tareas.map((t) => (
                <div key={t.clave} className="flex items-center gap-2 text-sm">
                  <span>•</span>
                  <input key={`${t.clave}-${t.nombre}`} className="flex-1 min-w-0 bg-transparent border-b border-transparent hover:border-slate-300 focus:border-slate-500 focus:outline-none py-0.5"
                    defaultValue={t.nombre} disabled={!abierto}
                    onBlur={(e) => editarTarea(t, e.target.value)} />
                  {abierto && <button onClick={() => quitar(t)} className="text-slate-300 hover:text-red-500" title="Quitar"><X className="w-4 h-4" /></button>}
                </div>
              ))}
              {abierto && (
                <div className="pt-2 space-y-2">
                  <div className="flex gap-1">
                    <input className={entrada} value={nuevaTarea} placeholder="Añadir tarea (escribe o elige)…"
                      onChange={(e) => setNuevaTarea(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && anadir()} />
                    <Button type="button" size="sm" variant="outline" onClick={() => anadir()}><Plus className="w-4 h-4" /></Button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {sugeridas.map((c) => (
                      <button key={c.id} onClick={() => anadir(c.nombre)}
                        className="text-xs border border-slate-300 rounded-full px-2.5 py-1 hover:bg-slate-100">+ {c.nombre}</button>
                    ))}
                  </div>
                </div>
              )}
              <div className="pt-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">Notas / observaciones</span>
                  {abierto && <BotonDictado onTexto={(t) => cambia("notas", `${f.notas ? f.notas + " " : ""}${t}`)} />}
                </div>
                <textarea className={`${entrada} mt-1`} rows={3} value={f.notas} disabled={!abierto}
                  onChange={(e) => cambia("notas", e.target.value)} />
              </div>
            </div>
          </Caja>

          <div className="grid grid-cols-2 gap-x-6 gap-y-1.5 sm:max-w-md">
            <Campo etiqueta="Nº operarios:">
              <input className={entrada} value={f.num_operarios_texto || String(nombres.length)} disabled={!abierto}
                onChange={(e) => cambia("num_operarios_texto", e.target.value === String(nombres.length) ? "" : e.target.value)} />
            </Campo>
            <Campo etiqueta="H. Desplaz.:">
              <input className={entrada} value={f.horas_desplazamiento} placeholder="0:30" disabled={!abierto}
                onChange={(e) => cambia("horas_desplazamiento", e.target.value)} />
            </Campo>
            <Campo etiqueta="H. inicio:">
              <input type="time" step="900" className={entrada} value={f.hora_inicio} disabled={!abierto}
                onChange={(e) => e.target.value && cambia("hora_inicio", e.target.value, true)} />
            </Campo>
            <Campo etiqueta="H. fin:">
              <input type="time" step="900" className={entrada} value={f.hora_fin} disabled={!abierto}
                onChange={(e) => e.target.value && cambia("hora_fin", e.target.value, true)} />
            </Campo>
            <span />
            <Campo etiqueta="Total horas:">
              <input className={entrada} value={f.total_horas_texto || totalHoras(f.hora_inicio, f.hora_fin)} disabled={!abierto}
                onChange={(e) => cambia("total_horas_texto", e.target.value === totalHoras(f.hora_inicio, f.hora_fin) ? "" : e.target.value)} />
            </Campo>
          </div>

          <Caja titulo="MATERIALES" extra={abierto ? <BotonDictado onTexto={(t) => cambia("materiales", `${f.materiales ? f.materiales + "\n" : ""}${t}`)} /> : null}>
            <textarea className={`${entrada} min-h-[7rem]`} value={f.materiales} disabled={!abierto}
              placeholder="Un material por línea (ej. 2 sacos de abono)"
              onChange={(e) => cambia("materiales", e.target.value)} />
          </Caja>

          <Campo etiqueta="Personal (Nombres):">
            <input className={entrada} value={f.personal_texto || nombres.join(", ")} disabled={!abierto}
              placeholder="Nombres del personal"
              onChange={(e) => cambia("personal_texto", e.target.value === nombres.join(", ") ? "" : e.target.value)} />
          </Campo>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <p className="text-xs italic text-slate-500 mb-1">Fdo: El cliente o persona autorizada,</p>
              {parte.firma_cliente ? (
                <div>
                  <img src={parte.firma_cliente} alt="Firma del cliente" className="h-24 object-contain border border-slate-200 rounded" />
                  {parte.firma_cliente_nombre && <p className="text-[11px] text-slate-500">{parte.firma_cliente_nombre}</p>}
                </div>
              ) : (
                <Button variant="outline" size="sm" onClick={onFirmaCliente}><PenLine className="w-4 h-4 mr-1" />Firma del cliente</Button>
              )}
            </div>
            <div>
              <p className="text-xs italic text-slate-500 mb-1">Fdo: Ellos operarios,</p>
              <SignaturePad key={sesion.id} value={sesion.firma_responsable || null} disabled={!abierto}
                onChange={(d) => patchSesion({ firma_responsable: d })} height={120} />
            </div>
          </div>

          <div className="border-t border-slate-300 pt-2 text-center text-[10px] text-slate-500">
            <p className="font-semibold">Calle Velazquez S/N - 30100 El Puntal (Murcia)</p>
            <p>Teléfono: 968 964 005 - Fax: 968 305 531 · www.iniciaservicios.es · inicia@iniciaservicios.es</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button onClick={() => onOpenChange(false)}>Listo</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HojaParte;
