import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ListChecks, Plus, Camera, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_COLOR = {
  5: "bg-red-100 text-red-700",
  4: "bg-orange-100 text-orange-700",
  3: "bg-amber-100 text-amber-700",
  2: "bg-slate-100 text-slate-600",
  1: "bg-slate-50 text-slate-400",
};

/**
 * Widget del dashboard (Fase 13) para el operario: tareas pendientes de
 * el/los sitio(s) donde esta asignado hoy segun Planificacion. Si no
 * tiene ninguna asignacion hoy, no se muestra nada (no tiene sentido
 * mostrar un widget vacio de "tareas de un sitio" sin sitio).
 */
const TareasHoyWidget = () => {
  const [tareas, setTareas] = useState([]);
  const [destinos, setDestinos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("3");
  const [destinoClave, setDestinoClave] = useState("");
  const [guardando, setGuardando] = useState(false);

  const [dialogFotoTareaId, setDialogFotoTareaId] = useState(null);
  const [fotoDataUrl, setFotoDataUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const cargar = async () => {
    try {
      const [tRes, dRes] = await Promise.all([
        axios.get(`${API}/tareas-centro/mis-tareas-hoy`),
        axios.get(`${API}/tareas-centro/mis-destinos-hoy`),
      ]);
      setTareas(tRes.data);
      setDestinos(dRes.data);
    } catch (err) {
      console.error("Error cargando tareas de hoy:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNueva = () => {
    setDescripcion("");
    setPrioridad("3");
    setDestinoClave(destinos.length > 0 ? `${destinos[0].client_id}|${destinos[0].centro_id || ""}` : "");
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!descripcion.trim()) {
      toast.error("Escribe la tarea");
      return;
    }
    const [clientId, centroId] = destinoClave.split("|");
    setGuardando(true);
    try {
      await axios.post(`${API}/tareas-centro`, {
        client_id: clientId,
        centro_id: centroId || null,
        descripcion: descripcion.trim(),
        prioridad: Number(prioridad),
      });
      toast.success("Tarea añadida");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando tarea:", err);
      toast.error("No se pudo crear");
    } finally {
      setGuardando(false);
    }
  };

  const completarSinFoto = async (tareaId) => {
    try {
      await axios.put(`${API}/tareas-centro/${tareaId}/completar`, {});
      toast.success("Tarea completada");
      await cargar();
    } catch (err) {
      console.error("Error completando tarea:", err);
      toast.error("No se pudo completar");
    }
  };

  const onFotoSeleccionada = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFotoDataUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const confirmarCompletarConFoto = async () => {
    setSubiendoFoto(true);
    try {
      await axios.put(`${API}/tareas-centro/${dialogFotoTareaId}/completar`, {
        foto: fotoDataUrl,
      });
      toast.success("Tarea completada");
      setDialogFotoTareaId(null);
      await cargar();
    } catch (err) {
      console.error("Error completando tarea:", err);
      toast.error("No se pudo completar");
    } finally {
      setSubiendoFoto(false);
    }
  };

  if (loading || destinos.length === 0) return null;

  return (
    <Card className="border-slate-100 shadow-sm mb-6" data-testid="tareas-hoy-widget">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-slate-400" />
            Tareas de hoy
          </h2>
          <Button size="sm" variant="outline" onClick={abrirNueva} data-testid="anadir-tarea-hoy-btn">
            <Plus className="w-3.5 h-3.5 mr-1" />
            Añadir
          </Button>
        </div>

        {tareas.length === 0 ? (
          <p className="text-sm text-slate-400">Sin tareas pendientes en tu sitio de hoy.</p>
        ) : (
          <div className="space-y-1.5">
            {tareas.map((t) => (
              <div
                key={t.id}
                className="flex items-start gap-3 px-3 py-2 rounded-lg border border-slate-200"
                data-testid={`tarea-hoy-${t.id}`}
              >
                <button
                  type="button"
                  onClick={() => completarSinFoto(t.id)}
                  className="mt-0.5 w-5 h-5 rounded-full border-2 border-slate-300 hover:border-emerald-400 shrink-0"
                  title="Marcar como hecha"
                  data-testid={`check-tarea-hoy-${t.id}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-800">{t.descripcion}</p>
                  <div className="flex items-center gap-2 flex-wrap mt-1">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${PRIORIDAD_COLOR[t.prioridad]}`}>
                      P{t.prioridad}
                    </span>
                    <span className="text-[10px] text-slate-400">
                      {t.centro_nombre || t.client_nombre}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setDialogFotoTareaId(t.id);
                    setFotoDataUrl(null);
                  }}
                  className="text-slate-300 hover:text-indigo-500 shrink-0"
                  title="Completar con foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
                rows={2}
                placeholder="Ej. Falta agua en el riego de la zona 3"
                data-testid="descripcion-tarea-hoy-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="5">5 - Máxima</SelectItem>
                    <SelectItem value="4">4 - Alta</SelectItem>
                    <SelectItem value="3">3 - Media</SelectItem>
                    <SelectItem value="2">2 - Baja</SelectItem>
                    <SelectItem value="1">1 - Mínima</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {destinos.length > 1 && (
                <div className="space-y-1.5">
                  <Label>Sitio</Label>
                  <Select value={destinoClave} onValueChange={setDestinoClave}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {destinos.map((d) => (
                        <SelectItem
                          key={`${d.client_id}|${d.centro_id || ""}`}
                          value={`${d.client_id}|${d.centro_id || ""}`}
                        >
                          {d.centro_nombre || d.client_nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-tarea-hoy-btn"
            >
              {guardando ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!dialogFotoTareaId}
        onOpenChange={(v) => !subiendoFoto && !v && setDialogFotoTareaId(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Completar con foto</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {fotoDataUrl ? (
              <div className="relative">
                <img src={fotoDataUrl} alt="" className="w-full rounded-lg" />
                <button
                  type="button"
                  onClick={() => setFotoDataUrl(null)}
                  className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center gap-2 py-8 rounded-lg border-2 border-dashed border-slate-300 text-slate-400 hover:border-indigo-300 hover:text-indigo-500 cursor-pointer">
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFotoSeleccionada}
                  className="hidden"
                />
                <Camera className="w-6 h-6" />
                <span className="text-sm">Hacer/elegir foto</span>
              </label>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogFotoTareaId(null)} disabled={subiendoFoto}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarCompletarConFoto}
              disabled={subiendoFoto || !fotoDataUrl}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {subiendoFoto ? "Guardando..." : "Completar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};

export default TareasHoyWidget;
