import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  HardHat,
  CloudRain,
  Stethoscope,
  FileText,
  ExternalLink,
  ShieldAlert,
  Camera,
  Trash2,
  Clock,
  CheckCircle,
  XCircle,
  X,
  PenLine,
  ChevronRight,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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

const MOTIVO_CLIMA_INFO = {
  altas_temperaturas: "Altas temperaturas",
  bajas_temperaturas: "Bajas temperaturas",
  lluvia: "Lluvia",
  viento: "Viento",
  nieve: "Nieve",
  otro: "Inclemencias climatológicas",
};

const EPI_TIPOS = [
  { value: "casco", label: "Casco" },
  { value: "gafas_proteccion", label: "Gafas de protección" },
  { value: "mascarilla", label: "Mascarilla" },
  { value: "guantes", label: "Guantes" },
  { value: "chaleco_alta_visibilidad", label: "Chaleco de alta visibilidad" },
  { value: "botas_seguridad", label: "Botas de seguridad" },
  { value: "protector_auditivo", label: "Protector auditivo" },
  { value: "arnes", label: "Arnés" },
  { value: "otro", label: "Otro" },
];

const ESTADO_EPI_INFO = {
  pendiente: { label: "Pendiente", cls: "bg-amber-50 text-amber-700", icon: Clock },
  aprobada: { label: "Aprobada", cls: "bg-green-50 text-green-700", icon: CheckCircle },
  rechazada: { label: "Rechazada", cls: "bg-red-50 text-red-700", icon: XCircle },
};

const formatearFecha = (fecha) => {
  if (!fecha) return "";
  try {
    return new Date(fecha + "T00:00:00").toLocaleDateString("es-ES", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return fecha;
  }
};

const PrevencionPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [avisos, setAvisos] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [documentosPendientes, setDocumentosPendientes] = useState([]);
  const [config, setConfig] = useState(null);
  const [solicitudesEpi, setSolicitudesEpi] = useState([]);
  const [justificantes, setJustificantes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [epiForm, setEpiForm] = useState({ tipo: "", cantidad: 1, notas: "" });
  const [enviandoEpi, setEnviandoEpi] = useState(false);

  const [descripcionJustificante, setDescripcionJustificante] = useState("");
  const [subiendoJustificante, setSubiendoJustificante] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [avisosRes, docsRes, configRes, epiRes, justRes] = await Promise.all([
        axios.get(`${API}/avisos-clima`, { params: { solo_activos: true } }),
        axios.get(`${API}/documentos-firma`, { params: { categoria: "prevencion" } }),
        axios.get(`${API}/configuracion/prevencion`),
        axios.get(`${API}/solicitudes-epi`, { params: { mias: true } }),
        axios.get(`${API}/justificantes-medicos`, { params: { mias: true } }),
      ]);
      setAvisos(avisosRes.data);
      setDocumentos(docsRes.data.filter((d) => d.firmado && d.firmado_por === user?.user_id));
      setDocumentosPendientes(docsRes.data.filter((d) => !d.firmado));
      setConfig(configRes.data);
      setSolicitudesEpi(epiRes.data);
      setJustificantes(justRes.data);
    } catch (err) {
      console.error("Error cargando prevención:", err);
      toast.error("No se pudo cargar la información de prevención");
    } finally {
      setLoading(false);
    }
  }, [user?.user_id]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const enviarSolicitudEpi = async () => {
    if (!epiForm.tipo) {
      toast.error("Selecciona qué material necesitas");
      return;
    }
    setEnviandoEpi(true);
    try {
      await axios.post(`${API}/solicitudes-epi`, {
        tipo: epiForm.tipo,
        cantidad: Number(epiForm.cantidad) || 1,
        notas: epiForm.notas.trim(),
      });
      toast.success("Solicitud enviada al administrador");
      setEpiForm({ tipo: "", cantidad: 1, notas: "" });
      await cargar();
    } catch (err) {
      console.error("Error solicitando EPI:", err);
      toast.error("No se pudo enviar la solicitud");
    } finally {
      setEnviandoEpi(false);
    }
  };

  const subirJustificante = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setSubiendoJustificante(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await axios.post(`${API}/justificantes-medicos`, {
          imagen: reader.result,
          descripcion: descripcionJustificante.trim(),
        });
        toast.success("Justificante subido");
        setDescripcionJustificante("");
        await cargar();
      } catch (err) {
        console.error("Error subiendo justificante:", err);
        toast.error("No se pudo subir el justificante");
      } finally {
        setSubiendoJustificante(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const borrarJustificante = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/justificantes-medicos/${aBorrar.id}`);
      toast.success("Justificante eliminado");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error borrando justificante:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  return (
    <div data-testid="prevencion-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
          <HardHat className="w-6 h-6 text-amber-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Prevención
          </h1>
          <p className="text-sm text-slate-500">Documentación y necesidades de prevención</p>
        </div>
      </div>

      {/* Avisos climatologicos activos */}
      {avisos.length > 0 && (
        <div className="space-y-2 mb-6">
          {avisos.map((a) => (
            <Card key={a.id} className="border-amber-200 bg-amber-50" data-testid={`aviso-clima-${a.id}`}>
              <CardContent className="p-4 flex items-start gap-3">
                <CloudRain className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-amber-900">
                    Parada de trabajo: {MOTIVO_CLIMA_INFO[a.motivo] || a.motivo}
                  </p>
                  <p className="text-sm text-amber-800 mt-0.5">
                    Desde el {formatearFecha(a.fecha_inicio)}
                    {a.fecha_fin ? ` hasta el ${formatearFecha(a.fecha_fin)}` : ""}
                  </p>
                  {a.descripcion && (
                    <p className="text-sm text-amber-700 mt-1">{a.descripcion}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Reconocimiento medico */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5" />
              Reconocimiento médico
            </p>
            <p className="text-sm text-slate-700">
              Última revisión:{" "}
              <span className="font-medium">
                {user?.fecha_ultima_revision_medica
                  ? formatearFecha(user.fecha_ultima_revision_medica)
                  : "No registrada"}
              </span>
            </p>
            {user?.fecha_proxima_revision_medica ? (
              <p className="text-sm text-slate-700">
                Próxima cita:{" "}
                <span className="font-medium">{formatearFecha(user.fecha_proxima_revision_medica)}</span>
                {user.hora_proxima_revision_medica && ` a las ${user.hora_proxima_revision_medica}`}
                {user.lugar_proxima_revision_medica && (
                  <>
                    {" "}
                    en <span className="font-medium">{user.lugar_proxima_revision_medica}</span>
                  </>
                )}
              </p>
            ) : (
              <p className="text-sm text-slate-400">No hay ninguna cita próxima programada.</p>
            )}
          </CardContent>
        </Card>

        {/* Protocolo de baja / mutua */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              En caso de baja
            </p>
            {config?.protocolo_baja ? (
              <p className="text-sm text-slate-700 whitespace-pre-line">{config.protocolo_baja}</p>
            ) : (
              <p className="text-sm text-slate-400">
                El administrador todavía no ha configurado el protocolo a seguir.
              </p>
            )}
            {config?.mutua_url && (
              <a
                href={config.mutua_url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-700 font-medium"
                data-testid="link-mutua"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Centros de {config.mutua_nombre || "la mutua"}
              </a>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Documentos de prevencion pendientes de firmar */}
      {documentosPendientes.length > 0 && (
        <Card className="border-indigo-100 bg-indigo-50/50 shadow-sm mt-4">
          <CardContent className="p-4 space-y-2">
            <p className="text-xs uppercase tracking-wider text-indigo-700 font-medium flex items-center gap-1.5">
              <PenLine className="w-3.5 h-3.5" />
              Documentos pendientes de firmar
            </p>
            <div className="divide-y divide-indigo-100">
              {documentosPendientes.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => navigate(`/documentos-firma/${d.id}`)}
                  className="w-full flex items-center justify-between py-2.5 text-left hover:bg-indigo-100/50 -mx-2 px-2 rounded transition-colors"
                  data-testid={`documento-pendiente-${d.id}`}
                >
                  <span className="text-sm font-medium text-indigo-900">{d.nombre}</span>
                  <ChevronRight className="w-4 h-4 text-indigo-400 shrink-0" />
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Documentos de prevencion ya firmados */}
      <Card className="border-slate-100 shadow-sm mt-4">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Documentos de prevención firmados
          </p>
          {documentos.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no has firmado ningún documento de este apartado.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {documentos.map((d) => (
                <a
                  key={d.id}
                  href={d.pdf_firmado_url || d.pdf_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-2.5 hover:bg-slate-50 -mx-2 px-2 rounded transition-colors"
                  data-testid={`documento-prevencion-${d.id}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{d.nombre}</p>
                    <p className="text-xs text-slate-400">
                      Firmado el{" "}
                      {d.firmado_en
                        ? new Date(d.firmado_en).toLocaleDateString("es-ES")
                        : "-"}
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-slate-400 shrink-0" />
                </a>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        {/* Solicitud de material EPI */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              Solicitar material EPI
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>Material</Label>
                <Select
                  value={epiForm.tipo}
                  onValueChange={(v) => setEpiForm((f) => ({ ...f, tipo: v }))}
                >
                  <SelectTrigger data-testid="epi-tipo-select">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {EPI_TIPOS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1.5 col-span-1">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={epiForm.cantidad}
                    onChange={(e) => setEpiForm((f) => ({ ...f, cantidad: e.target.value }))}
                    data-testid="epi-cantidad-input"
                  />
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Notas (opcional)</Label>
                  <Input
                    value={epiForm.notas}
                    onChange={(e) => setEpiForm((f) => ({ ...f, notas: e.target.value }))}
                    placeholder="Ej. talla M"
                    data-testid="epi-notas-input"
                  />
                </div>
              </div>
              <Button
                onClick={enviarSolicitudEpi}
                disabled={enviandoEpi}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                data-testid="epi-enviar-btn"
              >
                {enviandoEpi ? "Enviando..." : "Enviar solicitud"}
              </Button>
            </div>

            {solicitudesEpi.length > 0 && (
              <div className="pt-2 border-t border-slate-100 space-y-1.5">
                {solicitudesEpi.map((s) => {
                  const info = ESTADO_EPI_INFO[s.estado] || ESTADO_EPI_INFO.pendiente;
                  const Icon = info.icon;
                  const tipoLabel = EPI_TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo;
                  return (
                    <div key={s.id} className="flex items-center justify-between text-sm">
                      <span className="text-slate-700">
                        {tipoLabel} x{s.cantidad}
                      </span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${info.cls}`}>
                        <Icon className="w-3 h-3" />
                        {info.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Justificantes medicos */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              Justificantes médicos / asistencia sanitaria familiar
            </p>
            <div className="space-y-2">
              <div className="space-y-1.5">
                <Label>Descripción (opcional)</Label>
                <Textarea
                  value={descripcionJustificante}
                  onChange={(e) => setDescripcionJustificante(e.target.value)}
                  placeholder="Ej. Baja médica, acompañamiento a un familiar..."
                  rows={2}
                  data-testid="justificante-descripcion-input"
                />
              </div>
              <label
                className={`flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border-2 border-dashed cursor-pointer transition-colors ${
                  subiendoJustificante
                    ? "opacity-60 border-slate-200"
                    : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50"
                }`}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={subirJustificante}
                  disabled={subiendoJustificante}
                  className="hidden"
                  data-testid="justificante-file-input"
                />
                <Camera className="w-4 h-4 text-slate-500" />
                <span className="text-sm text-slate-600">
                  {subiendoJustificante ? "Subiendo..." : "Subir foto del justificante"}
                </span>
              </label>
            </div>

            {justificantes.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100">
                {justificantes.map((j) => (
                  <div key={j.id} className="relative group" data-testid={`justificante-${j.id}`}>
                    <a href={j.url} target="_blank" rel="noreferrer">
                      <img
                        src={j.url}
                        alt={j.descripcion || "Justificante"}
                        className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                      />
                    </a>
                    <button
                      type="button"
                      onClick={() => setABorrar(j)}
                      className="absolute -top-1.5 -right-1.5 bg-white border border-slate-200 rounded-full p-0.5 text-slate-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                      data-testid={`borrar-justificante-${j.id}`}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este justificante?</AlertDialogTitle>
            <AlertDialogDescription>Esta acción no se puede deshacer.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrarJustificante} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default PrevencionPage;
