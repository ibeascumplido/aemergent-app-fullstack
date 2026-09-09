import { useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, X, Upload, Images, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Genera un id de lote sencillo para agrupar las fotos subidas en el momento.
const nuevoLoteId = () => `lote_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const AnadirFotosParte = ({ workOrderId, clientId, clientSlug, onCambioFotos }) => {
  const [open, setOpen] = useState(false);
  const [pestana, setPestana] = useState("nueva"); // nueva | sin_clasificar | cliente
  const [subiendo, setSubiendo] = useState(false);

  // Fotos existentes (sin clasificar o del cliente) para elegir
  const [candidatas, setCandidatas] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [asociando, setAsociando] = useState(false);

  const abrir = () => {
    setPestana("nueva");
    setSeleccionadas(new Set());
    setCandidatas([]);
    setOpen(true);
  };

  // Subir fotos nuevas (una o varias) directamente asociadas al parte
  const subirNuevas = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    setSubiendo(true);
    const lote = nuevoLoteId();
    try {
      for (const file of files) {
        if (!file.type.startsWith("image/")) continue;
        const dataUrl = await new Promise((res, rej) => {
          const r = new FileReader();
          r.onload = () => res(r.result);
          r.onerror = rej;
          r.readAsDataURL(file);
        });
        await axios.post(`${API}/fotos`, {
          imagen: dataUrl,
          lote_id: lote,
          work_order_id: workOrderId,
          client_id: clientId || null,
        });
      }
      toast.success("Fotos añadidas al parte");
      setOpen(false);
      onCambioFotos?.();
    } catch (err) {
      console.error("Error subiendo fotos:", err);
      toast.error("No se pudieron subir las fotos");
    } finally {
      setSubiendo(false);
    }
  };

  // Cargar fotos candidatas según la pestaña
  const cargarCandidatas = useCallback(async (tipo) => {
    setCargando(true);
    setSeleccionadas(new Set());
    try {
      let params;
      if (tipo === "sin_clasificar") {
        params = { solo_sin_clasificar: true };
      } else {
        params = { client_id: clientId };
      }
      const res = await axios.get(`${API}/fotos`, { params });
      // No mostrar las que ya están en este parte
      setCandidatas((res.data || []).filter((f) => f.work_order_id !== workOrderId));
    } catch (err) {
      console.error("Error cargando fotos:", err);
      setCandidatas([]);
    } finally {
      setCargando(false);
    }
  }, [clientId, workOrderId]);

  const cambiarPestana = (tipo) => {
    setPestana(tipo);
    if (tipo === "sin_clasificar" || tipo === "cliente") {
      cargarCandidatas(tipo);
    }
  };

  const toggleSeleccion = (fotoId) => {
    setSeleccionadas((prev) => {
      const nuevo = new Set(prev);
      if (nuevo.has(fotoId)) nuevo.delete(fotoId);
      else nuevo.add(fotoId);
      return nuevo;
    });
  };

  const asociarSeleccionadas = async () => {
    if (seleccionadas.size === 0) {
      toast.error("Selecciona al menos una foto");
      return;
    }
    setAsociando(true);
    try {
      await axios.put(`${API}/work-orders/${workOrderId}/asociar-fotos`, {
        foto_ids: Array.from(seleccionadas),
      });
      toast.success("Fotos añadidas al parte");
      setOpen(false);
      onCambioFotos?.();
    } catch (err) {
      console.error("Error asociando fotos:", err);
      toast.error("No se pudieron asociar");
    } finally {
      setAsociando(false);
    }
  };

  return (
    <>
      <Button size="sm" variant="outline" onClick={abrir} data-testid="anadir-fotos-parte-btn">
        <Camera className="w-4 h-4 mr-1.5" />
        Añadir fotos
      </Button>

      <Dialog open={open} onOpenChange={(v) => !subiendo && !asociando && setOpen(v)}>
        <DialogContent className="max-w-lg max-h-[85vh] flex flex-col p-0 gap-0">
          <DialogHeader className="shrink-0 p-5 pb-3 border-b border-slate-100">
            <DialogTitle>Añadir fotos al parte</DialogTitle>
          </DialogHeader>

          <div className="flex gap-1 p-3 border-b border-slate-100 shrink-0 flex-wrap">
            <button
              type="button"
              onClick={() => cambiarPestana("nueva")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                pestana === "nueva" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              <Upload className="w-3.5 h-3.5" /> Hacer/subir
            </button>
            <button
              type="button"
              onClick={() => cambiarPestana("sin_clasificar")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                pestana === "sin_clasificar" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
              }`}
            >
              <Images className="w-3.5 h-3.5" /> Sin clasificar
            </button>
            {clientId && (
              <button
                type="button"
                onClick={() => cambiarPestana("cliente")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm border ${
                  pestana === "cliente" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
                }`}
              >
                <Building2 className="w-3.5 h-3.5" /> Del cliente
              </button>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {pestana === "nueva" ? (
              <div className="text-center py-6">
                <label className="inline-flex flex-col items-center gap-2 cursor-pointer">
                  <div className="w-16 h-16 rounded-full bg-indigo-50 flex items-center justify-center">
                    <Camera className="w-8 h-8 text-indigo-500" />
                  </div>
                  <span className="text-sm text-slate-600">
                    {subiendo ? "Subiendo..." : "Toca para hacer o elegir fotos"}
                  </span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    multiple
                    onChange={subirNuevas}
                    disabled={subiendo}
                    className="hidden"
                    data-testid="subir-nuevas-input"
                  />
                </label>
                <p className="text-xs text-slate-400 mt-3">
                  Puedes seleccionar varias a la vez.
                </p>
              </div>
            ) : cargando ? (
              <p className="text-sm text-slate-400 text-center py-6">Cargando...</p>
            ) : candidatas.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-6">
                {pestana === "sin_clasificar"
                  ? "No hay fotos sin clasificar."
                  : "Este cliente no tiene otras fotos."}
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {candidatas.map((f) => {
                  const sel = seleccionadas.has(f.id);
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => toggleSeleccion(f.id)}
                      className={`relative rounded-lg overflow-hidden border-2 aspect-square ${
                        sel ? "border-indigo-600" : "border-transparent"
                      }`}
                      data-testid={`candidata-${f.id}`}
                    >
                      <img src={f.url} alt="" className="w-full h-full object-cover" />
                      {sel && (
                        <span className="absolute top-1 right-1 bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs">
                          ✓
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {(pestana === "sin_clasificar" || pestana === "cliente") && candidatas.length > 0 && (
            <div className="shrink-0 p-4 border-t border-slate-100 flex justify-between items-center">
              <span className="text-sm text-slate-500">{seleccionadas.size} seleccionada(s)</span>
              <Button
                onClick={asociarSeleccionadas}
                disabled={asociando || seleccionadas.size === 0}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="asociar-fotos-btn"
              >
                {asociando ? "Añadiendo..." : "Añadir al parte"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AnadirFotosParte;
