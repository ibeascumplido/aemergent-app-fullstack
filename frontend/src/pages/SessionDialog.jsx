import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import SignaturePad from "@/components/SignaturePad";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus, Search, UserPlus, Users, Check, Eye, MapPin } from "lucide-react";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Campos que el cliente vera (o no) en el PDF/vista publica (Fase 5A.3).
// Si una clave no esta presente en visibilidad, se considera visible.
const CAMPOS_VISIBILIDAD = [
  { key: "operarios", label: "Operarios" },
  { key: "horas", label: "Horario" },
  { key: "tareas", label: "Tareas realizadas" },
  { key: "notas", label: "Notas" },
];

// Zonas fijas A-M (Fase 6): se corresponden con el mapa de zonas que el
// cliente tiene subido. "X" es "sin zona concreta" y siempre es una opcion.
const ZONA_LETRAS = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M"];

// Horas en pasos de 15 minutos: "00:00" .. "23:45"
const HORAS_15MIN = Array.from({ length: 96 }, (_, i) => {
  const h = String(Math.floor(i / 4)).padStart(2, "0");
  const m = String((i % 4) * 15).padStart(2, "0");
  return `${h}:${m}`;
});

const horaRedondeadaAhora = () => {
  const d = new Date();
  let m = Math.round(d.getMinutes() / 15) * 15;
  let h = d.getHours();
  if (m === 60) {
    m = 0;
    h = (h + 1) % 24;
  }
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
};

const sumaUnaHora = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  let total = h * 60 + m + 60;
  if (total >= 24 * 60) total = 23 * 60 + 45;
  const hh = String(Math.floor(total / 60)).padStart(2, "0");
  const mm = String(total % 60).padStart(2, "0");
  return `${hh}:${mm}`;
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

// Indicador visual de check, sin usar un componente interactivo propio
// (evita anidar un boton dentro de otro boton).
const Chk = ({ checked }) => (
  <span
    className={`w-4 h-4 rounded border shrink-0 flex items-center justify-center transition-colors ${
      checked ? "bg-indigo-600 border-indigo-600" : "border-slate-300 bg-white"
    }`}
  >
    {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
  </span>
);

/**
 * Modal de sesion diaria de un parte de trabajo (Fase 5A.2 parte 2).
 *
 * Props:
 * - open, onOpenChange: control del dialogo.
 * - workOrderId: parte al que pertenece la sesion.
 * - session: si se pasa, el dialogo edita esa sesion; si es null/undefined, crea una nueva.
 * - onSaved: callback tras guardar con exito (para refrescar la lista en el padre).
 */
const SessionDialog = ({ open, onOpenChange, workOrderId, session, usaZonas, onSaved }) => {
  const editing = !!session;

  const [operarios, setOperarios] = useState([]);
  const [tareas, setTareas] = useState([]);
  const [cargandoCatalogos, setCargandoCatalogos] = useState(false);

  const [fecha, setFecha] = useState(hoyISO());
  const [horaInicio, setHoraInicio] = useState(horaRedondeadaAhora());
  const [horaFin, setHoraFin] = useState(sumaUnaHora(horaRedondeadaAhora()));

  const [operariosIds, setOperariosIds] = useState([]);
  const [operariosLibresTexto, setOperariosLibresTexto] = useState([]);
  const [mostrarInputLibre, setMostrarInputLibre] = useState(false);
  const [nombreLibre, setNombreLibre] = useState("");
  const [popoverOperariosOpen, setPopoverOperariosOpen] = useState(false);
  const [buscarOperario, setBuscarOperario] = useState("");

  // "none" = sin seleccionar, "id:<user_id>" o "libre:<texto>"
  const [firmanteTipo, setFirmanteTipo] = useState("none");

  const [tareasIds, setTareasIds] = useState([]);
  const [tareasZonas, setTareasZonas] = useState({});
  const [buscarTarea, setBuscarTarea] = useState("");
  const [popoverTareasOpen, setPopoverTareasOpen] = useState(false);
  const [creandoTarea, setCreandoTarea] = useState(false);

  const [notas, setNotas] = useState("");
  const [visibilidad, setVisibilidad] = useState(
    Object.fromEntries(CAMPOS_VISIBILIDAD.map((c) => [c.key, true]))
  );
  const [firmaResponsable, setFirmaResponsable] = useState(null);
  const [guardando, setGuardando] = useState(false);

  // Cargar catalogos (operarios + tareas) cada vez que se abre
  useEffect(() => {
    if (!open) return;
    let cancelado = false;
    (async () => {
      setCargandoCatalogos(true);
      try {
        const [opsRes, tareasRes] = await Promise.all([
          axios.get(`${API}/users/operarios`),
          axios.get(`${API}/work-tasks`),
        ]);
        if (cancelado) return;
        setOperarios(opsRes.data);
        setTareas(tareasRes.data);
      } catch (err) {
        console.error("Error cargando catalogos:", err);
        toast.error("Error al cargar operarios o tareas");
      } finally {
        if (!cancelado) setCargandoCatalogos(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [open]);

  // Precargar formulario (edicion) o resetear (creacion) al abrir
  useEffect(() => {
    if (!open) return;
    if (session) {
      setFecha(session.fecha);
      setHoraInicio(session.hora_inicio);
      setHoraFin(session.hora_fin);
      setOperariosIds(session.operarios_ids || []);
      setOperariosLibresTexto(
        session.operarios_texto_libre
          ? session.operarios_texto_libre
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : []
      );
      if (session.firmante_responsable_id) {
        setFirmanteTipo(`id:${session.firmante_responsable_id}`);
      } else if (session.firmante_responsable_texto) {
        setFirmanteTipo(`libre:${session.firmante_responsable_texto}`);
      } else {
        setFirmanteTipo("none");
      }
      setTareasIds(session.tareas_ids || []);
      setTareasZonas(session.tareas_zonas || {});
      setNotas(session.notas || "");
      setVisibilidad({
        ...Object.fromEntries(CAMPOS_VISIBILIDAD.map((c) => [c.key, true])),
        ...(session.visibilidad || {}),
      });
      setFirmaResponsable(session.firma_responsable || null);
    } else {
      const hi = horaRedondeadaAhora();
      setFecha(hoyISO());
      setHoraInicio(hi);
      setHoraFin(sumaUnaHora(hi));
      setOperariosIds([]);
      setOperariosLibresTexto([]);
      setFirmanteTipo("none");
      setTareasIds([]);
      setTareasZonas({});
      setNotas("");
      setVisibilidad(Object.fromEntries(CAMPOS_VISIBILIDAD.map((c) => [c.key, true])));
      setFirmaResponsable(null);
    }
    setMostrarInputLibre(false);
    setNombreLibre("");
    setBuscarOperario("");
    setBuscarTarea("");
  }, [open, session]);

  const operariosSeleccionados = useMemo(
    () => operarios.filter((o) => operariosIds.includes(o.user_id)),
    [operarios, operariosIds]
  );

  const totalOperarios = operariosIds.length + operariosLibresTexto.length;

  // Opciones de firmante: solo entre los operarios presentes en esta sesion
  const opcionesFirmante = useMemo(() => {
    const registrados = operariosSeleccionados.map((o) => ({
      value: `id:${o.user_id}`,
      label: o.name,
    }));
    const libres = operariosLibresTexto.map((nombre) => ({
      value: `libre:${nombre}`,
      label: `${nombre} (sin registrar)`,
    }));
    return [...registrados, ...libres];
  }, [operariosSeleccionados, operariosLibresTexto]);

  // Si el firmante elegido deja de estar entre los operarios de la sesion, se limpia
  useEffect(() => {
    if (firmanteTipo !== "none" && !opcionesFirmante.some((o) => o.value === firmanteTipo)) {
      setFirmanteTipo("none");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opcionesFirmante]);

  // Sin responsable seleccionado no tiene sentido conservar una firma
  useEffect(() => {
    if (firmanteTipo === "none" && firmaResponsable) {
      setFirmaResponsable(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [firmanteTipo]);

  const toggleOperario = (userId) => {
    setOperariosIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const quitarOperario = (userId) => {
    setOperariosIds((prev) => prev.filter((id) => id !== userId));
  };

  const anadirOperarioLibre = () => {
    const nombre = nombreLibre.trim();
    if (!nombre) return;
    if (operariosLibresTexto.some((n) => n.toLowerCase() === nombre.toLowerCase())) {
      toast.warning("Ese nombre ya esta anadido");
      return;
    }
    setOperariosLibresTexto((prev) => [...prev, nombre]);
    setNombreLibre("");
    setMostrarInputLibre(false);
  };

  const quitarOperarioLibre = (nombre) => {
    setOperariosLibresTexto((prev) => prev.filter((n) => n !== nombre));
  };

  const operariosFiltrados = operarios.filter((o) =>
    o.name.toLowerCase().includes(buscarOperario.toLowerCase())
  );

  const top10 = tareas.filter((t) => t.en_top10);
  const tareasFiltradas = tareas.filter(
    (t) => !t.en_top10 && t.nombre.toLowerCase().includes(buscarTarea.toLowerCase())
  );

  const toggleTarea = (taskId) => {
    setTareasIds((prev) =>
      prev.includes(taskId) ? prev.filter((id) => id !== taskId) : [...prev, taskId]
    );
    setTareasZonas((prev) => {
      if (prev[taskId]) {
        const { [taskId]: _quitada, ...resto } = prev;
        return resto;
      }
      return { ...prev, [taskId]: "X" };
    });
  };

  const asignarZonaTarea = (taskId, zona) => {
    setTareasZonas((prev) => ({ ...prev, [taskId]: zona }));
  };

  const crearTareaAlVuelo = async () => {
    const nombre = buscarTarea.trim();
    if (!nombre) return;
    setCreandoTarea(true);
    try {
      const res = await axios.post(`${API}/work-tasks`, {
        nombre,
        en_top10: false,
        orden: 100,
      });
      setTareas((prev) => [...prev, res.data]);
      setTareasIds((prev) => [...prev, res.data.id]);
      setBuscarTarea("");
      toast.success("Tarea creada y anadida");
    } catch (err) {
      console.error("Error creando tarea:", err);
      const status = err?.response?.status;
      if (status === 409) toast.error("Ya existe una tarea con ese nombre");
      else toast.error("Error al crear la tarea");
    } finally {
      setCreandoTarea(false);
    }
  };

  const validar = () => {
    if (!fecha) {
      toast.error("Falta la fecha");
      return false;
    }
    if (!horaInicio || !horaFin) {
      toast.error("Faltan las horas");
      return false;
    }
    if (horaFin <= horaInicio) {
      toast.error("La hora de fin debe ser posterior a la de inicio");
      return false;
    }
    return true;
  };

  const handleGuardar = async () => {
    if (!validar()) return;
    setGuardando(true);
    try {
      const payload = {
        fecha,
        hora_inicio: horaInicio,
        hora_fin: horaFin,
        operarios_ids: operariosIds,
        operarios_texto_libre: operariosLibresTexto.join(", "),
        firmante_responsable_id: firmanteTipo.startsWith("id:")
          ? firmanteTipo.slice(3)
          : null,
        firmante_responsable_texto: firmanteTipo.startsWith("libre:")
          ? firmanteTipo.slice(6)
          : "",
        tareas_ids: tareasIds,
        tareas_libres: [],
        tareas_zonas: usaZonas
          ? Object.fromEntries(tareasIds.map((id) => [id, tareasZonas[id] || "X"]))
          : {},
        notas: notas.trim(),
        visibilidad,
        firma_responsable: firmaResponsable,
      };
      if (editing) {
        await axios.patch(
          `${API}/work-orders/${workOrderId}/sessions/${session.id}`,
          payload
        );
        toast.success("Sesion actualizada");
      } else {
        await axios.post(`${API}/work-orders/${workOrderId}/sessions`, payload);
        toast.success("Sesion anadida");
      }
      onOpenChange(false);
      onSaved && onSaved();
    } catch (err) {
      console.error("Error guardando sesion:", err);
      const status = err?.response?.status;
      if (status === 403) toast.error("El parte no esta abierto");
      else if (status === 400)
        toast.error(err.response.data?.detail || "Datos invalidos");
      else toast.error("Error al guardar la sesion");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !guardando && onOpenChange(v)}>
      <DialogContent
        className="max-w-lg max-h-[85vh] overflow-y-auto"
        data-testid="session-dialog"
      >
        <DialogHeader>
          <DialogTitle>{editing ? "Editar sesion" : "Nueva sesion"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Fecha y horas */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="sesion-fecha">Fecha</Label>
              <Input
                id="sesion-fecha"
                type="date"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                data-testid="sesion-fecha-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Hora inicio</Label>
              <Select value={horaInicio} onValueChange={setHoraInicio}>
                <SelectTrigger data-testid="sesion-hora-inicio-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {HORAS_15MIN.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Hora fin</Label>
              <Select value={horaFin} onValueChange={setHoraFin}>
                <SelectTrigger data-testid="sesion-hora-fin-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {HORAS_15MIN.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Operarios */}
          <div className="space-y-2">
            <Label>Operarios</Label>

            {(operariosSeleccionados.length > 0 || operariosLibresTexto.length > 0) && (
              <div className="flex flex-wrap gap-1.5 mb-1">
                {operariosSeleccionados.map((o) => (
                  <span
                    key={o.user_id}
                    className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full"
                  >
                    {o.name}
                    <button
                      type="button"
                      onClick={() => quitarOperario(o.user_id)}
                      className="hover:text-indigo-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
                {operariosLibresTexto.map((nombre) => (
                  <span
                    key={nombre}
                    className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-1 rounded-full border border-dashed border-amber-300"
                    title="Texto libre, no esta en el sistema"
                  >
                    {nombre}
                    <button
                      type="button"
                      onClick={() => quitarOperarioLibre(nombre)}
                      className="hover:text-amber-900"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            )}

            <Popover open={popoverOperariosOpen} onOpenChange={setPopoverOperariosOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start text-slate-500 font-normal border-slate-200"
                  data-testid="sesion-operarios-trigger"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Buscar operario registrado...
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-72 sm:w-80" align="start">
                <div className="p-2 border-b border-slate-100">
                  <Input
                    placeholder="Buscar..."
                    value={buscarOperario}
                    onChange={(e) => setBuscarOperario(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="max-h-56 overflow-y-auto p-1">
                  {cargandoCatalogos ? (
                    <p className="text-sm text-slate-400 p-3 text-center">Cargando...</p>
                  ) : operariosFiltrados.length === 0 ? (
                    <p className="text-sm text-slate-400 p-3 text-center">Sin resultados</p>
                  ) : (
                    operariosFiltrados.map((o) => (
                      <button
                        type="button"
                        key={o.user_id}
                        onClick={() => toggleOperario(o.user_id)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-left"
                        data-testid={`operario-opcion-${o.user_id}`}
                      >
                        <Chk checked={operariosIds.includes(o.user_id)} />
                        <span className="truncate">{o.name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>

            {mostrarInputLibre ? (
              <div className="flex gap-2">
                <Input
                  placeholder="Nombre del operario"
                  value={nombreLibre}
                  onChange={(e) => setNombreLibre(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      anadirOperarioLibre();
                    }
                  }}
                  autoFocus
                  data-testid="operario-libre-input"
                />
                <Button type="button" size="sm" onClick={anadirOperarioLibre}>
                  Anadir
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setMostrarInputLibre(false);
                    setNombreLibre("");
                  }}
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setMostrarInputLibre(true)}
                className="text-xs text-slate-500 hover:text-indigo-600 inline-flex items-center gap-1"
                data-testid="anadir-operario-libre-btn"
              >
                <UserPlus className="w-3.5 h-3.5" />
                Anadir operario no registrado
              </button>
            )}

            <p
              className="text-xs text-slate-400 inline-flex items-center gap-1 pt-1"
              data-testid="contador-operarios"
            >
              <Users className="w-3.5 h-3.5" />
              {totalOperarios} operario{totalOperarios === 1 ? "" : "s"}
              {totalOperarios > 0 &&
                ` (${operariosIds.length} registrado${
                  operariosIds.length === 1 ? "" : "s"
                } + ${operariosLibresTexto.length} sin registrar)`}
            </p>
          </div>

          {/* Firmante responsable */}
          <div className="space-y-1.5">
            <Label>Firmante responsable</Label>
            <Select
              value={firmanteTipo}
              onValueChange={setFirmanteTipo}
              disabled={opcionesFirmante.length === 0}
            >
              <SelectTrigger data-testid="sesion-firmante-select">
                <SelectValue
                  placeholder={
                    opcionesFirmante.length === 0
                      ? "Anade operarios primero"
                      : "Selecciona responsable..."
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin seleccionar</SelectItem>
                {opcionesFirmante.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {firmanteTipo === "none" ? (
              <p className="text-xs text-slate-400">
                Selecciona un responsable para poder firmar la sesion
              </p>
            ) : (
              <div className="pt-1">
                <SignaturePad
                  value={firmaResponsable}
                  onChange={setFirmaResponsable}
                  disabled={guardando}
                />
              </div>
            )}
          </div>

          {/* Tareas */}
          <div className="space-y-2">
            <Label>Tareas realizadas</Label>
            {cargandoCatalogos ? (
              <p className="text-sm text-slate-400">Cargando catalogo...</p>
            ) : (
              <>
                {top10.length > 0 && (
                  <div className="grid grid-cols-2 gap-1.5">
                    {top10.map((t) => (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => toggleTarea(t.id)}
                        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-sm text-left border transition-colors ${
                          tareasIds.includes(t.id)
                            ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                            : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                        data-testid={`tarea-top10-${t.id}`}
                      >
                        <Chk checked={tareasIds.includes(t.id)} />
                        <span className="truncate">{t.nombre}</span>
                      </button>
                    ))}
                  </div>
                )}

                <Popover open={popoverTareasOpen} onOpenChange={setPopoverTareasOpen}>
                  <PopoverTrigger asChild>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full justify-start text-slate-500 font-normal border-slate-200"
                      data-testid="sesion-tareas-trigger"
                    >
                      <Search className="w-4 h-4 mr-2" />
                      Buscar otra tarea o crear nueva...
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="p-0 w-72 sm:w-80" align="start">
                    <div className="p-2 border-b border-slate-100">
                      <Input
                        placeholder="Buscar o escribir nueva tarea..."
                        value={buscarTarea}
                        onChange={(e) => setBuscarTarea(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div className="max-h-56 overflow-y-auto p-1">
                      {tareasFiltradas.map((t) => (
                        <button
                          type="button"
                          key={t.id}
                          onClick={() => toggleTarea(t.id)}
                          className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-left"
                          data-testid={`tarea-opcion-${t.id}`}
                        >
                          <Chk checked={tareasIds.includes(t.id)} />
                          <span className="truncate">{t.nombre}</span>
                        </button>
                      ))}
                      {buscarTarea.trim() &&
                        !tareas.some(
                          (t) =>
                            t.nombre.toLowerCase() === buscarTarea.trim().toLowerCase()
                        ) && (
                          <button
                            type="button"
                            onClick={crearTareaAlVuelo}
                            disabled={creandoTarea}
                            className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-indigo-50 text-sm text-left text-indigo-600 font-medium border-t border-slate-100 mt-1 pt-2"
                            data-testid="crear-tarea-al-vuelo-btn"
                          >
                            <Plus className="w-4 h-4" />
                            {creandoTarea ? "Creando..." : `Crear "${buscarTarea.trim()}"`}
                          </button>
                        )}
                    </div>
                  </PopoverContent>
                </Popover>

                {tareasIds.filter((id) => !top10.some((t) => t.id === id)).length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {tareasIds
                      .filter((id) => !top10.some((t) => t.id === id))
                      .map((id) => {
                        const t = tareas.find((x) => x.id === id);
                        if (!t) return null;
                        return (
                          <span
                            key={id}
                            className="inline-flex items-center gap-1 bg-slate-100 text-slate-700 text-xs font-medium px-2 py-1 rounded-full"
                          >
                            {t.nombre}
                            <button type="button" onClick={() => toggleTarea(id)}>
                              <X className="w-3 h-3" />
                            </button>
                          </span>
                        );
                      })}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Zona por tarea (Fase 6) - solo si el parte tiene usa_zonas activo */}
          {usaZonas && tareasIds.length > 0 && (
            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-slate-400" />
                Zona por tarea
              </Label>
              <div className="space-y-1.5 rounded-lg border border-slate-200 p-2">
                {tareasIds.map((id) => {
                  const t = tareas.find((x) => x.id === id);
                  if (!t) return null;
                  return (
                    <div key={id} className="flex items-center justify-between gap-2">
                      <span className="text-sm text-slate-700 truncate">{t.nombre}</span>
                      <Select
                        value={tareasZonas[id] || "X"}
                        onValueChange={(v) => asignarZonaTarea(id, v)}
                      >
                        <SelectTrigger className="w-20 h-8 shrink-0" data-testid={`zona-tarea-${id}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="X">X (sin zona)</SelectItem>
                          {ZONA_LETRAS.map((letra) => (
                            <SelectItem key={letra} value={letra}>
                              {letra}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-slate-400">
                Las letras se corresponden con el mapa de zonas del cliente. Elige X si no aplica
                una zona concreta.
              </p>
            </div>
          )}

          {/* Visibilidad para el cliente */}
          <div className="space-y-2">
            <Label className="inline-flex items-center gap-1.5">
              <Eye className="w-3.5 h-3.5 text-slate-400" />
              Visibilidad para el cliente
            </Label>
            <div className="rounded-lg border border-slate-200 divide-y divide-slate-100">
              {CAMPOS_VISIBILIDAD.map((c) => (
                <div key={c.key} className="flex items-center justify-between px-3 py-2">
                  <span className="text-sm text-slate-700">{c.label}</span>
                  <Switch
                    checked={visibilidad[c.key] !== false}
                    onCheckedChange={(v) =>
                      setVisibilidad((prev) => ({ ...prev, [c.key]: v }))
                    }
                    data-testid={`visibilidad-${c.key}`}
                  />
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400">
              Controla que vera el cliente en el PDF/enlace de firma (la fecha del parte
              siempre es visible)
            </p>
          </div>

          {/* Notas */}
          <div className="space-y-1.5">
            <Label htmlFor="sesion-notas">Notas (opcional)</Label>
            <Textarea
              id="sesion-notas"
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              placeholder="Observaciones de la jornada..."
              rows={3}
              data-testid="sesion-notas-input"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={guardando}>
            Cancelar
          </Button>
          <Button
            onClick={handleGuardar}
            disabled={guardando}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="guardar-sesion-btn"
          >
            {guardando ? "Guardando..." : editing ? "Guardar cambios" : "Anadir sesion"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default SessionDialog;
