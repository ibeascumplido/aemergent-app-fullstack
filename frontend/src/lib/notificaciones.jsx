import { GraduationCap, Check, X, Palmtree, AlertCircle, Camera, FileText, Shirt, UserPlus, CloudRain, HardHat, Euro, ListChecks, Truck, Stethoscope, AlertTriangle, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export const calcularDestino = (notification) => {
  const { type, data } = notification;
  switch (type) {
    case "foto_comentario":
      return data?.lote_id ? `/fotos/lote/${data.lote_id}` : null;
    case "solicitud_ropa":
    case "solicitud_ropa_resuelta":
      return "/ropa";
    case "new_user_request":
      return data?.user_id ? `/admin/users/${data.user_id}` : "/admin/users";
    case "vacation_request":
      return "/calendar";
    case "vacation_approved":
    case "vacation_rejected":
      return "/my-calendar";
    case "aviso_climatologico":
      return "/prevencion";
    case "solicitud_epi":
    case "justificante_medico":
      return "/admin/prevencion";
    case "solicitud_epi_resuelta":
      return "/prevencion";
    case "pago_extra":
      return "/admin/pagos-extra";
    case "pago_extra_resuelto":
      return "/pagos-extra";
    case "tarea_centro_propuesta":
    case "tarea_centro_validar":
      return "/admin/tareas-centro";
    case "tarea_centro_resuelta":
      return "/tareas";
    case "foto_subida":
      return "/fotos";
    case "parte_creado":
      return data?.enlace || "/work-orders";
    case "aviso_itv_vehiculo":
      return data?.vehiculo_id ? `/vehiculos/${data.vehiculo_id}` : "/vehiculos";
    case "aviso_revision_medica":
      return data?.user_id ? `/admin/users/${data.user_id}` : "/admin/users";
    case "incidencia_sin_resolver":
      return data?.enlace || null;
    case "aviso_formacion_caducidad":
      return data?.para_admin ? `/admin/users/${data.user_id}` : "/mi-formacion";
    case "curso_formacion":
      return "/mi-formacion";
    case "parte_sin_actividad":
      return data?.work_order_id ? `/work-orders/${data.work_order_id}` : "/work-orders";
    default:
      return null;
  }
};


export const getNotificationIcon = (type) => {
  switch (type) {
    case "vacation_approved":
      return <Check className="w-4 h-4 text-green-500" />;
    case "vacation_rejected":
      return <X className="w-4 h-4 text-red-500" />;
    case "user_approved":
      return <Check className="w-4 h-4 text-green-500" />;
    case "user_rejected":
      return <X className="w-4 h-4 text-red-500" />;
    case "foto_comentario":
      return <Camera className="w-4 h-4 text-indigo-500" />;
    case "solicitud_ropa":
    case "solicitud_ropa_resuelta":
      return <Shirt className="w-4 h-4 text-amber-500" />;
    case "new_user_request":
      return <UserPlus className="w-4 h-4 text-indigo-500" />;
    case "vacation_request":
      return <Palmtree className="w-4 h-4 text-orange-500" />;
    case "aviso_climatologico":
      return <CloudRain className="w-4 h-4 text-amber-500" />;
    case "solicitud_epi":
    case "solicitud_epi_resuelta":
    case "justificante_medico":
      return <HardHat className="w-4 h-4 text-amber-600" />;
    case "pago_extra":
    case "pago_extra_resuelto":
      return <Euro className="w-4 h-4 text-emerald-600" />;
    case "tarea_centro_propuesta":
    case "tarea_centro_validar":
    case "tarea_centro_resuelta":
      return <ListChecks className="w-4 h-4 text-indigo-500" />;
    case "foto_subida":
      return <Camera className="w-4 h-4 text-sky-500" />;
    case "parte_creado":
      return <FileText className="w-4 h-4 text-red-500" />;
    case "aviso_itv_vehiculo":
      return <Truck className="w-4 h-4 text-amber-600" />;
    case "aviso_revision_medica":
      return <Stethoscope className="w-4 h-4 text-amber-600" />;
    case "incidencia_sin_resolver":
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    case "aviso_formacion_caducidad":
      return <AlertTriangle className="w-4 h-4 text-amber-600" />;
    case "curso_formacion":
      return <GraduationCap className="w-4 h-4 text-indigo-500" />;
    case "parte_sin_actividad":
      return <Clock className="w-4 h-4 text-slate-500" />;
    default:
      return <AlertCircle className="w-4 h-4 text-slate-500" />;
  }
};

export const getNotificationBgColor = (type, read) => {
  if (read) return "bg-white";
  switch (type) {
    case "vacation_approved":
      return "bg-green-50";
    case "vacation_rejected":
      return "bg-red-50";
    default:
      return "bg-blue-50";
  }
};

export const formatTime = (dateStr) => {
  try {
    return formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: es });
  } catch {
    return "";
  }
};

