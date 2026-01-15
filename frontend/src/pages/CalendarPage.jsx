import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  Settings,
  Trash2,
  Edit2,
  Sun,
  Palmtree,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
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
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const WEEKDAYS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const PRESET_COLORS = [
  "#3B82F6", "#EF4444", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899",
  "#06B6D4", "#84CC16", "#F97316", "#6366F1", "#14B8A6", "#A855F7",
];

const CalendarPage = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [operarios, setOperarios] = useState([]);
  const [vacaciones, setVacaciones] = useState([]);
  const [resumen, setResumen] = useState([]);
  const [loading, setLoading] = useState(true);
  
  // Modo: "vacacion" o "libre"
  const [markMode, setMarkMode] = useState("vacacion");
  
  // Modal states
  const [showOperariosModal, setShowOperariosModal] = useState(false);
  const [showAddOperarioModal, setShowAddOperarioModal] = useState(false);
  const [editingOperario, setEditingOperario] = useState(null);
  const [deleteOperarioConfirm, setDeleteOperarioConfirm] = useState(null);
  
  // Selected operario for marking
  const [selectedOperario, setSelectedOperario] = useState(null);
  
  // New operario form
  const [newOperario, setNewOperario] = useState({
    nombre: "",
    abreviatura: "",
    color: "#3B82F6",
    dias_vacaciones: 22,
    dias_libres: 6,
  });

  const fetchOperarios = useCallback(async () => {
    try {
      const response = await axios.get(`${API}/operarios`);
      setOperarios(response.data);
      if (response.data.length > 0 && !selectedOperario) {
        setSelectedOperario(response.data[0]);
      }
    } catch (error) {
      console.error("Error fetching operarios:", error);
    }
  }, [selectedOperario]);

  const fetchVacaciones = useCallback(async () => {
    try {
      const month = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`;
      const response = await axios.get(`${API}/vacaciones`, { params: { month } });
      setVacaciones(response.data);
    } catch (error) {
      console.error("Error fetching vacaciones:", error);
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  const fetchResumen = useCallback(async () => {
    try {
      const year = currentDate.getFullYear();
      const response = await axios.get(`${API}/vacaciones/resumen`, { params: { year } });
      setResumen(response.data);
    } catch (error) {
      console.error("Error fetching resumen:", error);
    }
  }, [currentDate]);

  useEffect(() => {
    fetchOperarios();
  }, []);

  useEffect(() => {
    fetchVacaciones();
    fetchResumen();
  }, [currentDate, fetchVacaciones, fetchResumen]);

  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
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

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Get vacation info for operario on date
  const getVacacionInfo = (operarioId, dateStr) => {
    return vacaciones.find(v => v.operario_id === operarioId && v.fecha === dateStr);
  };

  // Toggle vacation/libre for operario on date
  const toggleVacacion = async (operario, dateStr) => {
    if (!operario) return;
    
    try {
      const existing = getVacacionInfo(operario.id, dateStr);
      
      if (existing) {
        // If same type, remove it
        if (existing.tipo === markMode) {
          await axios.delete(`${API}/vacaciones/${operario.id}/${dateStr}`);
          setVacaciones(prev => prev.filter(v => !(v.operario_id === operario.id && v.fecha === dateStr)));
        } else {
          // Different type: remove old, add new
          await axios.delete(`${API}/vacaciones/${operario.id}/${dateStr}`);
          const response = await axios.post(`${API}/vacaciones`, {
            operario_id: operario.id,
            fecha: dateStr,
            tipo: markMode,
          });
          setVacaciones(prev => [
            ...prev.filter(v => !(v.operario_id === operario.id && v.fecha === dateStr)),
            response.data
          ]);
        }
      } else {
        // Add new
        const response = await axios.post(`${API}/vacaciones`, {
          operario_id: operario.id,
          fecha: dateStr,
          tipo: markMode,
        });
        setVacaciones(prev => [...prev, response.data]);
      }
      fetchResumen();
    } catch (error) {
      console.error("Error toggling vacation:", error);
      toast.error("Error al actualizar");
    }
  };

  // Update dias_vacaciones for operario
  const updateDiasVacaciones = async (operarioId, dias) => {
    try {
      await axios.put(`${API}/operarios/${operarioId}`, { dias_vacaciones: parseInt(dias) || 0 });
      fetchResumen();
    } catch (error) {
      console.error("Error updating dias:", error);
    }
  };

  // Update dias_libres for operario
  const updateDiasLibres = async (operarioId, dias) => {
    try {
      await axios.put(`${API}/operarios/${operarioId}`, { dias_libres: parseInt(dias) || 0 });
      fetchResumen();
    } catch (error) {
      console.error("Error updating dias libres:", error);
    }
  };

  // Add/Edit operario
  const handleSaveOperario = async () => {
    if (!newOperario.nombre.trim() || !newOperario.abreviatura.trim()) {
      toast.error("Nombre y abreviatura son obligatorios");
      return;
    }

    try {
      if (editingOperario) {
        await axios.put(`${API}/operarios/${editingOperario.id}`, newOperario);
        toast.success("Operario actualizado");
      } else {
        await axios.post(`${API}/operarios`, newOperario);
        toast.success("Operario creado");
      }
      setShowAddOperarioModal(false);
      setEditingOperario(null);
      setNewOperario({ nombre: "", abreviatura: "", color: "#3B82F6", dias_vacaciones: 22, dias_libres: 6 });
      fetchOperarios();
      fetchResumen();
    } catch (error) {
      console.error("Error saving operario:", error);
      toast.error("Error al guardar operario");
    }
  };

  // Delete operario
  const handleDeleteOperario = async () => {
    if (!deleteOperarioConfirm) return;
    
    try {
      await axios.delete(`${API}/operarios/${deleteOperarioConfirm.id}`);
      toast.success("Operario eliminado");
      setDeleteOperarioConfirm(null);
      if (selectedOperario?.id === deleteOperarioConfirm.id) {
        setSelectedOperario(null);
      }
      fetchOperarios();
      fetchVacaciones();
      fetchResumen();
    } catch (error) {
      console.error("Error deleting operario:", error);
      toast.error("Error al eliminar operario");
    }
  };

  const days = getDaysInMonth(currentDate);

  return (
    <div data-testid="calendar-page">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Calendario de Vacaciones
          </h1>
          <p className="text-slate-500 mt-1">Gestiona las vacaciones de los operarios</p>
        </div>
        <Button
          onClick={() => setShowOperariosModal(true)}
          variant="outline"
          data-testid="manage-operarios-btn"
        >
          <Settings className="w-4 h-4 mr-2" />
          Gestionar Operarios
        </Button>
      </div>

      {/* Tabla resumen de vacaciones */}
      <Card className="border-slate-100 shadow-sm mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-semibold font-['Manrope']">
            Resumen de Vacaciones y Días Libres {currentDate.getFullYear()}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 border-y border-slate-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-slate-600">Operario</th>
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
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Disponibles</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Disfrutados</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Restantes</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Disponibles</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Disfrutados</th>
                  <th className="px-4 py-2 text-center text-xs text-slate-500">Restantes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {resumen.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                      No hay operarios. Añade el primero desde "Gestionar Operarios".
                    </td>
                  </tr>
                ) : (
                  resumen.map((r) => (
                    <tr key={r.operario_id} className="hover:bg-slate-50">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold"
                            style={{ backgroundColor: r.color }}
                          >
                            {r.abreviatura}
                          </div>
                          <span className="font-medium">{r.nombre}</span>
                        </div>
                      </td>
                      {/* Vacaciones */}
                      <td className="px-4 py-3 text-center">
                        <Input
                          type="number"
                          value={r.dias_disponibles}
                          onChange={(e) => updateDiasVacaciones(r.operario_id, e.target.value)}
                          className="w-16 h-8 text-center mx-auto"
                          min="0"
                          data-testid={`dias-disponibles-${r.operario_id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-orange-100 text-orange-700 font-medium">
                          {r.dias_disfrutados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full font-bold ${
                          r.dias_restantes < 0 
                            ? "bg-red-100 text-red-700" 
                            : r.dias_restantes <= 5 
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
                        }`}>
                          {r.dias_restantes}
                        </span>
                      </td>
                      {/* Días Libres */}
                      <td className="px-4 py-3 text-center">
                        <Input
                          type="number"
                          value={r.dias_libres_disponibles}
                          onChange={(e) => updateDiasLibres(r.operario_id, e.target.value)}
                          className="w-16 h-8 text-center mx-auto"
                          min="0"
                          data-testid={`dias-libres-disponibles-${r.operario_id}`}
                        />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-100 text-blue-700 font-medium">
                          {r.dias_libres_disfrutados}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full font-bold ${
                          r.dias_libres_restantes < 0 
                            ? "bg-red-100 text-red-700" 
                            : r.dias_libres_restantes <= 2 
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-green-100 text-green-700"
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

      {/* Selector de operario y modo */}
      {operarios.length > 0 && (
        <Card className="border-slate-100 shadow-sm mb-4">
          <CardContent className="p-4">
            <div className="flex flex-col gap-4">
              {/* Modo de marcado */}
              <div className="flex items-center gap-4">
                <span className="text-sm text-slate-600">Modo:</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setMarkMode("vacacion")}
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 transition-all ${
                      markMode === "vacacion"
                        ? "border-orange-500 bg-orange-50 text-orange-700"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid="mode-vacacion"
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
                    data-testid="mode-libre"
                  >
                    <Sun className="w-4 h-4" />
                    <span className="font-medium">Día Libre</span>
                  </button>
                </div>
              </div>
              
              {/* Selector de operario */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm text-slate-600">Operario:</span>
                {operarios.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => setSelectedOperario(op)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border-2 transition-all ${
                      selectedOperario?.id === op.id
                        ? "border-slate-900 shadow-md"
                        : "border-transparent hover:border-slate-300"
                    }`}
                    style={{ backgroundColor: op.color + "20" }}
                    data-testid={`select-operario-${op.id}`}
                  >
                    <div
                      className="w-4 h-4 rounded"
                      style={{ backgroundColor: op.color }}
                    />
                    <span className="text-sm font-medium">{op.nombre}</span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Calendar Header */}
      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="sm" onClick={handlePrevMonth} data-testid="prev-month-btn">
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <h2 className="text-xl font-semibold text-slate-900 font-['Manrope']" data-testid="current-month">
              {MONTHS[currentDate.getMonth()]} {currentDate.getFullYear()}
            </h2>
            <Button variant="ghost" size="sm" onClick={handleNextMonth} data-testid="next-month-btn">
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Leyenda */}
      {operarios.length > 0 && (
        <div className="flex items-center gap-4 mb-4 flex-wrap">
          {operarios.map((op) => (
            <div key={op.id} className="flex items-center gap-1.5">
              <div
                className="w-4 h-4 rounded text-[10px] font-bold flex items-center justify-center text-white"
                style={{ backgroundColor: op.color }}
              >
                {op.abreviatura}
              </div>
              <span className="text-xs text-slate-600">{op.nombre}</span>
            </div>
          ))}
          <div className="border-l border-slate-300 pl-4 ml-2 flex items-center gap-3">
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-500"></div>
              <span className="text-xs text-slate-600">= Vacaciones</span>
            </div>
            <div className="flex items-center gap-1">
              <div className="w-4 h-4 rounded bg-blue-500 border-2 border-slate-900"></div>
              <span className="text-xs text-slate-600">= Día Libre</span>
            </div>
          </div>
        </div>
      )}

      {/* Calendar Grid */}
      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-0">
          {/* Weekday Headers */}
          <div className="grid grid-cols-7 border-b border-slate-100">
            {WEEKDAYS.map((day) => (
              <div
                key={day}
                className="px-2 py-3 text-center text-xs font-semibold text-slate-600 uppercase tracking-wider bg-slate-50"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7">
            {days.map((day, index) => {
              const dateStr = formatDateString(day.fullDate);
              const isTodayDate = isToday(day.fullDate);
              const isWeekend = day.fullDate.getDay() === 0 || day.fullDate.getDay() === 6;

              return (
                <div
                  key={index}
                  className={`relative min-h-[100px] p-1 border border-slate-100 ${
                    !day.isCurrentMonth ? "bg-slate-50" : isWeekend ? "bg-slate-50/50" : "bg-white"
                  } ${isTodayDate ? "ring-2 ring-indigo-400 ring-inset" : ""}`}
                  data-testid={`calendar-day-${dateStr}`}
                >
                  {/* Day number */}
                  <div
                    className={`text-sm font-medium mb-1 ${
                      isTodayDate
                        ? "w-6 h-6 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs"
                        : day.isCurrentMonth
                        ? "text-slate-900"
                        : "text-slate-400"
                    }`}
                  >
                    {day.date}
                  </div>

                  {/* Grid of 12 slots (4x3) */}
                  <div className="grid grid-cols-4 gap-0.5">
                    {operarios.slice(0, 12).map((op) => {
                      const vacInfo = getVacacionInfo(op.id, dateStr);
                      const isLibre = vacInfo?.tipo === "libre";
                      const isVacacion = vacInfo?.tipo === "vacacion";
                      const hasAny = isLibre || isVacacion;
                      
                      return (
                        <button
                          key={op.id}
                          onClick={() => toggleVacacion(op, dateStr)}
                          className={`aspect-square rounded-sm transition-all hover:scale-110 hover:z-10 relative ${
                            hasAny ? "" : "bg-slate-200 hover:bg-slate-300"
                          } ${isLibre ? "ring-2 ring-slate-900 ring-inset" : ""}`}
                          style={hasAny ? { backgroundColor: op.color } : {}}
                          title={`${op.nombre} - ${isVacacion ? "Vacaciones" : isLibre ? "Día Libre" : "Click para marcar"}`}
                          data-testid={`slot-${dateStr}-${op.id}`}
                        >
                          {hasAny && (
                            <span className="absolute inset-0 flex items-center justify-center text-white text-[8px] font-bold drop-shadow-sm">
                              {op.abreviatura}
                            </span>
                          )}
                        </button>
                      );
                    })}
                    {/* Fill empty slots */}
                    {Array.from({ length: Math.max(0, 12 - operarios.length) }).map((_, i) => (
                      <div
                        key={`empty-${i}`}
                        className="aspect-square rounded-sm bg-slate-100"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Modal: Gestionar Operarios */}
      <Dialog open={showOperariosModal} onOpenChange={setShowOperariosModal}>
        <DialogContent className="sm:max-w-lg" data-testid="operarios-modal">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">Gestionar Operarios</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {operarios.length === 0 ? (
              <p className="text-center text-slate-500 py-4">No hay operarios. Añade el primero.</p>
            ) : (
              operarios.map((op) => (
                <div
                  key={op.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-slate-200"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded flex items-center justify-center text-white text-sm font-bold"
                      style={{ backgroundColor: op.color }}
                    >
                      {op.abreviatura}
                    </div>
                    <div>
                      <span className="font-medium">{op.nombre}</span>
                      <p className="text-xs text-slate-500">{op.dias_vacaciones || 22} días vacaciones · {op.dias_libres || 6} días libres</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingOperario(op);
                        setNewOperario({
                          nombre: op.nombre,
                          abreviatura: op.abreviatura,
                          color: op.color,
                          dias_vacaciones: op.dias_vacaciones || 22,
                          dias_libres: op.dias_libres || 6,
                        });
                        setShowAddOperarioModal(true);
                      }}
                    >
                      <Edit2 className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700"
                      onClick={() => setDeleteOperarioConfirm(op)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>

          <DialogFooter>
            <Button
              onClick={() => {
                setEditingOperario(null);
                setNewOperario({ nombre: "", abreviatura: "", color: "#3B82F6", dias_vacaciones: 22, dias_libres: 6 });
                setShowAddOperarioModal(true);
              }}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="add-operario-btn"
            >
              <Plus className="w-4 h-4 mr-2" />
              Añadir Operario
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal: Añadir/Editar Operario */}
      <Dialog open={showAddOperarioModal} onOpenChange={setShowAddOperarioModal}>
        <DialogContent className="sm:max-w-md" data-testid="add-operario-modal">
          <DialogHeader>
            <DialogTitle className="font-['Manrope']">
              {editingOperario ? "Editar Operario" : "Nuevo Operario"}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="nombre">Nombre</Label>
              <Input
                id="nombre"
                value={newOperario.nombre}
                onChange={(e) => setNewOperario({ ...newOperario, nombre: e.target.value })}
                placeholder="Nombre del operario"
                data-testid="operario-nombre-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="abreviatura">Abreviatura (máx. 3)</Label>
                <Input
                  id="abreviatura"
                  value={newOperario.abreviatura}
                  onChange={(e) => setNewOperario({ ...newOperario, abreviatura: e.target.value.slice(0, 3).toUpperCase() })}
                  placeholder="Ej: JUA"
                  maxLength={3}
                  data-testid="operario-abreviatura-input"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dias">Días de vacaciones</Label>
                <Input
                  id="dias"
                  type="number"
                  value={newOperario.dias_vacaciones}
                  onChange={(e) => setNewOperario({ ...newOperario, dias_vacaciones: parseInt(e.target.value) || 0 })}
                  min="0"
                  data-testid="operario-dias-input"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="dias_libres">Días libres</Label>
              <Input
                id="dias_libres"
                type="number"
                value={newOperario.dias_libres}
                onChange={(e) => setNewOperario({ ...newOperario, dias_libres: parseInt(e.target.value) || 0 })}
                min="0"
                className="w-32"
                data-testid="operario-dias-libres-input"
              />
            </div>
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex items-center gap-2 flex-wrap">
                {PRESET_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setNewOperario({ ...newOperario, color })}
                    className={`w-8 h-8 rounded-lg border-2 transition-all ${
                      newOperario.color === color ? "border-slate-900 scale-110" : "border-transparent"
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <Label htmlFor="customColor" className="text-xs text-slate-500">Personalizado:</Label>
                <Input
                  id="customColor"
                  type="color"
                  value={newOperario.color}
                  onChange={(e) => setNewOperario({ ...newOperario, color: e.target.value })}
                  className="w-12 h-8 p-0 border-0"
                />
              </div>
            </div>
            
            {/* Preview */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg">
              <div
                className="w-10 h-10 rounded flex items-center justify-center text-white font-bold"
                style={{ backgroundColor: newOperario.color }}
              >
                {newOperario.abreviatura || "?"}
              </div>
              <div>
                <span className="font-medium">{newOperario.nombre || "Nombre"}</span>
                <p className="text-xs text-slate-500">{newOperario.dias_vacaciones} días vacaciones · {newOperario.dias_libres} días libres</p>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddOperarioModal(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveOperario}
              className="bg-indigo-600 hover:bg-indigo-700"
              data-testid="save-operario-btn"
            >
              {editingOperario ? "Guardar Cambios" : "Crear Operario"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirm Delete Operario */}
      <AlertDialog open={!!deleteOperarioConfirm} onOpenChange={() => setDeleteOperarioConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar operario?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleteOperarioConfirm?.nombre}" y todas sus vacaciones registradas.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOperario}
              className="bg-red-600 hover:bg-red-700"
            >
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CalendarPage;
