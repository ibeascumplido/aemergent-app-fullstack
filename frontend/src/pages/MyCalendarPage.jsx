import { useEffect, useState, useCallback, useMemo } from "react";
import { useAuth } from "../contexts/AuthContext";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  CalendarDays,
  Sun,
  Palmtree,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  MapPin,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const WEEKDAYS_LARGO = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Colores por estado (Fase 10): pendiente = naranja, aceptada = verde,
// rechazada = rojo. Dias libres usan la misma logica pero con un borde
// negro grueso encima, para distinguirlos de las vacaciones.
const STATUS_COLORS = {
  pending: "#F59E0B",
  approved: "#16A34A",
  rejected: "#EF4444",
};

const formatDateString = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
    date.getDate()
  ).padStart(2, "0")}`;

const MyCalendarPage = () => {
  const { user, isPending } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("week"); // "week" | "month" | "year"
  const [vacaciones, setVacaciones] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [misDestinos, setMisDestinos] = useState({}); // { fecha: [nombreDestino,...] }
  const [loading, setLoading] = useState(true);
  const [markMode, setMarkMode] = useState("vacacion");

  const fetchMisDestinos = useCallback(async () => {
    if (!user?.user_id) return;
    try {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      const desde = `${year}-${String(month + 1).padStart(2, "0")}-01`;
      const ultimoDia = new Date(year, month + 1, 0).getDate();
      const hasta = `${year}-${String(month + 1).padStart(2, "0")}-${String(ultimoDia).padStart(2, "0")}`;
      const res = await axios.get(`${API}/planificacion/rejilla`, { params: { desde, hasta } });
      const mapa = {};
      res.data.asignaciones
        .filter((a) => a.operario_id === user.user_id)
        .forEach((a) => {
          const columna = res.data.columnas.find((c) =>
            a.destino_cliente_id
              ? c.tipo === "cliente" && c.cliente_id === a.destino_cliente_id
              : c.tipo === "libre" && c.etiqueta === a.destino_libre
          );
          const nombre = columna?.etiqueta || a.destino_libre || "Sitio";
          if (!mapa[a.fecha]) mapa[a.fecha] = [];
          mapa[a.fecha].push(nombre);
        });
      setMisDestinos(mapa);
    } catch (error) {
      console.error("Error fetching mis destinos:", error);
    }
  }, [currentDate, user]);

  const fetchVacaciones = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/my-vacaciones`, {
        params: { year }
      });
      setVacaciones(response.data);
    } catch (error) {
      console.error("Error fetching vacaciones:", error);
    }
  }, [currentDate]);

  const fetchResumen = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/my-vacaciones/resumen`, {
        params: { year }
      });
      setResumen(response.data);
    } catch (error) {
      console.error("Error fetching resumen:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    if (!isPending) {
      fetchVacaciones();
      fetchResumen();
      fetchMisDestinos();
    } else {
      setLoading(false);
    }
  }, [currentDate, fetchVacaciones, fetchResumen, fetchMisDestinos, isPending]);

  // Proximo dia de vacaciones y proximo dia libre (de hoy en adelante,
  // dentro del año cargado, sin contar las rechazadas)
  const { proximaVacacion, proximoLibre } = useMemo(() => {
    const hoy = formatDateString(new Date());
    const futuras = vacaciones
      .filter((v) => v.fecha >= hoy && v.status !== "rejected")
      .sort((a, b) => a.fecha.localeCompare(b.fecha));
    return {
      proximaVacacion: futuras.find((v) => v.tipo === "vacacion") || null,
      proximoLibre: futuras.find((v) => v.tipo === "libre") || null,
    };
  }, [vacaciones]);

  const formatearFechaCorta = (fecha) =>
    new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", { day: "numeric", month: "short" });

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
      days.push({
        date: i,
        isCurrentMonth: true,
        fullDate: new Date(year, month, i),
      });
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

  const getWeekDays = (date) => {
    const dia = date.getDay(); // 0=domingo
    const offsetLunes = dia === 0 ? -6 : 1 - dia;
    const lunes = new Date(date);
    lunes.setDate(date.getDate() + offsetLunes);
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(lunes);
      d.setDate(lunes.getDate() + i);
      return d;
    });
  };

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const getVacacionInfo = (dateStr) => {
    return vacaciones.find(v => v.fecha === dateStr);
  };

  const toggleVacacion = async (dateStr) => {
    if (isPending) {
      toast.error("Tu cuenta está pendiente de aprobación");
      return;
    }

    const existing = vacaciones.find(v => v.fecha === dateStr);

    if (existing?.status === "approved") {
      toast.error("No puedes modificar vacaciones aprobadas");
      return;
    }

    try {
      const response = await axios.post(`${API}/my-vacaciones`, null, {
        params: { fecha: dateStr, tipo: markMode }
      });

      if (response.data.action === "deleted") {
        setVacaciones(prev => prev.filter(v => v.fecha !== dateStr));
        toast.success("Solicitud cancelada");
      } else if (response.data.action === "created") {
        setVacaciones(prev => [...prev, response.data.vacacion]);
        toast.success("Solicitud enviada (pendiente de aprobación)");
      }

      fetchResumen();
    } catch (error) {
      console.error("Error toggling vacation:", error);
      toast.error(error.response?.data?.detail || "Error al actualizar");
    }
  };

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const handlePrevYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() - 1, currentDate.getMonth(), 1));
  };

  const handleNextYear = () => {
    setCurrentDate(new Date(currentDate.getFullYear() + 1, currentDate.getMonth(), 1));
  };

  const handlePrevWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - 7);
    setCurrentDate(d);
  };

  const handleNextWeek = () => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() + 7);
    setCurrentDate(d);
  };

  // Estilo de un dia segun su vacacion/libre: color de fondo por estado,
  // y si es "libre" un borde negro grueso por encima.
  const estiloDia = (vacInfo) => {
    if (!vacInfo) return {};
    const status = vacInfo.status || "pending";
    const bg = STATUS_COLORS[status];
    const estilo = { backgroundColor: bg };
    if (vacInfo.tipo === "libre") {
      estilo.outline = "3px solid #0f172a";
      estilo.outlineOffset = "-3px";
    }
    return estilo;
  };

  // --- Vista semanal: aqui es donde se ve el destino de trabajo -------

  const renderWeekView = () => {
    const dias = getWeekDays(currentDate);
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2">
        {dias.map((fecha, i) => {
          const dateStr = formatDateString(fecha);
          const vacInfo = getVacacionInfo(dateStr);
          const destinosHoy = misDestinos[dateStr] || [];
          const hasAny = !!vacInfo;
          const isVacacion = vacInfo?.tipo === "vacacion";
          const status = vacInfo?.status || "pending";

          return (
            <Card
              key={dateStr}
              className={`border-slate-100 shadow-sm ${isToday(fecha) ? "ring-2 ring-red-400" : ""}`}
            >
              <CardContent className="p-3">
                <button
                  type="button"
                  onClick={() => toggleVacacion(dateStr)}
                  disabled={isPending || status === "approved"}
                  className="w-full text-left rounded-lg p-2 mb-2 transition-all"
                  style={hasAny ? { ...estiloDia(vacInfo), color: "white" } : {}}
                >
                  <p className={`text-xs font-semibold uppercase ${hasAny ? "text-white/90" : "text-slate-500"}`}>
                    {WEEKDAYS_LARGO[i]}
                  </p>
                  <p className={`text-lg font-bold ${hasAny ? "text-white" : "text-slate-900"}`}>
                    {fecha.getDate()} {MONTHS[fecha.getMonth()].slice(0, 3)}
                  </p>
                  {hasAny && (
                    <p className="text-[11px] text-white/90 flex items-center gap-1 mt-0.5">
                      {isVacacion ? <Palmtree className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                      {isVacacion ? "Vacaciones" : "Día libre"}
                      {status === "pending" && " (pendiente)"}
                      {status === "rejected" && " (rechazado)"}
                    </p>
                  )}
                </button>

                {destinosHoy.length > 0 ? (
                  <div className="space-y-1">
                    {destinosHoy.map((nombre, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-1.5 text-sm text-indigo-700 bg-indigo-50 rounded-lg px-2 py-1.5"
                      >
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span className="truncate font-medium">{nombre}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 px-1">Sin destino asignado</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  };

  // --- Vista mensual (para pedir dias, calendario mas compacto de un vistazo) --

  const renderMonthCalendar = (year, month, compact = false) => {
    const days = getDaysInMonth(year, month);

    return (
      <div className={compact ? "" : "border border-slate-200 rounded-lg overflow-hidden"}>
        {!compact && (
          <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
            {WEEKDAYS.map((day) => (
              <div key={day} className="px-1 py-2 text-center text-xs font-semibold text-slate-600">
                {day}
              </div>
            ))}
          </div>
        )}
        <div className="grid grid-cols-7">
          {days.map((day, index) => {
            const dateStr = formatDateString(day.fullDate);
            const vacInfo = getVacacionInfo(dateStr);
            const destinosHoy = misDestinos[dateStr] || [];
            const isVacacion = vacInfo?.tipo === "vacacion";
            const isLibre = vacInfo?.tipo === "libre";
            const hasAny = isVacacion || isLibre;
            const isTodayDate = isToday(day.fullDate);
            const isWeekend = day.fullDate.getDay() === 0 || day.fullDate.getDay() === 6;

            const status = vacInfo?.status || "pending";
            const isApproved = status === "approved";
            const isPendingVac = status === "pending";
            const isRejected = status === "rejected";

            if (compact) {
              return (
                <button
                  key={index}
                  onClick={() => day.isCurrentMonth && toggleVacacion(dateStr)}
                  disabled={!day.isCurrentMonth || isPending || isApproved}
                  className={`aspect-square text-[10px] flex items-center justify-center transition-all ${
                    !day.isCurrentMonth ? "text-slate-300" :
                    hasAny ? "text-white font-bold" :
                    isTodayDate ? "bg-red-100 text-red-600 font-bold" :
                    isWeekend ? "text-slate-400" : "text-slate-700 hover:bg-slate-100"
                  } ${isPendingVac && hasAny ? "animate-pulse" : ""}`}
                  style={hasAny ? estiloDia(vacInfo) : {}}
                >
                  {day.date}
                </button>
              );
            }

            return (
              <button
                key={index}
                onClick={() => day.isCurrentMonth && toggleVacacion(dateStr)}
                disabled={!day.isCurrentMonth || isPending || isApproved}
                className={`relative min-h-[60px] p-1 border border-slate-100 transition-all ${
                  !day.isCurrentMonth ? "bg-slate-50 text-slate-400" :
                  isWeekend ? "bg-slate-50/50" : "bg-white hover:bg-slate-50"
                } ${isTodayDate ? "ring-2 ring-red-400 ring-inset" : ""} ${
                  hasAny ? "text-white" : ""
                }`}
                style={hasAny ? estiloDia(vacInfo) : {}}
                title={vacInfo?.rejection_comment ? `Rechazado: ${vacInfo.rejection_comment}` : ""}
              >
                <span className={`text-sm font-medium ${hasAny ? "text-white" : ""}`}>
                  {day.date}
                </span>
                {destinosHoy.length > 0 && (
                  <div className="mt-0.5 flex flex-col items-center gap-0.5">
                    {destinosHoy.slice(0, 2).map((nombre, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-0.5 text-[8px] leading-tight px-1 py-0.5 rounded bg-indigo-600 text-white max-w-full truncate"
                        title={nombre}
                      >
                        <MapPin className="w-2 h-2 shrink-0" />
                        <span className="truncate">{nombre}</span>
                      </span>
                    ))}
                  </div>
                )}
                {hasAny && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center gap-0.5">
                    {isVacacion ? <Palmtree className="w-3 h-3" /> : <Sun className="w-3 h-3" />}
                    {isPendingVac && <Clock className="w-3 h-3" />}
                    {isApproved && <CheckCircle className="w-3 h-3" />}
                    {isRejected && <XCircle className="w-3 h-3" />}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Pending approval state
  if (isPending) {
    return (
      <div data-testid="my-calendar-page">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Calendario</h1>
            <p className="text-slate-500 mt-1">Gestiona tus vacaciones y días libres</p>
          </div>
        </div>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-orange-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-orange-800 mb-2">Cuenta pendiente de aprobación</h2>
            <p className="text-orange-700">
              Tu cuenta está siendo revisada por el administrador. Una vez aprobada, podrás gestionar tus vacaciones y días libres.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="my-calendar-page">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Calendario</h1>
          <p className="text-slate-500 mt-1">
            {viewMode === "week" ? "Tu semana: dónde trabajas y tus días libres" : "Gestiona tus vacaciones y días libres"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "week" ? "default" : "outline"}
            onClick={() => setViewMode("week")}
            className={viewMode === "week" ? "bg-red-500 hover:bg-red-600" : ""}
            data-testid="vista-semana-btn"
          >
            <CalendarDays className="w-4 h-4 mr-2" />
            Semana
          </Button>
          <Button
            variant={viewMode === "month" ? "default" : "outline"}
            onClick={() => setViewMode("month")}
            className={viewMode === "month" ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Mes
          </Button>
          <Button
            variant={viewMode === "year" ? "default" : "outline"}
            onClick={() => setViewMode("year")}
            className={viewMode === "year" ? "bg-red-500 hover:bg-red-600" : ""}
          >
            <CalendarIcon className="w-4 h-4 mr-2" />
            Año
          </Button>
        </div>
      </div>

      {/* Vista semanal: prioridad - aqui se ve el destino de trabajo */}
      {viewMode === "week" && (
        <>
          <Card className="border-slate-100 shadow-sm mb-4">
            <CardContent className="p-3">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handlePrevWeek}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-base font-semibold text-slate-900">
                  Semana del {formatearFechaCorta(formatDateString(getWeekDays(currentDate)[0]))}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleNextWeek}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>
          {renderWeekView()}
        </>
      )}

      {/* Vista mensual */}
      {viewMode === "month" && (
        <>
          <Card className="border-slate-100 shadow-sm mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handlePrevMonth}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-xl font-semibold text-slate-900">
                  {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleNextMonth}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b border-slate-100 bg-slate-50">
                {WEEKDAYS.map((day) => (
                  <div key={day} className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase">
                    {day}
                  </div>
                ))}
              </div>
              {renderMonthCalendar(currentDate.getFullYear(), currentDate.getMonth())}
            </CardContent>
          </Card>
        </>
      )}

      {/* Vista anual */}
      {viewMode === "year" && (
        <>
          <Card className="border-slate-100 shadow-sm mb-4">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={handlePrevYear}>
                  <ChevronLeft className="w-5 h-5" />
                </Button>
                <h2 className="text-xl font-semibold text-slate-900">
                  {currentDate.getFullYear()}
                </h2>
                <Button variant="ghost" size="sm" onClick={handleNextYear}>
                  <ChevronRight className="w-5 h-5" />
                </Button>
              </div>
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {MONTHS.map((monthName, monthIndex) => (
              <Card key={monthIndex} className="border-slate-100 shadow-sm">
                <CardContent className="p-2 pt-3">
                  <p className="text-sm font-semibold text-center text-slate-700 mb-1">{monthName}</p>
                  <div className="grid grid-cols-7 mb-1">
                    {["L", "M", "X", "J", "V", "S", "D"].map((d) => (
                      <div key={d} className="text-[8px] text-center text-slate-400 font-medium">
                        {d}
                      </div>
                    ))}
                  </div>
                  {renderMonthCalendar(currentDate.getFullYear(), monthIndex, true)}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Modo de marcado - solo tiene sentido en mes/año, donde se piden dias */}
      {viewMode !== "week" && (
        <Card className="border-slate-100 shadow-sm mt-4">
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <span className="text-sm text-slate-600">Marcar como:</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setMarkMode("vacacion")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    markMode === "vacacion"
                      ? "border-orange-500 bg-orange-50 text-orange-700"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Palmtree className="w-4 h-4" />
                  <span className="font-medium">Vacaciones</span>
                </button>
                <button
                  onClick={() => setMarkMode("libre")}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                    markMode === "libre"
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <Sun className="w-4 h-4" />
                  <span className="font-medium">Día Libre</span>
                </button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Resumen: ahora secundario, mas pequeno, con el proximo dia destacado */}
      {resumen && (
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-orange-50 text-orange-700">
            <Palmtree className="w-3.5 h-3.5" />
            <span className="font-medium">{resumen.dias_restantes}</span>
            <span className="text-orange-500">vacaciones restantes</span>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-50 text-blue-700">
            <Sun className="w-3.5 h-3.5" />
            <span className="font-medium">{resumen.dias_libres_restantes}</span>
            <span className="text-blue-500">libres restantes</span>
          </div>
          {proximaVacacion && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 text-slate-600">
              <CalendarDays className="w-3.5 h-3.5" />
              Próximas vacaciones:{" "}
              <span className="font-medium">{formatearFechaCorta(proximaVacacion.fecha)}</span>
              {proximaVacacion.status === "pending" && " (pendiente)"}
            </div>
          )}
          {proximoLibre && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-slate-50 text-slate-600">
              <CalendarDays className="w-3.5 h-3.5" />
              Próximo día libre:{" "}
              <span className="font-medium">{formatearFechaCorta(proximoLibre.fecha)}</span>
              {proximoLibre.status === "pending" && " (pendiente)"}
            </div>
          )}
        </div>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: STATUS_COLORS.pending }}></div>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: STATUS_COLORS.approved }}></div>
          <span>Aceptada</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded" style={{ backgroundColor: STATUS_COLORS.rejected }}></div>
          <span>Rechazada</span>
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div
            className="w-3.5 h-3.5 rounded"
            style={{ backgroundColor: STATUS_COLORS.approved, outline: "2px solid #0f172a", outlineOffset: "-2px" }}
          ></div>
          <span>Día libre (mismo color + borde negro)</span>
        </div>
      </div>
    </div>
  );
};

export default MyCalendarPage;
