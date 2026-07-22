import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Plus,
  X,
  Search,
  Trash2,
  Users,
  CalendarDays,
  Calendar as CalendarIcon,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];
const MONTHS_SHORT = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const DIFICULTAD_DOT = {
  facil: "bg-emerald-500",
  media: "bg-orange-300",
  dificil: "bg-red-500",
};

// Misma logica de rejilla que el calendario de equipo (MyCalendarPage), para
// mantener el mismo criterio visual: semana empieza en lunes, 42 celdas.
const getDaysInMonth = (year, month) => {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const daysInMonth = lastDay.getDate();

  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;

  const days = [];
  const prevMonth = new Date(year, month, 0);
  for (let i = startDay - 1; i >= 0; i--) {
    days.push({
      date: prevMonth.getDate() - i,
      isCurrentMonth: false,
      fullDate: new Date(year, month - 1, prevMonth.getDate() - i),
    });
  }
  for (let i = 1; i <= daysInMonth; i++) {
    days.push({ date: i, isCurrentMonth: true, fullDate: new Date(year, month, i) });
  }
  const remaining = 42 - days.length;
  for (let i = 1; i <= remaining; i++) {
    days.push({
      date: i,
      isCurrentMonth: false,
      fullDate: new Date(year, month + 1, i),
    });
  }
  return days;
};

const formatDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const emptyForm = {
  location_id: "",
  fecha: "",
  horas: "",
  operarios_ids: [],
  operarios_texto_libre: "",
  notas: "",
};

const ClientLocationsCalendarPage = () => {
  const { slug } = useParams();
  const navigate = useNavigate();

  const [cliente, setCliente] = useState(null);
  const [ubicaciones, setUbicaciones] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [visitas, setVisitas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // "month" | "year"

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editando, setEditando] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const [dialogUbicacionOpen, setDialogUbicacionOpen] = useState(false);
  const [buscarUbicacion, setBuscarUbicacion] = useState("");
  const [popoverOperariosOpen, setPopoverOperariosOpen] = useState(false);
  const [buscarOperario, setBuscarOperario] = useState("");
  const [mostrarInputLibre, setMostrarInputLibre] = useState(false);
  const [nombreLibre, setNombreLibre] = useState("");

  const [aBorrar, setABorrar] = useState(null);
  const [borrando, setBorrando] = useState(false);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const cargarBase = async () => {
    try {
      const [cRes, uRes, opsRes] = await Promise.all([
        axios.get(`${API}/clients/${slug}`),
        axios.get(`${API}/clients/${slug}/locations`),
        axios.get(`${API}/users/operarios`).catch(() => ({ data: [] })),
      ]);
      setCliente(cRes.data);
      setUbicaciones(uRes.data);
      setOperarios(opsRes.data);
    } catch (err) {
      console.error("Error cargando datos base:", err);
      toast.error("Error al cargar ubicaciones");
    }
  };

  const cargarVisitas = async () => {
    setLoading(true);
    try {
      const desde = formatDateString(new Date(year, 0, 1));
      const hasta = formatDateString(new Date(year + 1, 0, 1));
      const res = await axios.get(`${API}/clients/${slug}/visits`, {
        params: { desde, hasta },
      });
      setVisitas(res.data);
    } catch (err) {
      console.error("Error cargando visitas:", err);
      toast.error("Error al cargar las visitas del año");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarBase();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  useEffect(() => {
    cargarVisitas();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, year]);

  const operariosPorId = useMemo(() => {
    const map = {};
    operarios.forEach((o) => (map[o.user_id] = o.name));
    return map;
  }, [operarios]);

  const visitasPorDia = useMemo(() => {
    const map = {};
    visitas.forEach((v) => {
      if (!map[v.fecha]) map[v.fecha] = [];
      map[v.fecha].push(v);
    });
    return map;
  }, [visitas]);


  const days = getDaysInMonth(year, month);

  const irMesAnterior = () => setCurrentDate(new Date(year, month - 1, 1));
  const irMesSiguiente = () => setCurrentDate(new Date(year, month + 1, 1));
  const irHoy = () => setCurrentDate(new Date());
  const irAnoAnterior = () => setCurrentDate(new Date(year - 1, month, 1));
  const irAnoSiguiente = () => setCurrentDate(new Date(year + 1, month, 1));

  const resetForm = () => {
    setForm(emptyForm);
    setBuscarUbicacion("");
    setBuscarOperario("");
    setMostrarInputLibre(false);
    setNombreLibre("");
  };

  const abrirNuevaVisita = (fecha) => {
    setEditando(null);
    resetForm();
    setForm((f) => ({ ...f, fecha: fecha || formatDateString(new Date()) }));
    setDialogOpen(true);
  };

  const abrirEditarVisita = (v) => {
    setEditando(v);
    setForm({
      location_id: v.client_location_id,
      fecha: v.fecha,
      horas: v.horas,
      operarios_ids: v.operarios_ids || [],
      operarios_texto_libre: v.operarios_texto_libre || "",
      notas: v.notas || "",
    });
    setBuscarUbicacion("");
    setBuscarOperario("");
    setMostrarInputLibre(false);
    setNombreLibre("");
    setDialogOpen(true);
  };

  const ubicacionSeleccionada = ubicaciones.find((u) => u.id === form.location_id);
  const ubicacionesFiltradas = ubicaciones.filter((u) =>
    u.nombre.toLowerCase().includes(buscarUbicacion.toLowerCase())
  );
  const operariosFiltrados = operarios.filter((o) =>
    o.name.toLowerCase().includes(buscarOperario.toLowerCase())
  );
  const operariosLibres = form.operarios_texto_libre
    ? form.operarios_texto_libre.split(",").map((n) => n.trim()).filter(Boolean)
    : [];

  const toggleOperario = (userId) => {
    setForm((f) => ({
      ...f,
      operarios_ids: f.operarios_ids.includes(userId)
        ? f.operarios_ids.filter((id) => id !== userId)
        : [...f.operarios_ids, userId],
    }));
  };

  const anadirOperarioLibre = () => {
    const nombre = nombreLibre.trim();
    if (!nombre) return;
    if (operariosLibres.some((n) => n.toLowerCase() === nombre.toLowerCase())) {
      toast.warning("Ese nombre ya está añadido");
      return;
    }
    setForm((f) => ({
      ...f,
      operarios_texto_libre: [...operariosLibres, nombre].join(", "),
    }));
    setNombreLibre("");
    setMostrarInputLibre(false);
  };

  const quitarOperarioLibre = (nombre) => {
    setForm((f) => ({
      ...f,
      operarios_texto_libre: operariosLibres.filter((n) => n !== nombre).join(", "),
    }));
  };

  const guardar = async () => {
    if (!form.location_id) {
      toast.error("Selecciona una ubicación");
      return;
    }
    if (!form.fecha) {
      toast.error("Falta la fecha");
      return;
    }
    if (form.horas === "" || Number(form.horas) < 0) {
      toast.error("Indica las horas de la visita");
      return;
    }
    setGuardando(true);
    try {
      const payload = {
        fecha: form.fecha,
        horas: Number(form.horas),
        operarios_ids: form.operarios_ids,
        operarios_texto_libre: form.operarios_texto_libre,
        notas: form.notas.trim(),
      };
      if (editando) {
        await axios.put(`${API}/visits/${editando.id}`, payload);
        toast.success("Visita actualizada");
      } else {
        await axios.post(`${API}/locations/${form.location_id}/visits`, payload);
        toast.success("Visita registrada");
      }
      setDialogOpen(false);
      await cargarVisitas();
    } catch (err) {
      console.error("Error guardando visita:", err);
      toast.error("Error al guardar la visita");
    } finally {
      setGuardando(false);
    }
  };

  const eliminar = async () => {
    if (!aBorrar) return;
    setBorrando(true);
    try {
      await axios.delete(`${API}/visits/${aBorrar.id}`);
      toast.success("Visita eliminada");
      setABorrar(null);
      setDialogOpen(false);
      await cargarVisitas();
    } catch (err) {
      console.error("Error eliminando visita:", err);
      toast.error("Error al eliminar la visita");
    } finally {
      setBorrando(false);
    }
  };

  return (
    <div data-testid="client-locations-calendar-page">
      <Button
        variant="ghost"
        onClick={() => navigate(`/clients/${slug}/locations`)}
        className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a ubicaciones
      </Button>

      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <MapPin className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Calendario de visitas
            </h1>
            <p className="text-sm text-slate-500">{cliente?.nombre}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex gap-1 border border-slate-200 rounded-lg p-0.5">
            <Button
              variant={viewMode === "month" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("month")}
              className={viewMode === "month" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
            >
              <CalendarIcon className="w-4 h-4 mr-1.5" />
              Mes
            </Button>
            <Button
              variant={viewMode === "year" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("year")}
              className={viewMode === "year" ? "bg-indigo-600 hover:bg-indigo-700" : ""}
              data-testid="vista-anual-btn"
            >
              <CalendarDays className="w-4 h-4 mr-1.5" />
              Año
            </Button>
          </div>
          <Button
            onClick={() => abrirNuevaVisita(null)}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="nueva-visita-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva visita
          </Button>
        </div>
      </div>

      {viewMode === "month" && (
        <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={irMesAnterior} className="h-8 w-8 p-0">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <span className="font-semibold text-slate-900 min-w-[160px] text-center">
            {MONTHS[month]} {year}
          </span>
          <Button variant="ghost" size="sm" onClick={irMesSiguiente} className="h-8 w-8 p-0">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={irHoy} className="border-slate-200">
          Hoy
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-px bg-slate-100 rounded-lg overflow-hidden border border-slate-100">
        {WEEKDAYS.map((d) => (
          <div
            key={d}
            className="bg-slate-50 text-center text-xs font-medium text-slate-500 py-2"
          >
            {d}
          </div>
        ))}
        {days.map((day, i) => {
          const fecha = formatDateString(day.fullDate);
          const visitasDelDia = visitasPorDia[fecha] || [];
          const esHoy = fecha === formatDateString(new Date());
          return (
            <div
              key={i}
              className={`bg-white min-h-[110px] p-1.5 flex flex-col gap-1 ${
                !day.isCurrentMonth ? "opacity-40" : ""
              }`}
              data-testid={`dia-${fecha}`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-medium ${
                    esHoy
                      ? "bg-indigo-600 text-white rounded-full w-5 h-5 flex items-center justify-center"
                      : "text-slate-500"
                  }`}
                >
                  {day.date}
                </span>
                <button
                  type="button"
                  onClick={() => abrirNuevaVisita(fecha)}
                  className="text-slate-300 hover:text-indigo-600"
                  data-testid={`anadir-visita-${fecha}`}
                >
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="space-y-1 overflow-y-auto">
                {visitasDelDia.map((v) => (
                  <button
                    type="button"
                    key={v.id}
                    onClick={() => abrirEditarVisita(v)}
                    className="w-full text-left px-1.5 py-1 rounded bg-indigo-50 hover:bg-indigo-100 transition-colors"
                    data-testid={`visita-${v.id}`}
                  >
                    <div className="flex items-center gap-1">
                      {v.location_dificultad && (
                        <span
                          className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                            DIFICULTAD_DOT[v.location_dificultad] || "bg-slate-300"
                          }`}
                        />
                      )}
                      <span className="text-[11px] font-medium text-indigo-900 truncate">
                        {v.location_nombre}
                      </span>
                      {v.location_referencia_cliente && (
                        <span className="text-[9px] text-indigo-400 font-mono shrink-0">
                          {v.location_referencia_cliente}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-indigo-600 font-medium">
                      {v.num_operarios} {v.num_operarios === 1 ? "operario" : "operarios"} · {v.horas_totales}h
                    </span>
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
        </>
      )}

      {viewMode === "year" && (
        <>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" onClick={irAnoAnterior} className="h-8 w-8 p-0">
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="font-semibold text-slate-900 min-w-[100px] text-center">
                {year}
              </span>
              <Button variant="ghost" size="sm" onClick={irAnoSiguiente} className="h-8 w-8 p-0">
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
            <Button variant="outline" size="sm" onClick={irHoy} className="border-slate-200">
              Hoy
            </Button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {MONTHS_SHORT.map((nombreMes, monthIdx) => {
              const diasMes = getDaysInMonth(year, monthIdx);
              return (
                <Card key={monthIdx} className="border-slate-100 shadow-sm">
                  <CardContent className="p-3">
                    <button
                      type="button"
                      onClick={() => {
                        setCurrentDate(new Date(year, monthIdx, 1));
                        setViewMode("month");
                      }}
                      className="text-sm font-semibold text-slate-700 hover:text-indigo-600 mb-1.5 block"
                    >
                      {MONTHS[monthIdx]}
                    </button>
                    <div className="grid grid-cols-7 gap-px">
                      {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                        <div key={d} className="text-[8px] text-center text-slate-400 font-medium">
                          {d}
                        </div>
                      ))}
                      {diasMes.map((day, i) => {
                        const fecha = formatDateString(day.fullDate);
                        const tieneVisitas = (visitasPorDia[fecha] || []).length > 0;
                        const esHoy = fecha === formatDateString(new Date());
                        return (
                          <div
                            key={i}
                            className={`aspect-square text-[9px] flex items-center justify-center rounded-sm ${
                              !day.isCurrentMonth
                                ? "text-slate-300"
                                : esHoy
                                ? "bg-red-100 text-red-600 font-bold"
                                : tieneVisitas
                                ? "bg-indigo-600 text-white font-bold"
                                : "text-slate-600"
                            }`}
                            title={tieneVisitas ? `${(visitasPorDia[fecha] || []).length} visita(s)` : ""}
                          >
                            {day.date}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </>
      )}


      {loading && (
        <p className="text-xs text-slate-400 text-center mt-3">Cargando visitas...</p>
      )}

      {/* Dialogo crear/editar visita */}
      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editando ? "Editar visita" : "Nueva visita"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Ubicación</Label>
              {!editando ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setDialogUbicacionOpen(true)}
                  className="w-full justify-start text-slate-600 font-normal border-slate-200"
                  data-testid="visita-ubicacion-trigger"
                >
                  <Search className="w-4 h-4 mr-2" />
                  {ubicacionSeleccionada
                    ? `${ubicacionSeleccionada.nombre}${
                        ubicacionSeleccionada.referencia_cliente
                          ? ` · ${ubicacionSeleccionada.referencia_cliente}`
                          : ""
                      }`
                    : "Buscar ubicación..."}
                </Button>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-slate-50 border border-slate-200 text-sm text-slate-700">
                  <MapPin className="w-4 h-4 text-slate-400" />
                  {ubicaciones.find((u) => u.id === form.location_id)?.nombre ||
                    "Ubicación"}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="visita-fecha">Fecha</Label>
                <Input
                  id="visita-fecha"
                  type="date"
                  value={form.fecha}
                  onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                  data-testid="visita-fecha-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="visita-horas">Horas</Label>
                <Input
                  id="visita-horas"
                  type="number"
                  min="0"
                  step="0.5"
                  value={form.horas}
                  onChange={(e) => setForm((f) => ({ ...f, horas: e.target.value }))}
                  data-testid="visita-horas-input"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label className="inline-flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-slate-400" />
                Operarios
              </Label>

              {(form.operarios_ids.length > 0 || operariosLibres.length > 0) && (
                <div className="flex flex-wrap gap-1.5">
                  {form.operarios_ids.map((id) => (
                    <span
                      key={id}
                      className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-700 text-xs font-medium px-2 py-1 rounded-full"
                    >
                      {operariosPorId[id] || "Operario"}
                      <button type="button" onClick={() => toggleOperario(id)}>
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                  {operariosLibres.map((nombre) => (
                    <span
                      key={nombre}
                      className="inline-flex items-center gap-1 bg-amber-50 text-amber-700 text-xs font-medium px-2 py-1 rounded-full border border-dashed border-amber-300"
                    >
                      {nombre}
                      <button type="button" onClick={() => quitarOperarioLibre(nombre)}>
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
                  >
                    <Search className="w-4 h-4 mr-2" />
                    Buscar operario registrado...
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-72" align="start">
                  <div className="p-2 border-b border-slate-100">
                    <Input
                      placeholder="Buscar..."
                      value={buscarOperario}
                      onChange={(e) => setBuscarOperario(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="max-h-56 overflow-y-auto p-1">
                    {operariosFiltrados.map((o) => (
                      <button
                        type="button"
                        key={o.user_id}
                        onClick={() => toggleOperario(o.user_id)}
                        className="w-full px-2 py-1.5 rounded-md hover:bg-slate-50 text-sm text-left truncate"
                      >
                        {o.name}
                      </button>
                    ))}
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
                  />
                  <Button type="button" size="sm" onClick={anadirOperarioLibre}>
                    Añadir
                  </Button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setMostrarInputLibre(true)}
                  className="text-xs text-slate-500 hover:text-indigo-600"
                >
                  + Añadir operario no registrado
                </button>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="visita-notas">Notas (opcional)</Label>
              <Textarea
                id="visita-notas"
                value={form.notas}
                onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex items-center justify-between sm:justify-between">
            {editando ? (
              <Button
                type="button"
                variant="ghost"
                onClick={() => setABorrar(editando)}
                disabled={guardando}
                className="text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
                Cancelar
              </Button>
              <Button
                onClick={guardar}
                disabled={guardando}
                className="bg-indigo-600 hover:bg-indigo-700 text-white"
                data-testid="guardar-visita-btn"
              >
                {guardando ? "Guardando..." : editando ? "Guardar cambios" : "Registrar visita"}
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo dedicado para elegir ubicacion (Fase 10): antes era un
          Popover anidado dentro de este mismo Dialog, y en movil el
          scroll de la lista de 39 estaciones no funcionaba bien. Un
          Dialog independiente usa el mismo patron de scroll que ya
          funciona correctamente en el Dialog principal (max-h + 
          overflow-y-auto), sin el conflicto de scroll anidado. */}
      <Dialog open={dialogUbicacionOpen} onOpenChange={setDialogUbicacionOpen}>
        <DialogContent className="max-w-md max-h-[80vh] flex flex-col p-0">
          <DialogHeader className="p-4 pb-2">
            <DialogTitle>Elegir ubicación</DialogTitle>
          </DialogHeader>
          <div className="px-4 pb-2">
            <Input
              placeholder="Buscar por nombre o código..."
              value={buscarUbicacion}
              onChange={(e) => setBuscarUbicacion(e.target.value)}
              autoFocus
              data-testid="buscar-ubicacion-dialog-input"
            />
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-2">
            {ubicacionesFiltradas.length === 0 ? (
              <p className="text-sm text-slate-400 p-4 text-center">Sin resultados</p>
            ) : (
              ubicacionesFiltradas.map((u) => (
                <button
                  type="button"
                  key={u.id}
                  onClick={() => {
                    setForm((f) => ({ ...f, location_id: u.id }));
                    setDialogUbicacionOpen(false);
                    setBuscarUbicacion("");
                  }}
                  className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 text-left"
                  data-testid={`ubicacion-opcion-${u.id}`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    {u.dificultad && (
                      <span
                        className={`w-2 h-2 rounded-full shrink-0 ${
                          DIFICULTAD_DOT[u.dificultad] || "bg-slate-300"
                        }`}
                      />
                    )}
                    <span className="text-sm truncate">
                      {u.nombre}
                      {u.referencia_cliente && (
                        <span className="text-slate-400 font-mono ml-1.5">
                          {u.referencia_cliente}
                        </span>
                      )}
                    </span>
                  </div>
                  {u.visitas_realizadas_ano > 0 && (
                    <span className="text-[10px] text-slate-400 shrink-0">
                      {u.horas_estimadas_ano}h est. · {u.horas_realizadas_ano}h real
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta visita?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará del calendario y dejará de contar en el total de visitas
              realizadas. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminar}
              disabled={borrando}
              className="bg-red-600 hover:bg-red-700"
            >
              {borrando ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ClientLocationsCalendarPage;
