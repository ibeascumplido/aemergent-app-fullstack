import { useEffect, useState, useCallback } from "react";
import { useAuth } from "../contexts/AuthContext";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Sun,
  Palmtree,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// Status colors
const STATUS_COLORS = {
  pending: "#F59E0B",   // Yellow/Amber
  approved: null,       // Use user's color
  rejected: "#EF4444",  // Red
};

const MyCalendarPage = () => {
  const { user, isPending } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month"); // "month" or "year"
  const [vacaciones, setVacaciones] = useState([]);
  const [resumen, setResumen] = useState(null);
  const [loading, setLoading] = useState(true);
  const [markMode, setMarkMode] = useState("vacacion");

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
    } else {
      setLoading(false);
    }
  }, [currentDate, fetchVacaciones, fetchResumen, isPending]);

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

  const formatDateString = (date) => {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

    // Check if there's an existing vacation
    const existing = vacaciones.find(v => v.fecha === dateStr);
    
    // If approved, cannot modify
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

  // Render month calendar
  const renderMonthCalendar = (year, month, compact = false) => {
    const days = getDaysInMonth(year, month);
    
    // Helper to get background color based on status
    const getStatusColor = (vacInfo) => {
      if (!vacInfo) return null;
      const status = vacInfo.status || "pending";
      if (status === "pending") return STATUS_COLORS.pending;
      if (status === "rejected") return STATUS_COLORS.rejected;
      return user?.color || "#3B82F6"; // approved uses user color
    };

    // Helper: ring style for días libres (always visible, any status)
    const getLibreRingStyle = (vacInfo) => {
      if (!vacInfo || vacInfo.tipo !== "libre") return {};
      const status = vacInfo.status || "pending";
      if (status === "approved") return { outline: "3px solid #0f172a", outlineOffset: "-3px" };
      if (status === "rejected") return { outline: "3px solid #b91c1c", outlineOffset: "-3px" };
      return { outline: "3px solid #d97706", outlineOffset: "-3px" };
    };
    
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
            const isVacacion = vacInfo?.tipo === "vacacion";
            const isLibre = vacInfo?.tipo === "libre";
            const hasAny = isVacacion || isLibre;
            const isTodayDate = isToday(day.fullDate);
            const isWeekend = day.fullDate.getDay() === 0 || day.fullDate.getDay() === 6;
            
            const bgColor = getStatusColor(vacInfo);
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
                  } ${isLibre && isApproved ? "ring-1 ring-inset ring-slate-900" : ""} ${
                    isPendingVac && hasAny ? "animate-pulse" : ""
                  }`}
                  style={hasAny ? { backgroundColor: bgColor, ...getLibreRingStyle(vacInfo) } : {}}
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
                style={hasAny ? { backgroundColor: bgColor, ...getLibreRingStyle(vacInfo) } : {}}
                title={vacInfo?.rejection_comment ? `Rechazado: ${vacInfo.rejection_comment}` : ""}
              >
                <span className={`text-sm font-medium ${hasAny ? "text-white" : ""}`}>
                  {day.date}
                </span>
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
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Mi Calendario</h1>
          <p className="text-slate-500 mt-1">Gestiona tus vacaciones y días libres</p>
        </div>
        <div className="flex gap-2">
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

      {/* Resumen */}
      {resumen && (
        <Card className="border-slate-100 shadow-sm mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-semibold">
              Resumen {currentDate.getFullYear()}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-orange-50 rounded-lg p-4 text-center">
                <Palmtree className="w-6 h-6 text-orange-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase">Vacaciones</p>
                <p className="text-2xl font-bold text-orange-600">
                  {resumen.dias_aprobados || 0}/{resumen.dias_disponibles}
                </p>
                <p className="text-xs text-slate-500">{resumen.dias_restantes} restantes</p>
              </div>
              <div className="bg-amber-50 rounded-lg p-4 text-center">
                <Clock className="w-6 h-6 text-amber-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase">Pendientes</p>
                <p className="text-2xl font-bold text-amber-600">
                  {(resumen.dias_pendientes || 0) + (resumen.dias_libres_pendientes || 0)}
                </p>
                <p className="text-xs text-slate-500">esperando aprobación</p>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 text-center">
                <Sun className="w-6 h-6 text-blue-500 mx-auto mb-2" />
                <p className="text-xs text-slate-500 uppercase">Días Libres</p>
                <p className="text-2xl font-bold text-blue-600">
                  {resumen.dias_libres_aprobados || 0}/{resumen.dias_libres_disponibles}
                </p>
                <p className="text-xs text-slate-500">{resumen.dias_libres_restantes} restantes</p>
              </div>
              <div className="bg-green-50 rounded-lg p-4 text-center col-span-2">
                <p className="text-xs text-slate-500 uppercase mb-1">Tu color</p>
                <div 
                  className="w-10 h-10 rounded-lg mx-auto mb-2 flex items-center justify-center text-white font-bold text-sm"
                  style={{ backgroundColor: user?.color || "#3B82F6" }}
                >
                  {user?.abreviatura || user?.name?.slice(0, 2).toUpperCase()}
                </div>
                <p className="font-medium text-slate-700 text-sm">{user?.name}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modo de marcado */}
      <Card className="border-slate-100 shadow-sm mb-4">
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
                <CardHeader className="pb-2 pt-3 px-3">
                  <CardTitle className="text-sm font-semibold text-center text-slate-700">
                    {monthName}
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2">
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

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-amber-500"></div>
          <span>Pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: user?.color || "#3B82F6" }}></div>
          <span>Vacaciones aprobadas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500"></div>
          <span>Rechazado</span>
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-4 h-4 rounded bg-amber-500" style={{ outline: "3px solid #d97706", outlineOffset: "-3px" }}></div>
          <span>Día libre pendiente</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded" style={{ backgroundColor: user?.color || "#3B82F6", outline: "3px solid #0f172a", outlineOffset: "-3px" }}></div>
          <span>Día libre aprobado</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded bg-red-500" style={{ outline: "3px solid #b91c1c", outlineOffset: "-3px" }}></div>
          <span>Día libre rechazado</span>
        </div>
      </div>
    </div>
  );
};

export default MyCalendarPage;
