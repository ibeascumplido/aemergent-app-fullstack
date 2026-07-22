import { useEffect, useState, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Sun,
  Palmtree,
  Check,
  X,
  Clock,
  Users,
  Calendar as CalendarIcon,
  Filter,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const AdminCalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState("month");
  const [vacaciones, setVacaciones] = useState([]);
  const [users, setUsers] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState("all");
  
  // Modal for approve/reject
  const [selectedVacacion, setSelectedVacacion] = useState(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [rejectComment, setRejectComment] = useState("");
  const [pendingCount, setPendingCount] = useState(0);

  const fetchVacaciones = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/admin/vacaciones`, {
        params: { year }
      });
      setVacaciones(response.data);
      
      // Count pending
      const pending = response.data.filter(v => v.status === "pending").length;
      setPendingCount(pending);
    } catch (error) {
      console.error("Error fetching vacaciones:", error);
    }
  }, [currentDate]);

  const fetchUsers = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/admin/users`);
      const approvedUsers = response.data.filter(u => u.status === "approved");
      setUsers(approvedUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
    }
  }, []);

  const fetchResumen = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/admin/vacaciones/resumen`, {
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
    fetchVacaciones();
    fetchUsers();
    fetchResumen();
  }, [fetchVacaciones, fetchUsers, fetchResumen]);

  const handleApprove = async (vacacionId) => {
    try {
      await axios.post(`${API}/admin/vacaciones/${vacacionId}/approve`);
      toast.success("Solicitud aprobada");
      fetchVacaciones();
      fetchResumen();
      setShowActionModal(false);
      setSelectedVacacion(null);
    } catch (error) {
      toast.error("Error al aprobar");
    }
  };

  const handleReject = async (vacacionId) => {
    try {
      await axios.post(`${API}/admin/vacaciones/${vacacionId}/reject`, null, {
        params: { comment: rejectComment || null }
      });
      toast.success("Solicitud rechazada");
      fetchVacaciones();
      fetchResumen();
      setShowActionModal(false);
      setSelectedVacacion(null);
      setRejectComment("");
    } catch (error) {
      toast.error("Error al rechazar");
    }
  };

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

  const getVacacionesForDate = (dateStr) => {
    let filtered = vacaciones.filter(v => v.fecha === dateStr);
    if (selectedUser !== "all") {
      filtered = filtered.filter(v => v.user_id === selectedUser);
    }
    return filtered;
  };

  const handleVacacionClick = (vacacion) => {
    if (vacacion.status === "pending") {
      setSelectedVacacion(vacacion);
      setShowActionModal(true);
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

  // Build a stable ordered list of user slots (max 12)
  const userSlots = users.slice(0, 12);

  // Render a single day cell with 12 user slots
  const renderDayCell = (day, compact = false) => {
    const dateStr = formatDateString(day.fullDate);
    const dayVacaciones = getVacacionesForDate(dateStr);
    const isTodayDate = isToday(day.fullDate);
    const isWeekend = day.fullDate.getDay() === 0 || day.fullDate.getDay() === 6;

    // Build a map of user_id -> vacacion for quick lookup
    const vacByUser = {};
    dayVacaciones.forEach(v => { vacByUser[v.user_id] = v; });

    if (compact) {
      return (
        <div
          key={dateStr}
          className={`aspect-square text-[10px] flex flex-col items-center justify-center transition-all relative ${
            !day.isCurrentMonth ? "text-slate-300" : 
            isTodayDate ? "bg-red-100 text-red-600 font-bold" :
            isWeekend ? "text-slate-400 bg-slate-50" : "text-slate-700"
          }`}
        >
          <span className="leading-none">{day.date}</span>
          {userSlots.length > 0 && day.isCurrentMonth && (
            <div className="flex gap-px mt-0.5">
              {userSlots.slice(0, 6).map((u) => {
                const v = vacByUser[u.user_id];
                if (!v) return <div key={u.user_id} className="w-1 h-1 rounded-full bg-slate-200" />;
                const isPending = v.status === "pending";
                const isRejected = v.status === "rejected";
                return (
                  <div
                    key={u.user_id}
                    className={`w-1 h-1 rounded-full ${isPending ? "animate-pulse" : ""} ${isRejected ? "opacity-40" : ""}`}
                    style={{ backgroundColor: isPending ? "#F59E0B" : isRejected ? "#EF4444" : u.color || "#3B82F6" }}
                  />
                );
              })}
            </div>
          )}
        </div>
      );
    }

    return (
      <div
        key={dateStr}
        className={`border border-slate-100 transition-all ${
          !day.isCurrentMonth ? "bg-slate-50/60" : 
          isWeekend ? "bg-slate-50/30" : "bg-white"
        } ${isTodayDate ? "ring-2 ring-red-400 ring-inset" : ""}`}
      >
        <div className={`text-[11px] font-medium px-1 pt-0.5 ${
          !day.isCurrentMonth ? "text-slate-400" : 
          isTodayDate ? "text-red-600" : "text-slate-600"
        }`}>
          {day.date}
        </div>
        
        {/* Circulos con iniciales por operario (Fase 10): solo se muestran
            los que tienen algo ese dia - no se reserva hueco para 12
            posibles como antes. Aprobado usa el color del propio usuario. */}
        <div className="flex flex-wrap gap-0.5 px-0.5 pb-0.5 mt-0.5">
          {dayVacaciones.map((v) => {
            const isPendingV = v.status === "pending";
            const isRejectedV = v.status === "rejected";
            const bgColor = isPendingV ? "#F59E0B" : isRejectedV ? "#EF4444" : v.user_color || "#3B82F6";
            const iniciales =
              v.user_abreviatura || (v.user_name || "?").slice(0, 2).toUpperCase();

            return (
              <button
                key={v.id}
                onClick={() => isPendingV && handleVacacionClick(v)}
                className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[8px] font-bold shrink-0 transition-all ${
                  isPendingV ? "animate-pulse cursor-pointer hover:scale-110" :
                  isRejectedV ? "opacity-50 cursor-default" : "cursor-default"
                }`}
                style={{
                  backgroundColor: bgColor,
                  ...(v.tipo === "libre" ? { outline: "2px solid #0f172a", outlineOffset: "1px" } : {}),
                }}
                title={`${v.user_name} - ${v.tipo === "vacacion" ? "Vacaciones" : "Día Libre"} (${v.status})`}
              >
                {iniciales}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-pulse text-slate-400">Cargando...</div>
      </div>
    );
  }

  return (
    <div data-testid="admin-calendar-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Calendarios</h1>
          <p className="text-slate-500 mt-1">Gestiona las solicitudes de vacaciones</p>
        </div>
        <div className="flex items-center gap-3">
          {pendingCount > 0 && (
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-100 text-amber-800 rounded-lg">
              <Clock className="w-4 h-4" />
              <span className="font-medium">{pendingCount} pendiente{pendingCount > 1 ? "s" : ""}</span>
            </div>
          )}
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
      </div>

      {/* Filter by user */}
      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <Filter className="w-4 h-4 text-slate-400" />
            <Label className="text-sm text-slate-600">Filtrar por usuario:</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="Todos los usuarios" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los usuarios</SelectItem>
                {users.map((u) => (
                  <SelectItem key={u.user_id} value={u.user_id}>
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-4 h-4 rounded"
                        style={{ backgroundColor: u.color || "#3B82F6" }}
                      />
                      {u.name}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Resumen Table */}
      <Card className="border-slate-100 shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Users className="w-5 h-5" />
            Resumen de Empleados {currentDate.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Empleado</th>
                  <th className="px-4 py-3 text-center font-semibold text-orange-600" colSpan="3">
                    <div className="flex items-center justify-center gap-1">
                      <Palmtree className="w-4 h-4" />
                      Vacaciones
                    </div>
                  </th>
                  <th className="px-4 py-3 text-center font-semibold text-blue-600" colSpan="3">
                    <div className="flex items-center justify-center gap-1">
                      <Sun className="w-4 h-4" />
                      Días Libres
                    </div>
                  </th>
                </tr>
                <tr className="bg-slate-50/50">
                  <th className="px-4 py-2 text-left text-xs text-slate-500"></th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Aprobados</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Pendientes</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Restantes</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Aprobados</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Pendientes</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Restantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumen.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      No hay empleados aprobados
                    </td>
                  </tr>
                ) : (
                  resumen.map((r) => (
                    <tr key={r.user_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-8 h-8 rounded flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: r.color }}
                          >
                            {r.abreviatura || r.nombre?.slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <span className="font-medium">{r.nombre}</span>
                            <p className="text-xs text-slate-500">{r.email}</p>
                          </div>
                        </div>
                      </td>
                      {/* Vacaciones */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium text-xs">
                          {r.dias_aprobados || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(r.dias_pendientes || 0) > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium text-xs animate-pulse">
                            {r.dias_pendientes}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full font-bold text-xs ${
                          r.dias_restantes < 0 
                            ? "bg-red-100 text-red-700" 
                            : r.dias_restantes <= 5 
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {r.dias_restantes}
                        </span>
                      </td>
                      {/* Días Libres */}
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center px-2 py-1 rounded-full bg-green-100 text-green-700 font-medium text-xs">
                          {r.dias_libres_aprobados || 0}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {(r.dias_libres_pendientes || 0) > 0 ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-medium text-xs animate-pulse">
                            {r.dias_libres_pendientes}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full font-bold text-xs ${
                          r.dias_libres_restantes < 0 
                            ? "bg-red-100 text-red-700" 
                            : r.dias_libres_restantes <= 2 
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-slate-100 text-slate-700"
                        }`}>
                          {r.dias_libres_restantes}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Monthly View */}
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
              <div className="grid grid-cols-7">
                {getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth()).map((day, index) => 
                  renderDayCell(day, false)
                )}
              </div>
            </CardContent>
          </Card>

          {/* User color legend */}
          {userSlots.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="font-medium text-slate-500">Empleados:</span>
              {userSlots.map((u, idx) => (
                <div key={u.user_id} className="flex items-center gap-1.5">
                  <div
                    className="w-3 h-3 rounded-sm"
                    style={{ backgroundColor: u.color || "#3B82F6" }}
                  />
                  <span>{u.abreviatura || u.name?.slice(0, 3)} - {u.name}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Yearly View */}
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
                  <div className="grid grid-cols-7">
                    {getDaysInMonth(currentDate.getFullYear(), monthIndex).map((day, index) => 
                      renderDayCell(day, true)
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Leyenda */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-amber-500 animate-pulse"></div>
          <span>Pendiente (click para aprobar/rechazar)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-slate-400"></div>
          <span>Aprobado (color del propio empleado)</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full bg-red-500 opacity-50"></div>
          <span>Rechazado</span>
        </div>
        <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-4 h-4 rounded-full bg-slate-400" style={{ outline: "2px solid #0f172a", outlineOffset: "1px" }}></div>
          <span>Día libre (mismo color + borde negro)</span>
        </div>
      </div>

      {/* Approve/Reject Modal */}
      <Dialog open={showActionModal} onOpenChange={setShowActionModal}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar Solicitud</DialogTitle>
          </DialogHeader>
          
          {selectedVacacion && (
            <div className="space-y-4">
              <div className="bg-slate-50 rounded-lg p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div
                    className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
                    style={{ backgroundColor: selectedVacacion.user_color || "#3B82F6" }}
                  >
                    {selectedVacacion.user_abreviatura || selectedVacacion.user_name?.slice(0, 2)}
                  </div>
                  <div>
                    <p className="font-medium">{selectedVacacion.user_name}</p>
                    <p className="text-sm text-slate-500">{selectedVacacion.user_email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-slate-500">Tipo</p>
                    <p className="font-medium flex items-center gap-1">
                      {selectedVacacion.tipo === "vacacion" ? (
                        <><Palmtree className="w-4 h-4 text-orange-500" /> Vacaciones</>
                      ) : (
                        <><Sun className="w-4 h-4 text-blue-500" /> Día Libre</>
                      )}
                    </p>
                  </div>
                  <div>
                    <p className="text-slate-500">Fecha</p>
                    <p className="font-medium">
                      {new Date(selectedVacacion.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        weekday: "long",
                        year: "numeric",
                        month: "long",
                        day: "numeric"
                      })}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="comment">Comentario (opcional, solo si rechazas)</Label>
                <Textarea
                  id="comment"
                  value={rejectComment}
                  onChange={(e) => setRejectComment(e.target.value)}
                  placeholder="Ej: Ya hay otro compañero esos días..."
                  rows={2}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => {
                setShowActionModal(false);
                setSelectedVacacion(null);
                setRejectComment("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => handleReject(selectedVacacion?.id)}
              className="bg-red-500 hover:bg-red-600"
            >
              <X className="w-4 h-4 mr-2" />
              Rechazar
            </Button>
            <Button
              onClick={() => handleApprove(selectedVacacion?.id)}
              className="bg-green-600 hover:bg-green-700"
            >
              <Check className="w-4 h-4 mr-2" />
              Aprobar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCalendarPage;
