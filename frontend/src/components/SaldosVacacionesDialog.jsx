import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const num = (v) => (v === "" || v == null ? 0 : parseInt(v, 10) || 0);

const SaldosVacacionesDialog = ({ open, onOpenChange }) => {
  const [tab, setTab] = useState("arrastre");
  const [year, setYear] = useState(2027);
  const [filas, setFilas] = useState([]);
  const [sucios, setSucios] = useState({});
  const [hist, setHist] = useState(null);

  const cargar = useCallback(async () => {
    try { setFilas((await axios.get(`${API}/admin/vacaciones/saldos`, { params: { year } })).data); setSucios({}); }
    catch { toast.error("No se pudieron cargar los saldos"); }
  }, [year]);
  useEffect(() => { if (open) cargar(); }, [open, cargar]);

  const set = (id, campo, valor) => {
    setFilas((l) => l.map((f) => (f.user_id === id ? { ...f, [campo]: valor } : f)));
    setSucios((s) => ({ ...s, [id]: true }));
  };
  const guardar = async (f) => {
    try {
      await axios.put(`${API}/admin/vacaciones/saldos/${f.user_id}/${year}`, {
        arrastre_vacaciones: num(f.arrastre_vacaciones), arrastre_libres: num(f.arrastre_libres),
        dias_vacaciones: num(f.base_vacaciones), dias_libres: num(f.base_libres), nota: f.nota || "",
      });
      setSucios((s) => { const n = { ...s }; delete n[f.user_id]; return n; });
      toast.success(`Guardado: ${f.name}`);
    } catch { toast.error("No se pudo guardar"); }
  };
  const sugeridos = () => {
    setFilas((l) => l.map((f) => ({ ...f, arrastre_vacaciones: f.restantes_anterior_vacaciones, arrastre_libres: f.restantes_anterior_libres })));
    setSucios(Object.fromEntries(filas.map((f) => [f.user_id, true])));
    toast.info("Sugeridos cargados: revisa y pulsa Guardar en cada fila");
  };
  const verHist = async (id) => {
    try { setHist((await axios.get(`${API}/admin/vacaciones/historial/${id}`)).data); }
    catch { toast.error("No se pudo cargar el historial"); }
  };
  const inp = "h-8 w-16 text-center px-1";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Saldos de vacaciones y arrastre</DialogTitle></DialogHeader>
        <div className="flex gap-2">
          <Button size="sm" variant={tab === "arrastre" ? "default" : "outline"} onClick={() => setTab("arrastre")}>Arrastre por año</Button>
          <Button size="sm" variant={tab === "historial" ? "default" : "outline"} onClick={() => setTab("historial")}>Historial por operario</Button>
        </div>

        {tab === "arrastre" && (
          <div className="space-y-3 text-sm">
            <div className="flex flex-wrap items-center gap-2">
              <span>Año a configurar:</span>
              <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="border border-slate-200 rounded-md px-2 py-1.5 bg-white">
                {[2026, 2027, 2028, 2029].map((y) => <option key={y}>{y}</option>)}
              </select>
              <Button size="sm" variant="outline" onClick={sugeridos}>Cargar sugeridos ({year - 1} sin disfrutar)</Button>
            </div>
            <p className="text-xs text-slate-500">El arrastre se suma al saldo base del año. «Sugerido» = días aprobados que le sobraron en {year - 1}. Es excepcional: ajusta caso por caso.</p>
            {filas.map((f) => (
              <div key={f.user_id} className="border border-slate-200 rounded-md p-2 space-y-1.5">
                <div className="flex items-center gap-2">
                  <b className="flex-1 truncate">{f.name}</b>
                  <span className="text-xs text-slate-500">Total {year}: <b>{num(f.base_vacaciones) + num(f.arrastre_vacaciones)}</b> vac · <b>{num(f.base_libres) + num(f.arrastre_libres)}</b> libres</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 items-end text-xs text-slate-500">
                  <label>Base vacaciones<Input className={inp} inputMode="numeric" value={f.base_vacaciones} onChange={(e) => set(f.user_id, "base_vacaciones", e.target.value)} /></label>
                  <label>Arrastre vacaciones <span className="text-slate-400">(sug. {f.restantes_anterior_vacaciones})</span><Input className={inp} inputMode="numeric" value={f.arrastre_vacaciones} onChange={(e) => set(f.user_id, "arrastre_vacaciones", e.target.value)} /></label>
                  <label>Base libres<Input className={inp} inputMode="numeric" value={f.base_libres} onChange={(e) => set(f.user_id, "base_libres", e.target.value)} /></label>
                  <label>Arrastre libres <span className="text-slate-400">(sug. {f.restantes_anterior_libres})</span><Input className={inp} inputMode="numeric" value={f.arrastre_libres} onChange={(e) => set(f.user_id, "arrastre_libres", e.target.value)} /></label>
                </div>
                <div className="flex gap-2">
                  <Input className="h-8" placeholder="Nota (motivo del arrastre)" value={f.nota || ""} onChange={(e) => set(f.user_id, "nota", e.target.value)} />
                  <Button size="sm" disabled={!sucios[f.user_id]} onClick={() => guardar(f)}>Guardar</Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "historial" && (
          <div className="space-y-3 text-sm">
            <select defaultValue="" onChange={(e) => e.target.value && verHist(e.target.value)} className="border border-slate-200 rounded-md px-2 py-2 bg-white w-full sm:w-auto">
              <option value="">Elige operario…</option>
              {filas.map((f) => <option key={f.user_id} value={f.user_id}>{f.name}</option>)}
            </select>
            {hist && (
              <div className="overflow-x-auto">
                <p className="font-semibold mb-1">{hist.name}</p>
                <table className="w-full text-xs border border-slate-200">
                  <thead className="bg-slate-50"><tr>
                    <th className="p-1.5 text-left">Año</th><th>Vac. base</th><th>Arrastre</th><th>Vac. total</th><th>Disfrutadas</th><th>Sobran</th>
                    <th>Libres total</th><th>Disfrutados</th><th>Sobran</th><th className="text-left">Nota</th></tr></thead>
                  <tbody>{hist.anios.map((a) => (
                    <tr key={a.year} className="border-t border-slate-100 text-center">
                      <td className="p-1.5 text-left font-semibold">{a.year}</td><td>{a.base_vacaciones}</td><td>{a.arrastre_vacaciones}</td>
                      <td>{a.total_vacaciones}</td><td>{a.vac_aprob}</td><td className={a.restantes_vacaciones < 0 ? "text-red-600 font-bold" : ""}>{a.restantes_vacaciones}</td>
                      <td>{a.total_libres}{a.arrastre_libres ? ` (+${a.arrastre_libres})` : ""}</td><td>{a.lib_aprob}</td><td className={a.restantes_libres < 0 ? "text-red-600 font-bold" : ""}>{a.restantes_libres}</td>
                      <td className="text-left">{a.nota}</td></tr>))}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaldosVacacionesDialog;
