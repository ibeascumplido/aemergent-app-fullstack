import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Download, Plus, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmt = (f) => new Date(f + "T00:00:00").toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" });

export const descargarCalendarioLaboral = async (year, municipio = "", nombre = "") => {
  try {
    const r = await axios.get(`${API}/calendario-laboral/pdf`, { params: { year, municipio }, responseType: "blob" });
    const url = URL.createObjectURL(new Blob([r.data], { type: "application/pdf" }));
    const a = document.createElement("a");
    a.href = url; a.download = `calendario-laboral-${year}${nombre ? "-" + nombre.replace(/\s+/g, "_") : ""}.pdf`; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  } catch { toast.error("No se pudo generar el PDF"); }
};

const FestivosDialog = ({ open, onOpenChange, year = 2027 }) => {
  const [data, setData] = useState({ festivos: [], municipios: [] });
  const [nuevo, setNuevo] = useState({ municipio: "", fecha: "", nombre: "" });
  const [nuevoMuni, setNuevoMuni] = useState("");
  const [operarios, setOperarios] = useState([]);

  const cargar = useCallback(async () => {
    try { setData((await axios.get(`${API}/festivos`, { params: { year } })).data); }
    catch { toast.error("No se pudieron cargar los festivos"); }
    try { setOperarios((await axios.get(`${API}/admin/festivos-operarios`)).data); } catch { /* */ }
  }, [year]);
  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  const add = async (body) => {
    try { await axios.post(`${API}/admin/festivos`, body); await cargar(); return true; }
    catch (e) { toast.error(e.response?.data?.detail || "No se pudo añadir"); return false; }
  };
  const del = async (id) => { await axios.delete(`${API}/admin/festivos/${id}`); cargar(); };
  const addMuni = async () => {
    if (!nuevoMuni.trim()) return;
    await axios.post(`${API}/admin/festivos-municipios`, { nombre: nuevoMuni.trim() });
    setNuevoMuni(""); cargar();
  };
  const delMuni = async (n) => {
    if (!window.confirm(`¿Quitar ${n} y sus festivos locales?`)) return;
    await axios.delete(`${API}/admin/festivos-municipios/${encodeURIComponent(n)}`); cargar();
  };
  const setOp = async (u, municipio) => {
    setOperarios((l) => l.map((x) => (x.user_id === u.user_id ? { ...x, municipio } : x)));
    try { await axios.put(`${API}/admin/festivos-operarios/${u.user_id}`, { municipio }); }
    catch { toast.error("No se pudo guardar"); cargar(); }
  };
  const guardarLocal = async () => {
    if (!nuevo.municipio || !nuevo.fecha || !nuevo.nombre.trim()) return toast.error("Municipio, fecha y nombre");
    if (!nuevo.fecha.startsWith(String(year))) return toast.error(`La fecha debe ser de ${year}`);
    if (await add({ ambito: "local", ...nuevo })) setNuevo({ ...nuevo, fecha: "", nombre: "" });
  };

  const comunes = data.festivos.filter((f) => f.ambito === "comunidad");
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Calendario laboral {year}</DialogTitle></DialogHeader>
        <div className="space-y-4 text-sm">
          <div className="bg-slate-50 border border-slate-200 rounded-md p-3 space-y-2">
            <p>Descarga el PDF y mándalo a los operarios. También pueden marcar sus vacaciones directamente en la app: <b>Mi calendario → Año → {year}</b>. Sus solicitudes te llegan al calendario global para aprobarlas.</p>
            <Button onClick={() => descargarCalendarioLaboral(year)}><Download className="w-4 h-4 mr-1" />Descargar PDF {year}</Button>
          </div>

          <div>
            <p className="font-semibold text-red-700 mb-1">Nacionales y Comunidad de Madrid ({comunes.length})</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 text-slate-700">
              {comunes.map((f) => <div key={f.id} className="flex justify-between border-b border-slate-100 py-0.5"><span>{fmt(f.fecha)}</span><span className="text-right">{f.nombre}</span></div>)}
            </div>
            <p className="text-xs text-slate-400 mt-1">Decreto 82/2026 (BOCM 1-oct-2026). El 2 de mayo cae en domingo y no se traslada.</p>
          </div>

          <div>
            <p className="font-semibold text-slate-900 mb-1">Festivos locales de cada operario</p>
            <p className="text-xs text-slate-500 mb-2">Elige qué festivos locales disfruta cada uno (p. ej. trabaja en Alcorcón pero le pones Madrid). Es lo que verá en su calendario y en su PDF.</p>
            {operarios.map((u) => (
              <div key={u.user_id} className="flex items-center gap-2 py-1 border-b border-slate-100">
                <span className="flex-1 truncate">{u.name}</span>
                <select value={u.municipio} onChange={(e) => setOp(u, e.target.value)} className="border border-slate-200 rounded-md px-2 py-1 bg-white">
                  {[...new Set(["Madrid", ...data.municipios, u.municipio])].map((m) => <option key={m}>{m}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => descargarCalendarioLaboral(year, u.municipio, u.name)} title="PDF de este operario"><Download className="w-4 h-4" /></Button>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            <p className="font-semibold text-orange-700">Fiestas locales por municipio</p>
            {data.municipios.map((m) => {
              const lista = data.festivos.filter((f) => f.ambito === "local" && f.municipio === m);
              return (
                <div key={m} className="border border-slate-200 rounded-md p-2">
                  <div className="flex items-center"><b className="flex-1">{m}</b>
                    <button onClick={() => delMuni(m)} className="text-slate-300 hover:text-red-500" title="Quitar municipio"><Trash2 className="w-4 h-4" /></button></div>
                  {lista.length === 0 && <p className="text-xs text-amber-600">Pendiente: aún no publicadas. Añádelas cuando salgan.</p>}
                  {lista.map((f) => <div key={f.id} className="flex items-center gap-2 py-0.5"><span className="w-28">{fmt(f.fecha)}</span><span className="flex-1">{f.nombre}</span>
                    <button onClick={() => del(f.id)} className="text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button></div>)}
                </div>
              );
            })}
            <div className="flex gap-2"><Input placeholder="Añadir municipio (p. ej. Pozuelo)" value={nuevoMuni} onChange={(e) => setNuevoMuni(e.target.value)} />
              <Button variant="outline" onClick={addMuni}><Plus className="w-4 h-4" /></Button></div>

            <div className="border border-dashed border-slate-300 rounded-md p-2 space-y-2">
              <p className="text-xs text-slate-500">Añadir fiesta local</p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <select value={nuevo.municipio} onChange={(e) => setNuevo({ ...nuevo, municipio: e.target.value })} className="border border-slate-200 rounded-md px-2 py-2 bg-white">
                  <option value="">Municipio…</option>{data.municipios.map((m) => <option key={m}>{m}</option>)}
                </select>
                <Input type="date" value={nuevo.fecha} onChange={(e) => setNuevo({ ...nuevo, fecha: e.target.value })} />
                <Input placeholder="Nombre" value={nuevo.nombre} onChange={(e) => setNuevo({ ...nuevo, nombre: e.target.value })} />
              </div>
              <Button size="sm" onClick={guardarLocal}><Plus className="w-4 h-4 mr-1" />Añadir</Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default FestivosDialog;
