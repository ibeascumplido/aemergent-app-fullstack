import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { ListChecks, Plus, Trash2, Camera, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_COLOR = {
  5: "bg-red-100 text-red-700 border-red-200",
  4: "bg-orange-100 text-orange-700 border-orange-200",
  3: "bg-amber-100 text-amber-700 border-amber-200",
  2: "bg-slate-100 text-slate-600 border-slate-200",
  1: "bg-slate-50 text-slate-400 border-slate-200",
};

/**
 * Checklist de tareas pendientes por cliente/centro (Fase 13). Admin y
 * operario pueden crear y completar; borrar es solo admin. Vive dentro
 * de la ficha del cliente, junto a Centros.
 */
const TareasCliente = ({ clientId, clientSlug }) => {
  const { isAdmin } = useAuth();
  const [tareas, setTareas] = useState([]);
  const [centros, setCentros] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mostrarCompletadas, setMostrarCompletadas] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [descripcion, setDescripcion] = useState("");
  const [prioridad, setPrioridad] = useState("3");
  const [centroId, setCentroId] = useState("__ninguno__");
  const [guardando, setGuardando] = useState(false);

  const [dialogFotoTareaId, setDialogFotoTareaId] = useState(null);
  const [fotoDataUrl, setFotoDataUrl] = useState(null);
  const [subiendoFoto, setSubiendoFoto] = useState(false);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const [tRes, cRes] = await Promise.all([
        axios.get(`${API}/tareas-centro`, { params: { client_id: clientId } }),
        axios.get(`${API}/clients/${clientSlug}/centros`),
      ]);
      setTareas(tRes.data);
      setCentros(cRes.data);
    } catch (err) {
      console.error("Error cargando tareas:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const abrirNueva = () => {
    setDescripcion("");
    setPrioridad("3");
    setCentroId("__ninguno__");
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!descripcion.trim()) {
      toast.error("Escribe la tarea");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/tareas-centro`, {
        client_id: clientId,
        centro_id: centroId === "__ninguno__" ? null : centroId,
        descripcion: descripcion.trim(),
        prioridad: Number(prioridad),
      });
      toast.success("Tarea añadida");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando tarea:", err);
      toast.error("Error al crear la tarea");
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

  const abrirCompletarConFoto = (tareaId) => {
    setDialogFotoTareaId(tareaId);
    setFotoDataUrl(null);
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

  const reabrir = async (tareaId) => {
    try {
      await axios.put(`${API}/tareas-centro/${tareaId}/reabrir`);
      toast.success("Reabierta");
      await cargar();
    } catch (err) {
      console.error("Error reabriendo tarea:", err);
      toast.error("No se pudo reabrir");
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/tareas-centro/${aBorrar.id}`);
      toast.success("Tarea eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando tarea:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) return null;

  const pendientes = tareas.filter((t) => !t.completada);
  const completadas = tareas.filter((t) => t.completada);
  const visibles = mostrarCompletadas ? [...pendientes, ...completadas] : pendientes;

  return (
    <div className="mb-6" data-testid="tareas-cliente">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
          <ListChecks className="w-5 h-5 text-slate-400" />
          Tareas pendientes ({pendientes.length})
        </h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setMostrarCompletadas((v) => !v)}
            className="text-xs text-slate-400 hover:text-slate-600"
          >
            {mostrarCompletadas ? "Ocultar completadas" : "Ver completadas"}
          </button>
          <Button size="sm" variant="outline" onClick={abrirNueva} data-testid="nueva-tarea-btn">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            Nueva tarea
          </Button>
        </div>
      </div>

      {visibles.length === 0 ? (
        <p className="text-sm text-slate-400">Sin tareas pendientes.</p>
      ) : (
        <div className="space-y-1.5">
          {visibles.map((t) => (
            <div
              key={t.id}
              className={`flex items-start gap-3 px-3 py-2.5 rounded-lg border ${
                t.completada ? "border-slate-100 bg-slate-50/50" : "border-slate-200"
              }`}
              data-testid={`tarea-${t.id}`}
            >
              <button
                type="button"
                onClick={() =>
                  t.completada ? reabrir(t.id) : completarSinFoto(t.id)
                }
                className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  t.completada
                    ? "bg-emerald-500 border-emerald-500 text-white"
                    : "border-slate-300 hover:border-emerald-400"
                }`}
                title={t.completada ? "Reabrir" : "Marcar como hecha"}
                data-testid={`check-tarea-${t.id}`}
              >
                {t.completada && "✓"}
              </button>

              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm ${
                    t.completada ? "text-slate-400 line-through" : "text-slate-800"
                  }`}
                >
                  {t.descripcion}
                </p>
                <div className="flex items-center gap-2 flex-wrap mt-1">
                  <span
                    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${PRIORIDAD_COLOR[t.prioridad]}`}
                  >
                    P{t.prioridad}
                  </span>
                  {t.centro_nombre && (
                    <span className="text-[10px] text-slate-400">{t.centro_nombre}</span>
                  )}
                  <span className="text-[10px] text-slate-400">
                    {t.completada
                      ? `Hecha por ${t.completada_por_nombre}`
                      : `Creada por ${t.creado_por_nombre}`}
                  </span>
                </div>
              </div>

              {t.foto_url && (
                <button
                  type="button"
                  onClick={() => setFotoAmpliada(t.foto_url)}
                  className="w-10 h-10 rounded-md overflow-hidden border border-slate-200 shrink-0"
                >
                  <img src={t.foto_url} alt="" className="w-full h-full object-cover" />
                </button>
              )}

              {!t.completada && (
                <button
                  type="button"
                  onClick={() => abrirCompletarConFoto(t.id)}
                  className="text-slate-300 hover:text-indigo-500 shrink-0"
                  title="Completar con foto"
                >
                  <Camera className="w-4 h-4" />
                </button>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setABorrar(t)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Nueva tarea */}
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
                placeholder="Ej. Podar el seto de la entrada"
                data-testid="descripcion-tarea-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Prioridad</Label>
                <Select value={prioridad} onValueChange={setPrioridad}>
                  <SelectTrigger data-testid="prioridad-select">
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
              <div className="space-y-1.5">
                <Label>Centro</Label>
                <Select value={centroId} onValueChange={setCentroId}>
                  <SelectTrigger data-testid="centro-tarea-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__ninguno__">Todo el cliente</SelectItem>
                    {centros.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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
              data-testid="crear-tarea-btn"
            >
              {guardando ? "Creando..." : "Crear"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Completar con foto */}
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
            <Button
              variant="ghost"
              onClick={() => setDialogFotoTareaId(null)}
              disabled={subiendoFoto}
            >
              Cancelar
            </Button>
            <Button
              onClick={confirmarCompletarConFoto}
              disabled={subiendoFoto || !fotoDataUrl}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="confirmar-completar-foto-btn"
            >
              {subiendoFoto ? "Guardando..." : "Completar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <img src={fotoAmpliada} alt="" className="max-w-full max-h-full rounded-lg" />
        </div>
      )}

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta tarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{aBorrar?.descripcion}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminar} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default TareasCliente;
