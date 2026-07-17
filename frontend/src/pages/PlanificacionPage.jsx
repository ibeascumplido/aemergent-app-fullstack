import { useEffect, useMemo, useRef, useState } from "react";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Plus,
  X,
  Lock,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MESES_ES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const DIAS_SEMANA_CORTO = ["L", "M", "X", "J", "V", "S", "D"];

const diaSemanaCorto = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return DIAS_SEMANA_CORTO[(d.getDay() + 6) % 7];
};

const formatDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const PlanificacionPage = () => {
  const { isAdmin } = useAuth();
  const panelRef = useRef(null);

  const [currentDate, setCurrentDate] = useState(new Date());
  const [columnas, setColumnas] = useState([]);
  const [asignaciones, setAsignaciones] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [clientesDisponibles, setClientesDisponibles] = useState([]);
  const [loading, setLoading] = useState(true);

  const [panelAbierto, setPanelAbierto] = useState(null); // { fecha, columna, top, left }
  const [guardando, setGuardando] = useState(false);

  const [dialogColumnaOpen, setDialogColumnaOpen] = useState(false);
  const [nuevaColumnaTipo, setNuevaColumnaTipo] = useState("cliente");
  const [nuevaColumnaClienteId, setNuevaColumnaClienteId] = useState("");
  const [nuevaColumnaEtiqueta, setNuevaColumnaEtiqueta] = useState("");
  const [creandoColumna, setCreandoColumna] = useState(false);
  const [columnaABorrar, setColumnaABorrar] = useState(null);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const diasDelMes = useMemo(() => {
    const ultimoDia = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: ultimoDia }, (_, i) => formatDateString(new Date(year, month, i + 1)));
  }, [year, month]);

  const cargarBase = async () => {
    try {
      const [opsRes, clientesRes] = await Promise.all([
        axios.get(`${API}/users/operarios`),
        axios.get(`${API}/clients`).catch(() => ({ data: [] })),
      ]);
      setOperarios(opsRes.data);
      setClientesDisponibles(clientesRes.data);
    } catch (err) {
      console.error("Error cargando operarios/clientes:", err);
    }
  };

  const cargarRejilla = async () => {
    setLoading(true);
    try {
      const desde = diasDelMes[0];
      const hasta = diasDelMes[diasDelMes.length - 1];
      const [columnasRes, rejillaRes] = await Promise.all([
        axios.get(`${API}/planificacion/columnas`),
        axios.get(`${API}/planificacion/rejilla`, { params: { desde, hasta } }),
      ]);
      setColumnas(columnasRes.data);
      setAsignaciones(rejillaRes.data.asignaciones);
      setVacaciones(rejillaRes.data.vacaciones);
    } catch (err) {
      console.error("Error cargando la planificación:", err);
      toast.error("Error al cargar la planificación");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarBase();
  }, []);

  useEffect(() => {
    cargarRejilla();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  // Cerrar panel al clicar fuera
  useEffect(() => {
    if (!panelAbierto) return undefined;
    const handleClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        setPanelAbierto(null);
      }
    };
    const handleEscape = (e) => {
      if (e.key === "Escape") setPanelAbierto(null);
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [panelAbierto]);

  const operariosPorId = useMemo(() => {
    const map = {};
    operarios.forEach((o) => (map[o.user_id] = o));
    return map;
  }, [operarios]);

  const vacacionesSet = useMemo(() => {
    const set = new Set();
    vacaciones.forEach((v) => set.add(`${v.user_id}|${v.fecha}`));
    return set;
  }, [vacaciones]);

  // { fecha: { columnaId: [asignacion,...] } }
  const asignacionesPorCelda = useMemo(() => {
    const map = {};
    asignaciones.forEach((a) => {
      const columnaId = a.destino_cliente_id
        ? columnas.find((c) => c.tipo === "cliente" && c.cliente_id === a.destino_cliente_id)?.id
        : columnas.find((c) => c.tipo === "libre" && c.etiqueta === a.destino_libre)?.id;
      if (!columnaId) return;
      if (!map[a.fecha]) map[a.fecha] = {};
      if (!map[a.fecha][columnaId]) map[a.fecha][columnaId] = [];
      map[a.fecha][columnaId].push(a);
    });
    return map;
  }, [asignaciones, columnas]);

  const irMesAnterior = () => setCurrentDate(new Date(year, month - 1, 1));
  const irMesSiguiente = () => setCurrentDate(new Date(year, month + 1, 1));
  const irHoy = () => setCurrentDate(new Date());

  const abrirPanel = (e, fecha, columna) => {
    if (!isAdmin) return;
    if (panelAbierto?.fecha === fecha && panelAbierto?.columna?.id === columna.id) {
      setPanelAbierto(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const PANEL_ANCHO = 220;
    const PANEL_ALTO_ESTIMADO = 280;
    let left = rect.left + window.scrollX;
    if (left + PANEL_ANCHO > window.scrollX + window.innerWidth) {
      left = window.scrollX + window.innerWidth - PANEL_ANCHO - 8;
    }
    let top = rect.bottom + window.scrollY + 4;
    if (rect.bottom + PANEL_ALTO_ESTIMADO > window.innerHeight) {
      top = rect.top + window.scrollY - PANEL_ALTO_ESTIMADO - 4;
    }
    setPanelAbierto({ fecha, columna, top, left });
  };

  const toggleOperarioCelda = async (operarioId) => {
    if (!panelAbierto) return;
    const { fecha, columna } = panelAbierto;
    const enVacaciones = vacacionesSet.has(`${operarioId}|${fecha}`);
    if (enVacaciones) {
      toast.warning("Este operario tiene vacaciones o día libre aprobado ese día");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        operario_id: operarioId,
        fecha,
        destino_cliente_id: columna.tipo === "cliente" ? columna.cliente_id : null,
        destino_libre: columna.tipo === "libre" ? columna.etiqueta : null,
      };
      const res = await axios.post(`${API}/planificacion/celda/toggle`, payload);
      if (res.data.accion === "added") {
        setAsignaciones((prev) => [
          ...prev,
          { id: `temp-${Date.now()}`, ...payload },
        ]);
      } else {
        setAsignaciones((prev) =>
          prev.filter(
            (a) =>
              !(
                a.operario_id === operarioId &&
                a.fecha === fecha &&
                a.destino_cliente_id === payload.destino_cliente_id &&
                a.destino_libre === payload.destino_libre
              )
          )
        );
      }
    } catch (err) {
      console.error("Error asignando operario:", err);
      const detail = err?.response?.data?.detail;
      toast.error(detail || "No se pudo guardar la asignación");
      await cargarRejilla();
    } finally {
      setGuardando(false);
    }
  };

  const abrirNuevaColumna = () => {
    setNuevaColumnaTipo("cliente");
    setNuevaColumnaClienteId("");
    setNuevaColumnaEtiqueta("");
    setDialogColumnaOpen(true);
  };

  const crearColumna = async () => {
    if (nuevaColumnaTipo === "cliente" && !nuevaColumnaClienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (nuevaColumnaTipo === "libre" && !nuevaColumnaEtiqueta.trim()) {
      toast.error("Escribe una etiqueta");
      return;
    }
    setCreandoColumna(true);
    try {
      await axios.post(`${API}/planificacion/columnas`, {
        tipo: nuevaColumnaTipo,
        cliente_id: nuevaColumnaTipo === "cliente" ? nuevaColumnaClienteId : null,
        etiqueta_libre: nuevaColumnaTipo === "libre" ? nuevaColumnaEtiqueta.trim() : null,
      });
      toast.success("Columna añadida");
      setDialogColumnaOpen(false);
      await cargarRejilla();
    } catch (err) {
      console.error("Error creando columna:", err);
      toast.error("Error al crear la columna");
    } finally {
      setCreandoColumna(false);
    }
  };

  const eliminarColumna = async () => {
    if (!columnaABorrar) return;
    try {
      await axios.delete(`${API}/planificacion/columnas/${columnaABorrar.id}`);
      toast.success("Columna eliminada");
      setColumnaABorrar(null);
      await cargarRejilla();
    } catch (err) {
      console.error("Error eliminando columna:", err);
      toast.error("Error al eliminar la columna");
    }
  };

  const operariosDelPanel = panelAbierto
    ? asignacionesPorCelda[panelAbierto.fecha]?.[panelAbierto.columna.id] || []
    : [];
  const idsAsignadosPanel = new Set(operariosDelPanel.map((a) => a.operario_id));

  return (
    <div data-testid="planificacion-page">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Calendar className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Planificación
            </h1>
            <p className="text-sm text-slate-500">Quién va a cada sitio, día a día</p>
          </div>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={abrirNuevaColumna}
            className="border-slate-200"
            data-testid="nueva-columna-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Añadir columna
          </Button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={irMesAnterior} className="h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-slate-900 min-w-[160px] text-center">
            {MESES_ES[month]} {year}
          </span>
          <Button variant="ghost" size="sm" onClick={irMesSiguiente} className="h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={irHoy} className="border-slate-200">
          Hoy
        </Button>
      </div>

      {!isAdmin && (
        <p className="text-xs text-slate-400 bg-slate-50 rounded-lg px-3 py-2 mb-3">
          Vista de solo lectura. Solo un administrador puede asignar operarios.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : (
        <div className="border border-slate-200 rounded-lg overflow-auto max-w-full">
          <table className="border-collapse text-xs min-w-max">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 bg-slate-50 border-b border-r border-slate-200 px-2 py-2 text-center font-medium text-slate-600 w-12">
                  Día
                </th>
                {columnas.map((c) => (
                  <th
                    key={c.id}
                    className="sticky top-0 z-10 border-b border-l border-slate-200 px-2 py-2 text-center font-medium text-slate-700 min-w-[110px] group"
                    style={{ backgroundColor: c.color_fondo || "#f8fafc" }}
                  >
                    <div className="flex items-center justify-center gap-1">
                      <span className="truncate">{c.etiqueta}</span>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => setColumnaABorrar(c)}
                          className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-opacity"
                          data-testid={`borrar-columna-${c.id}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                {isAdmin && (
                  <th className="sticky top-0 z-10 border-b border-l border-slate-200 bg-white px-2 py-2 min-w-[90px]">
                    <button
                      type="button"
                      onClick={abrirNuevaColumna}
                      className="inline-flex items-center gap-1 text-indigo-600 hover:text-indigo-800 font-medium"
                      data-testid="anadir-columna-en-tabla-btn"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Columna
                    </button>
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {diasDelMes.map((fecha) => {
                const numero = Number(fecha.split("-")[2]);
                const esHoy = fecha === formatDateString(new Date());
                return (
                  <tr key={fecha} className="odd:bg-white even:bg-slate-50/50">
                    <td
                      className={`sticky left-0 z-10 bg-inherit border-r border-slate-200 px-2 py-1 text-center ${
                        esHoy ? "font-bold text-indigo-600" : "text-slate-500"
                      }`}
                    >
                      {numero}
                      <span className="text-[9px] text-slate-400 ml-1">
                        {diaSemanaCorto(fecha)}
                      </span>
                    </td>
                    {columnas.map((c) => {
                      const asignados = asignacionesPorCelda[fecha]?.[c.id] || [];
                      const activa =
                        panelAbierto?.fecha === fecha && panelAbierto?.columna?.id === c.id;
                      return (
                        <td key={c.id} className="border-l border-slate-100 p-0">
                          <button
                            type="button"
                            onClick={(e) => abrirPanel(e, fecha, c)}
                            disabled={!isAdmin}
                            className={`w-full min-h-[30px] flex flex-wrap items-center justify-center gap-0.5 px-1 py-1 cursor-pointer disabled:cursor-default ${
                              activa ? "bg-indigo-50" : "hover:bg-slate-50"
                            }`}
                            data-testid={`celda-${c.id}-${fecha}`}
                          >
                            {asignados.map((a) => {
                              const op = operariosPorId[a.operario_id];
                              if (!op) return null;
                              return (
                                <span
                                  key={a.operario_id}
                                  className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold"
                                  style={{ backgroundColor: op.color || "#3B82F6" }}
                                  title={op.name}
                                >
                                  {op.abreviatura || op.name?.slice(0, 2).toUpperCase()}
                                </span>
                              );
                            })}
                          </button>
                        </td>
                      );
                    })}
                    {isAdmin && <td className="border-l border-slate-100 bg-white" />}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {!loading && columnas.length === 0 && (
        <p className="text-xs text-slate-400 text-center mt-3">
          Todavía no hay columnas.{" "}
          {isAdmin ? 'Usa el botón "Columna" al final de la cabecera para añadir la primera.' : ""}
        </p>
      )}

      {/* Panel flotante rapido: elegir operarios para una celda */}
      {panelAbierto && (
        <div
          ref={panelRef}
          className="fixed z-50 bg-white border border-slate-200 rounded-lg shadow-lg p-2 w-[220px] max-h-[280px] overflow-y-auto"
          style={{ top: panelAbierto.top, left: panelAbierto.left }}
          data-testid="panel-operarios-rapido"
        >
          <p className="text-[10px] text-slate-400 truncate mb-1.5 px-0.5">
            {panelAbierto.columna.etiqueta} ·{" "}
            {new Date(panelAbierto.fecha + "T00:00:00").toLocaleDateString("es-ES", {
              day: "numeric",
              month: "short",
            })}
          </p>
          <div className="space-y-0.5">
            {operarios.map((op) => {
              const asignado = idsAsignadosPanel.has(op.user_id);
              const enVacaciones = vacacionesSet.has(`${op.user_id}|${panelAbierto.fecha}`);
              return (
                <button
                  type="button"
                  key={op.user_id}
                  onClick={() => !enVacaciones && toggleOperarioCelda(op.user_id)}
                  disabled={guardando || enVacaciones}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-xs transition-colors ${
                    enVacaciones
                      ? "opacity-40 cursor-not-allowed"
                      : asignado
                      ? "bg-indigo-50"
                      : "hover:bg-slate-50"
                  }`}
                  data-testid={`panel-operario-${op.user_id}`}
                >
                  <span
                    className="w-4 h-4 rounded-full flex items-center justify-center text-white text-[7px] font-bold shrink-0"
                    style={{ backgroundColor: op.color || "#3B82F6" }}
                  >
                    {op.abreviatura || op.name?.slice(0, 2).toUpperCase()}
                  </span>
                  <span className="truncate flex-1">{op.name}</span>
                  {enVacaciones && <Lock className="w-3 h-3 text-slate-400 shrink-0" />}
                  {asignado && !enVacaciones && (
                    <Check className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Dialogo: nueva columna */}
      <Dialog open={dialogColumnaOpen} onOpenChange={setDialogColumnaOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Nueva columna</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setNuevaColumnaTipo("cliente")}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  nuevaColumnaTipo === "cliente"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                Cliente
              </button>
              <button
                type="button"
                onClick={() => setNuevaColumnaTipo("libre")}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  nuevaColumnaTipo === "libre"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                Categoría libre
              </button>
            </div>

            {nuevaColumnaTipo === "cliente" ? (
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={nuevaColumnaClienteId} onValueChange={setNuevaColumnaClienteId}>
                  <SelectTrigger data-testid="nueva-columna-cliente-select">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {clientesDisponibles.map((cl) => (
                      <SelectItem key={cl.id} value={cl.id}>
                        {cl.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label htmlFor="nueva-columna-etiqueta">Etiqueta</Label>
                <Input
                  id="nueva-columna-etiqueta"
                  value={nuevaColumnaEtiqueta}
                  onChange={(e) => setNuevaColumnaEtiqueta(e.target.value)}
                  placeholder="Ej. Ruta, Oficina, Formación..."
                  data-testid="nueva-columna-etiqueta-input"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogColumnaOpen(false)} disabled={creandoColumna}>
              Cancelar
            </Button>
            <Button
              onClick={crearColumna}
              disabled={creandoColumna}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-columna-btn"
            >
              {creandoColumna ? "Creando..." : "Crear columna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!columnaABorrar} onOpenChange={(open) => !open && setColumnaABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta columna?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-semibold">{columnaABorrar?.etiqueta}</span>.
              Las asignaciones ya guardadas para esta columna dejarán de mostrarse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarColumna} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PlanificacionPage;
