import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  ListChecks,
  Check,
  X,
  Clock,
  ThumbsUp,
  MapPin,
  AlertTriangle,
  Trash2,
  Pencil,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import EditarIncidenciaDialog from "@/components/EditarIncidenciaDialog";
import SelectorFotos from "@/components/SelectorFotos";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_DOT = {
  5: "bg-red-500",
  4: "bg-orange-500",
  3: "bg-amber-500",
  2: "bg-slate-400",
  1: "bg-slate-300",
};

// Los tres filtros que le interesan al admin, mapeados al estado real.
const FILTROS = [
  { key: "pendiente_aprobacion", label: "Por aprobar" },
  { key: "pendiente_validacion", label: "Por validar" },
  { key: "activa", label: "Activas" },
];

const AdminTareasCentroPage = () => {
  const [filtro, setFiltro] = useState("pendiente_aprobacion");
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [contadores, setContadores] = useState({});
  const [fotoAmpliada, setFotoAmpliada] = useState(null);
  const [procesando, setProcesando] = useState(null);

  // Edición de tarea
  const [tareaEditar, setTareaEditar] = useState(null);
  const [editDescripcion, setEditDescripcion] = useState("");
  const [editPrioridad, setEditPrioridad] = useState("3");
  const [editFotosNuevas, setEditFotosNuevas] = useState([]);
  const [editQuitar, setEditQuitar] = useState([]);
  const [guardandoEdicion, setGuardandoEdicion] = useState(false);
  // Edición de la incidencia generada desde una tarea
  const [incidenciaEditar, setIncidenciaEditar] = useState(null);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/tareas-centro/pendientes-todas`, {
        params: { estado: filtro },
      });
      setTareas(res.data);
    } catch (err) {
      console.error("Error cargando tareas:", err);
      toast.error("No se pudieron cargar las tareas");
    } finally {
      setLoading(false);
    }
  }, [filtro]);

  // Contadores de cada filtro (para las pestañas)
  const cargarContadores = useCallback(async () => {
    try {
      const resultados = await Promise.all(
        FILTROS.map((f) =>
          axios
            .get(`${API}/tareas-centro/pendientes-todas`, { params: { estado: f.key } })
            .then((r) => [f.key, r.data.length])
            .catch(() => [f.key, 0])
        )
      );
      setContadores(Object.fromEntries(resultados));
    } catch {
      // silencioso
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  useEffect(() => {
    cargarContadores();
  }, [cargarContadores, tareas]);

  const accion = async (tareaId, endpoint, mensaje) => {
    setProcesando(tareaId);
    try {
      await axios.put(`${API}/tareas-centro/${tareaId}/${endpoint}`);
      toast.success(mensaje);
      await cargar();
    } catch (err) {
      console.error(`Error en ${endpoint}:`, err);
      toast.error(err?.response?.data?.detail || "No se pudo completar la acción");
    } finally {
      setProcesando(null);
    }
  };

  const abrirEditar = (t) => {
    setTareaEditar(t);
    setEditDescripcion(t.descripcion || "");
    setEditPrioridad(String(t.prioridad || 3));
    setEditFotosNuevas([]);
    setEditQuitar([]);
  };

  const guardarEdicion = async () => {
    if (!editDescripcion.trim()) {
      toast.error("Escribe la descripción");
      return;
    }
    setGuardandoEdicion(true);
    try {
      await axios.put(`${API}/tareas-centro/${tareaEditar.id}`, {
        descripcion: editDescripcion.trim(),
        prioridad: Number(editPrioridad),
        fotos_nuevas: editFotosNuevas.length > 0 ? editFotosNuevas : undefined,
        quitar_fotos: editQuitar.length > 0 ? editQuitar : undefined,
      });
      toast.success("Tarea actualizada");
      setTareaEditar(null);
      await cargar();
    } catch (err) {
      console.error("Error editando tarea:", err);
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setGuardandoEdicion(false);
    }
  };

  const abrirEditarIncidencia = async (t) => {
    try {
      const res = await axios.get(`${API}/incidencias`, { params: { client_id: t.client_id } });
      const inc = res.data.find((i) => i.id === t.incidencia_id);
      if (!inc) {
        toast.error("No se encontró la incidencia");
        return;
      }
      setIncidenciaEditar(inc);
    } catch (err) {
      console.error("Error cargando incidencia:", err);
      toast.error("No se pudo cargar la incidencia");
    }
  };

  const eliminarTarea = async (tareaId) => {
    if (!window.confirm("¿Eliminar esta tarea? No se puede deshacer.")) return;
    setProcesando(tareaId);
    try {
      await axios.delete(`${API}/tareas-centro/${tareaId}`);
      toast.success("Tarea eliminada");
      await cargar();
    } catch (err) {
      console.error("Error eliminando tarea:", err);
      toast.error("No se pudo eliminar");
    } finally {
      setProcesando(null);
    }
  };

  return (
    <div data-testid="admin-tareas-centro-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <ListChecks className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Tareas
          </h1>
          <p className="text-sm text-slate-500">
            Aprueba tareas propuestas y valida las que los operarios completan
          </p>
        </div>
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {FILTROS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFiltro(f.key)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition-colors ${
              filtro === f.key
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            data-testid={`filtro-${f.key}`}
          >
            {f.label}
            {contadores[f.key] > 0 && (
              <span
                className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                  filtro === f.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {contadores[f.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : tareas.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400 text-sm">
            {filtro === "pendiente_aprobacion" && "No hay tareas propuestas por aprobar."}
            {filtro === "pendiente_validacion" && "No hay tareas por validar."}
            {filtro === "activa" && "No hay tareas activas pendientes de hacer."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {tareas.map((t) => (
            <Card key={t.id} className="border-slate-100" data-testid={`admin-tarea-${t.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2.5 min-w-0">
                    <span
                      className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${PRIORIDAD_DOT[t.prioridad]}`}
                      title={`Prioridad ${t.prioridad}`}
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800">{t.descripcion}</p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-1">
                        <Link
                          to={`/clients/${t.client_id}`}
                          className="text-xs text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                        >
                          <MapPin className="w-3 h-3" />
                          {t.client_nombre}
                          {t.centro_nombre ? ` · ${t.centro_nombre}` : ""}
                        </Link>
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {filtro === "pendiente_aprobacion" && `Propuesta por ${t.creado_por_nombre}`}
                        {filtro === "pendiente_validacion" &&
                          `Completada por ${t.marcada_por_nombre || "?"}`}
                        {filtro === "activa" && `Creada por ${t.creado_por_nombre}`}
                      </p>
                    </div>
                  </div>
                  {(t.fotos || []).length > 0 && (
                    <div className="flex items-center gap-1 shrink-0">
                      {t.fotos.slice(0, 3).map((f, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setFotoAmpliada(f.url)}
                          className="w-14 h-14 rounded-lg overflow-hidden border border-slate-200"
                          title="Ver foto"
                        >
                          <img src={f.url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {t.fotos.length > 3 && (
                        <span className="text-xs text-slate-400">+{t.fotos.length - 3}</span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex gap-2 mt-3">
                  {filtro === "pendiente_aprobacion" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => accion(t.id, "aprobar", "Tarea aprobada")}
                        disabled={procesando === t.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`aprobar-${t.id}`}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Aprobar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => accion(t.id, "rechazar", "Tarea rechazada")}
                        disabled={procesando === t.id}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        data-testid={`rechazar-prop-${t.id}`}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Rechazar
                      </Button>
                    </>
                  )}
                  {filtro === "pendiente_validacion" && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => accion(t.id, "validar", "Tarea validada")}
                        disabled={procesando === t.id}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`validar-${t.id}`}
                      >
                        <ThumbsUp className="w-3.5 h-3.5 mr-1" />
                        Validar
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => accion(t.id, "rechazar", "Devuelta a activa")}
                        disabled={procesando === t.id}
                        className="text-amber-600 border-amber-200 hover:bg-amber-50"
                        data-testid={`rechazar-val-${t.id}`}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Devolver
                      </Button>
                    </>
                  )}
                  {filtro === "activa" && (
                    <div className="flex items-center gap-2 flex-wrap">
                      {t.incidencia_id ? (
                        <>
                          <span className="text-xs text-red-600 inline-flex items-center gap-1 font-medium">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            Marcada como incidencia
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => abrirEditarIncidencia(t)}
                            data-testid={`editar-incidencia-tarea-${t.id}`}
                          >
                            <Pencil className="w-3.5 h-3.5 mr-1" />
                            Editar incidencia
                          </Button>
                        </>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => accion(t.id, "a-incidencia", "Convertida en incidencia")}
                          disabled={procesando === t.id}
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          data-testid={`a-incidencia-${t.id}`}
                        >
                          <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                          Pasar a incidencia
                        </Button>
                      )}
                      <span className="text-xs text-slate-400 inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        Pendiente de que un operario la complete
                      </span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => abrirEditar(t)}
                    disabled={procesando === t.id}
                    className="ml-auto text-slate-300 hover:text-indigo-500 p-1 self-center"
                    title="Editar tarea"
                    data-testid={`editar-tarea-${t.id}`}
                  >
                    <Pencil className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => eliminarTarea(t.id)}
                    disabled={procesando === t.id}
                    className="text-slate-300 hover:text-red-500 p-1 self-center"
                    title="Eliminar tarea"
                    data-testid={`eliminar-tarea-${t.id}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <EditarIncidenciaDialog
        incidencia={incidenciaEditar}
        onClose={() => setIncidenciaEditar(null)}
        onSaved={cargar}
      />

      <Dialog open={!!tareaEditar} onOpenChange={(v) => !v && !guardandoEdicion && setTareaEditar(null)}>
        <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-5 pb-0 shrink-0">
            <DialogTitle>Editar tarea</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 p-5 overflow-y-auto">
            <div className="space-y-1.5">
              <Label>Descripción</Label>
              <Textarea
                value={editDescripcion}
                onChange={(e) => setEditDescripcion(e.target.value)}
                rows={3}
                maxLength={500}
                data-testid="editar-tarea-descripcion"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Prioridad</Label>
              <Select value={editPrioridad} onValueChange={setEditPrioridad}>
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
            <div className="space-y-1.5">
              <Label>Fotos</Label>
              {(tareaEditar?.fotos || []).filter((f) => !editQuitar.includes(f.public_id)).length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap">
                  {(tareaEditar?.fotos || [])
                    .filter((f) => !editQuitar.includes(f.public_id))
                    .map((f) => (
                      <div key={f.public_id || f.url} className="relative">
                        <img src={f.url} alt="" className="w-16 h-16 rounded-md object-cover border border-slate-200" />
                        {f.public_id && (
                          <button
                            type="button"
                            onClick={() => setEditQuitar((prev) => [...prev, f.public_id])}
                            className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    ))}
                </div>
              )}
              <SelectorFotos fotos={editFotosNuevas} onChange={setEditFotosNuevas} />
            </div>
          </div>
          <DialogFooter className="p-5 pt-0 shrink-0">
            <Button variant="ghost" onClick={() => setTareaEditar(null)} disabled={guardandoEdicion}>
              Cancelar
            </Button>
            <Button
              onClick={guardarEdicion}
              disabled={guardandoEdicion}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-edicion-tarea-btn"
            >
              {guardandoEdicion ? "Guardando..." : "Guardar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
          data-testid="foto-pantalla-completa"
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={fotoAmpliada}
            alt="Foto de la tarea"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};

export default AdminTareasCentroPage;
