import { useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { comprimirImagen } from "@/lib/imagen";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const fmtDia = (iso) => iso.split("-").reverse().slice(0, 2).join("/");

const RejillaDesdeFoto = ({ workOrderId, tareas, onAplicado }) => {
  const [open, setOpen] = useState(false);
  const [leyendo, setLeyendo] = useState(false);
  const [aplicando, setAplicando] = useState(false);
  const [propuesta, setPropuesta] = useState(null);

  const nombreTarea = (id) => tareas.find((t) => t.tarea_id === id)?.tarea_nombre || id;

  const abrir = () => {
    setPropuesta(null);
    setOpen(true);
  };

  const leerFoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setLeyendo(true);
    setPropuesta(null);
    try {
      const imagen = await comprimirImagen(file, 2200, 0.85);
      const res = await axios.post(`${API}/work-orders/${workOrderId}/rejilla-desde-foto`, { imagen });
      setPropuesta(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "No se pudo leer la foto");
    } finally {
      setLeyendo(false);
    }
  };

  const aplicar = async () => {
    setAplicando(true);
    try {
      for (const c of propuesta.celdas) {
        await axios.put(`${API}/work-orders/${workOrderId}/rejilla-zonas/celda`, c);
      }
      for (const n of propuesta.notas) {
        await axios.put(`${API}/work-orders/${workOrderId}/rejilla-notas`, n);
      }
      toast.success("Rejilla rellenada. Revisa que todo esté bien.");
      setOpen(false);
      onAplicado?.();
    } catch (err) {
      toast.error("No se pudo aplicar todo; revisa la rejilla");
      onAplicado?.();
    } finally {
      setAplicando(false);
    }
  };

  // Agrupa celdas por tarea para mostrarlas
  const porTarea = {};
  (propuesta?.celdas || []).forEach((c) => {
    (porTarea[c.tarea_id] = porTarea[c.tarea_id] || []).push(c);
  });

  return (
    <>
      <Button variant="outline" size="sm" onClick={abrir} className="border-slate-200" data-testid="rejilla-desde-foto-btn">
        <Sparkles className="w-4 h-4 mr-2" />
        Rellenar desde foto
      </Button>

      <Dialog open={open} onOpenChange={(v) => !leyendo && !aplicando && setOpen(v)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Rellenar la rejilla desde una foto</DialogTitle>
          </DialogHeader>

          {!propuesta && (
            <div className="space-y-3 text-center py-2">
              <p className="text-sm text-slate-500">
                Haz o elige la foto del parte en papel (que se vea entera y nítida). Verás lo que se ha leído
                antes de que se guarde nada.
              </p>
              <label className="inline-flex flex-col items-center gap-2 cursor-pointer">
                <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                  <Camera className="w-8 h-8 text-indigo-500" />
                </div>
                <span className="text-sm text-slate-600">{leyendo ? "Leyendo la foto..." : "Hacer o elegir foto"}</span>
                <input type="file" accept="image/*" onChange={leerFoto} disabled={leyendo} className="hidden" />
              </label>
            </div>
          )}

          {propuesta && (
            <div className="space-y-4">
              {propuesta.celdas.length === 0 && propuesta.notas.length === 0 ? (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  No se ha podido leer ninguna casilla. Prueba con otra foto más nítida.
                </p>
              ) : (
                <>
                  <div>
                    <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">
                      Casillas leídas ({propuesta.celdas.length})
                    </p>
                    <div className="space-y-2">
                      {Object.entries(porTarea).map(([tid, cs]) => (
                        <div key={tid} className="border border-slate-100 rounded-lg p-2">
                          <p className="text-sm font-medium text-slate-800">{nombreTarea(tid)}</p>
                          <p className="text-xs text-slate-600 mt-1">
                            {cs.map((c) => `${fmtDia(c.fecha)}: ${c.zonas.join(",")}`).join("  ·  ")}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                  {propuesta.notas.length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">Observaciones</p>
                      {propuesta.notas.map((n) => (
                        <p key={n.fecha} className="text-sm text-slate-700">
                          <strong>{fmtDia(n.fecha)}:</strong> {n.texto}
                        </p>
                      ))}
                    </div>
                  )}
                </>
              )}
              {propuesta.dudas && (
                <p className="text-sm text-amber-700 bg-amber-50 rounded-lg p-3">
                  <strong>Dudas:</strong> {propuesta.dudas}
                </p>
              )}
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => setPropuesta(null)} disabled={aplicando}>
                  Otra foto
                </Button>
                {(propuesta.celdas.length > 0 || propuesta.notas.length > 0) && (
                  <Button onClick={aplicar} disabled={aplicando} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                    {aplicando ? "Aplicando..." : "Aplicar a la rejilla"}
                  </Button>
                )}
              </div>
              <p className="text-xs text-slate-400">
                Al aplicar se sobrescriben solo esas casillas; el resto de la rejilla no se toca.
              </p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default RejillaDesdeFoto;
