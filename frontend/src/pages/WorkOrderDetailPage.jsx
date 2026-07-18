import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  FileText,
  Clock,
  Calendar,
  Users,
  Pencil,
  Plus,
  Trash2,
  Lock,
  Archive,
  RotateCcw,
  CheckCircle2,
  UserCheck,
  Link2,
  Download,
  MapPin,
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";
import SessionDialog from "@/components/SessionDialog";
import GaleriaFotos from "@/components/GaleriaFotos";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Colores estables por nombre (mismo esquema que ficha cliente)
const COLORES = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const colorDe = (nombre) => {
  let h = 0;
  for (let i = 0; i < (nombre || "").length; i++)
    h = nombre.charCodeAt(i) + ((h << 5) - h);
  return COLORES[Math.abs(h) % COLORES.length];
};

const estadoBadge = (estado) => {
  const map = {
    abierto: { txt: "Abierto", cls: "bg-emerald-100 text-emerald-700" },
    cerrado: { txt: "Cerrado", cls: "bg-slate-200 text-slate-700" },
    archivado: { txt: "Archivado", cls: "bg-amber-100 text-amber-700" },
  };
  const b = map[estado] || map.abierto;
  return <span className={`text-xs px-2 py-1 rounded ${b.cls}`}>{b.txt}</span>;
};

const horasDeSesion = (horaInicio, horaFin) => {
  try {
    const [h1, m1] = horaInicio.split(":").map(Number);
    const [h2, m2] = horaFin.split(":").map(Number);
    const min = h2 * 60 + m2 - (h1 * 60 + m1);
    return min > 0 ? min / 60 : 0;
  } catch {
    return 0;
  }
};

const WorkOrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [parte, setParte] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [presupuestos, setPresupuestos] = useState([]);
  const [operariosCatalogo, setOperariosCatalogo] = useState([]);
  const [tareasCatalogo, setTareasCatalogo] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Edicion inline de la cabecera
  const [editandoCabecera, setEditandoCabecera] = useState(false);
  const [formCabecera, setFormCabecera] = useState({ titulo: "", notas: "", budget_template_id: "" });
  const [guardandoCabecera, setGuardandoCabecera] = useState(false);

  // Dialogo de sesion (crear/editar)
  const [sessionDialogOpen, setSessionDialogOpen] = useState(false);
  const [sesionEditando, setSesionEditando] = useState(null);

  // Confirmaciones
  const [sesionABorrar, setSesionABorrar] = useState(null);
  const [borrandoSesion, setBorrandoSesion] = useState(false);
  const [confirmarEliminarParte, setConfirmarEliminarParte] = useState(false);

  const [accionando, setAccionando] = useState(false);
  const [generandoEnlace, setGenerandoEnlace] = useState(false);
  const [enlaceGenerado, setEnlaceGenerado] = useState(null);
  const [dialogEnlaceOpen, setDialogEnlaceOpen] = useState(false);
  const [descargandoPdf, setDescargandoPdf] = useState(false);

  const fetchParte = async () => {
    try {
      const res = await axios.get(`${API}/work-orders/${id}`);
      setParte(res.data);
      return res.data;
    } catch (err) {
      if (err?.response?.status === 404) {
        setNotFound(true);
      } else {
        console.error("Error cargando parte:", err);
        toast.error("Error al cargar el parte");
      }
      return null;
    }
  };

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      const data = await fetchParte();
      if (cancelado || !data) {
        if (!cancelado) setLoading(false);
        return;
      }
      // Cliente, presupuestos y catalogos en paralelo
      try {
        const [cRes, bRes, opsRes, tareasRes] = await Promise.all([
          axios.get(`${API}/clients/${data.client_slug}`),
          axios.get(`${API}/clients/${data.client_slug}/budgets`).catch(() => ({ data: [] })),
          axios.get(`${API}/users/operarios`).catch(() => ({ data: [] })),
          axios.get(`${API}/work-tasks`).catch(() => ({ data: [] })),
        ]);
        if (cancelado) return;
        setCliente(cRes.data);
        setPresupuestos(bRes.data);
        setOperariosCatalogo(opsRes.data);
        setTareasCatalogo(tareasRes.data);
      } catch (err) {
        // El cliente es informativo (link de vuelta); si falla seguimos igualmente
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const operariosPorId = useMemo(() => {
    const map = {};
    operariosCatalogo.forEach((o) => (map[o.user_id] = o.name));
    return map;
  }, [operariosCatalogo]);

  const tareasPorId = useMemo(() => {
    const map = {};
    tareasCatalogo.forEach((t) => (map[t.id] = t.nombre));
    return map;
  }, [tareasCatalogo]);

  const nombreOperario = (userId) => operariosPorId[userId] || "Operario";

  const nombresDeSesion = (s) => {
    const registrados = (s.operarios_ids || []).map(nombreOperario);
    const libres = s.operarios_texto_libre
      ? s.operarios_texto_libre.split(",").map((n) => n.trim()).filter(Boolean)
      : [];
    return [...registrados, ...libres];
  };

  const nombreFirmante = (s) => {
    if (s.firmante_responsable_id) return nombreOperario(s.firmante_responsable_id);
    if (s.firmante_responsable_texto) return s.firmante_responsable_texto;
    return null;
  };

  // --- Edicion de cabecera --------------------------------------------

  const abrirEdicionCabecera = () => {
    setFormCabecera({
      titulo: parte.titulo,
      notas: parte.notas || "",
      budget_template_id: parte.budget_template_id || "",
    });
    setEditandoCabecera(true);
  };

  const guardarCabecera = async () => {
    const titulo = formCabecera.titulo.trim();
    if (!titulo) {
      toast.error("El titulo es obligatorio");
      return;
    }
    setGuardandoCabecera(true);
    try {
      await axios.patch(`${API}/work-orders/${id}`, {
        titulo,
        notas: formCabecera.notas.trim(),
        budget_template_id: formCabecera.budget_template_id || null,
      });
      toast.success("Parte actualizado");
      setEditandoCabecera(false);
      await fetchParte();
    } catch (err) {
      console.error("Error guardando cabecera:", err);
      const status = err?.response?.status;
      if (status === 403) toast.error("El parte esta cerrado");
      else toast.error("Error al guardar los cambios");
    } finally {
      setGuardandoCabecera(false);
    }
  };

  // --- Acciones de estado ----------------------------------------------

  const cambiarEstado = async (nuevoEstado, mensajeExito) => {
    setAccionando(true);
    try {
      await axios.patch(`${API}/work-orders/${id}`, { estado: nuevoEstado });
      toast.success(mensajeExito);
      await fetchParte();
    } catch (err) {
      console.error("Error cambiando estado:", err);
      const status = err?.response?.status;
      if (status === 403) toast.error("No tienes permisos para esta accion");
      else toast.error("Error al cambiar el estado del parte");
    } finally {
      setAccionando(false);
    }
  };

  const copiarAlPortapapeles = async (texto, avisarSiFalla) => {
    if (!navigator.clipboard?.writeText) {
      if (avisarSiFalla) {
        toast.error("Tu navegador no permite copiar automaticamente. Selecciona el enlace y copialo.");
      }
      return;
    }
    try {
      const timeout = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), 2000));
      await Promise.race([navigator.clipboard.writeText(texto), timeout]);
      toast.success("Enlace copiado al portapapeles");
    } catch {
      if (avisarSiFalla) {
        toast.error("No se pudo copiar. Selecciona el enlace y copialo manualmente.");
      }
    }
  };

  const handleGenerarEnlace = async () => {
    setGenerandoEnlace(true);
    try {
      const res = await axios.post(`${API}/work-orders/${id}/generar-enlace-firma`);
      const url = `${window.location.origin}/firmar/${res.data.token}`;
      setEnlaceGenerado(url);
      setDialogEnlaceOpen(true);
      if (!parte.firma_cliente_token) await fetchParte();
      // Intento de copia en segundo plano, nunca bloquea el boton ni el flujo:
      // el dialogo con el enlace visible es la red de seguridad real.
      copiarAlPortapapeles(url, false);
    } catch (err) {
      console.error("Error generando enlace de firma:", err);
      toast.error("No se pudo generar el enlace");
    } finally {
      setGenerandoEnlace(false);
    }
  };

  const handleDescargarPdf = async () => {
    setDescargandoPdf(true);
    try {
      const res = await axios.get(`${API}/work-orders/${id}/pdf`, { responseType: "blob" });
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = blobUrl;
      a.download = `parte-${id.slice(0, 8)}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("Error descargando PDF:", err);
      toast.error("No se pudo generar el PDF");
    } finally {
      setDescargandoPdf(false);
    }
  };

  const eliminarParte = async () => {
    setAccionando(true);
    try {
      await axios.delete(`${API}/work-orders/${id}`);
      toast.success("Parte eliminado");
      navigate(cliente ? `/clients/${cliente.slug}` : "/clients");
    } catch (err) {
      console.error("Error eliminando parte:", err);
      const status = err?.response?.status;
      if (status === 400) toast.error("El parte tiene sesiones registradas");
      else if (status === 403) toast.error("Solo se pueden eliminar partes abiertos");
      else toast.error("Error al eliminar el parte");
    } finally {
      setAccionando(false);
      setConfirmarEliminarParte(false);
    }
  };

  // --- Sesiones ----------------------------------------------------------

  const abrirNuevaSesion = () => {
    setSesionEditando(null);
    setSessionDialogOpen(true);
  };

  const abrirEditarSesion = (s) => {
    setSesionEditando(s);
    setSessionDialogOpen(true);
  };

  const eliminarSesion = async () => {
    if (!sesionABorrar) return;
    setBorrandoSesion(true);
    try {
      await axios.delete(`${API}/work-orders/${id}/sessions/${sesionABorrar.id}`);
      toast.success("Sesion eliminada");
      setSesionABorrar(null);
      await fetchParte();
    } catch (err) {
      console.error("Error eliminando sesion:", err);
      const status = err?.response?.status;
      if (status === 403) toast.error("El parte no esta abierto");
      else toast.error("Error al eliminar la sesion");
    } finally {
      setBorrandoSesion(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 text-center text-slate-400" data-testid="work-order-loading">
        Cargando parte...
      </div>
    );
  }

  if (notFound || !parte) {
    return (
      <div data-testid="work-order-not-found">
        <Button
          variant="ghost"
          onClick={() => navigate(-1)}
          className="mb-4 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontro el parte <span className="font-mono">{id?.slice(0, 8)}</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessions = parte.sessions || [];
  const sessionsOrdenadas = [...sessions].sort((a, b) =>
    a.fecha === b.fecha ? a.hora_inicio.localeCompare(b.hora_inicio) : a.fecha.localeCompare(b.fecha)
  );
  const totalHoras = sessions.reduce(
    (acc, s) => acc + horasDeSesion(s.hora_inicio, s.hora_fin),
    0
  );

  // Resumen de horas por operario (registrados + texto libre)
  const horasPorOperario = {};
  sessions.forEach((s) => {
    const horas = horasDeSesion(s.hora_inicio, s.hora_fin);
    if (horas <= 0) return;
    nombresDeSesion(s).forEach((nombre) => {
      horasPorOperario[nombre] = (horasPorOperario[nombre] || 0) + horas;
    });
  });
  const resumenOperarios = Object.entries(horasPorOperario).sort((a, b) => b[1] - a[1]);

  const parteAbierto = parte.estado === "abierto";
  const parteCerrado = parte.estado === "cerrado";
  const puedeEliminarParte = parteAbierto && sessions.length === 0;

  return (
    <div data-testid="work-order-detail-page" className="max-w-4xl">
      {/* Cabecera */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => (cliente ? navigate(`/clients/${cliente.slug}`) : navigate(-1))}
          className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {cliente ? `Volver a ${cliente.nombre}` : "Volver"}
        </Button>

        {!editandoCabecera ? (
          <div className="flex items-start justify-between gap-4 flex-wrap">
            <div className="flex items-start gap-4 min-w-0">
              <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <ClipboardList className="w-7 h-7 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope'] truncate">
                  {parte.titulo}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  {estadoBadge(parte.estado)}
                  {parte.usa_zonas && (
                    <span
                      className="text-xs px-2 py-1 rounded bg-violet-100 text-violet-700"
                      data-testid="badge-usa-zonas"
                    >
                      Usa zonas
                    </span>
                  )}
                  {cliente && (
                    <span className="text-sm text-slate-500 inline-flex items-center gap-1">
                      <Building2 className="w-3.5 h-3.5" />
                      {cliente.nombre}
                    </span>
                  )}
                  {parte.budget_number && (
                    <span className="text-sm text-red-600 inline-flex items-center gap-1 font-mono">
                      <FileText className="w-3.5 h-3.5" />
                      {parte.budget_number}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {(parteAbierto || isAdmin) && (
              <Button
                variant="outline"
                size="sm"
                onClick={abrirEdicionCabecera}
                className="border-slate-200"
                data-testid="editar-cabecera-btn"
              >
                <Pencil className="w-4 h-4 mr-2" />
                Editar
              </Button>
            )}
          </div>
        ) : (
          <Card className="border-indigo-200 bg-indigo-50/40">
            <CardContent className="p-4 space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="cabecera-titulo">Titulo</Label>
                <Input
                  id="cabecera-titulo"
                  value={formCabecera.titulo}
                  onChange={(e) =>
                    setFormCabecera((f) => ({ ...f, titulo: e.target.value }))
                  }
                  data-testid="cabecera-titulo-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Presupuesto asociado (opcional)</Label>
                <Select
                  value={formCabecera.budget_template_id || "none"}
                  onValueChange={(v) =>
                    setFormCabecera((f) => ({
                      ...f,
                      budget_template_id: v === "none" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger data-testid="cabecera-budget-select">
                    <SelectValue placeholder="Sin presupuesto" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin presupuesto (trabajo puntual)</SelectItem>
                    {presupuestos.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.budget_number} · {p.titulo || p.servicios_descripcion || "Sin titulo"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="cabecera-notas">Notas</Label>
                <Textarea
                  id="cabecera-notas"
                  value={formCabecera.notas}
                  onChange={(e) =>
                    setFormCabecera((f) => ({ ...f, notas: e.target.value }))
                  }
                  rows={3}
                  data-testid="cabecera-notas-input"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="ghost"
                  onClick={() => setEditandoCabecera(false)}
                  disabled={guardandoCabecera}
                >
                  Cancelar
                </Button>
                <Button
                  onClick={guardarCabecera}
                  disabled={guardandoCabecera}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="guardar-cabecera-btn"
                >
                  {guardandoCabecera ? "Guardando..." : "Guardar cambios"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Acciones de estado */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          onClick={handleGenerarEnlace}
          disabled={generandoEnlace}
          className="border-slate-200"
          data-testid="generar-enlace-firma-btn"
        >
          <Link2 className="w-4 h-4 mr-2" />
          {generandoEnlace ? "Generando..." : "Generar enlace de firma"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDescargarPdf}
          disabled={descargandoPdf}
          className="border-slate-200"
          data-testid="descargar-pdf-btn"
        >
          <Download className="w-4 h-4 mr-2" />
          {descargandoPdf ? "Generando PDF..." : "Descargar PDF"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate("/admin/work-tasks")}
          className="border-slate-200"
          data-testid="cat-tareas-btn"
        >
          <ClipboardList className="w-4 h-4 mr-2" />
          Cat. Tareas
        </Button>
        {parte.usa_zonas && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate(`/work-orders/${id}/rejilla`)}
            className="border-slate-200"
            data-testid="ver-rejilla-btn"
          >
            <MapPin className="w-4 h-4 mr-2" />
            Rejilla de zonas
          </Button>
        )}
        {parteAbierto && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => cambiarEstado("cerrado", "Parte cerrado")}
            disabled={accionando}
            className="border-slate-200"
            data-testid="cerrar-parte-btn"
          >
            <Lock className="w-4 h-4 mr-2" />
            Cerrar parte
          </Button>
        )}
        {isAdmin && parteCerrado && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cambiarEstado("abierto", "Parte reabierto")}
              disabled={accionando}
              className="border-slate-200"
              data-testid="reabrir-parte-btn"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reabrir
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => cambiarEstado("archivado", "Parte archivado")}
              disabled={accionando}
              className="border-slate-200"
              data-testid="archivar-parte-btn"
            >
              <Archive className="w-4 h-4 mr-2" />
              Archivar
            </Button>
          </>
        )}
        {puedeEliminarParte && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirmarEliminarParte(true)}
            disabled={accionando}
            className="border-red-200 text-red-600 hover:bg-red-50 ml-auto"
            data-testid="eliminar-parte-btn"
          >
            <Trash2 className="w-4 h-4 mr-2" />
            Eliminar parte
          </Button>
        )}
      </div>

      {parte.firma_cliente_token && (
        <div className="mb-6">
          {parte.firma_cliente ? (
            <div className="inline-flex items-center gap-2 text-sm text-emerald-700 font-medium bg-emerald-50 px-3 py-1.5 rounded-lg">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              Firmado por el cliente: {parte.firma_cliente_nombre} (
              {new Date(parte.firma_cliente_en).toLocaleDateString("es-ES")})
            </div>
          ) : (
            <div className="inline-flex items-center gap-2 text-sm text-amber-700 font-medium bg-amber-50 px-3 py-1.5 rounded-lg">
              <Link2 className="w-4 h-4 shrink-0" />
              Enlace de firma generado, pendiente de que firme el cliente
            </div>
          )}
        </div>
      )}

      {/* Resumen rapido */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="rounded-lg bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Sesiones
          </p>
          <p className="text-2xl font-bold text-slate-900 font-['JetBrains_Mono'] mt-1">
            {sessions.length}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Horas
          </p>
          <p className="text-2xl font-bold text-slate-900 font-['JetBrains_Mono'] mt-1">
            {totalHoras.toFixed(1)}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Creado
          </p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {new Date(parte.creado_en).toLocaleDateString("es-ES")}
          </p>
        </div>
        <div className="rounded-lg bg-white border border-slate-200 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Actualizado
          </p>
          <p className="text-sm font-medium text-slate-900 mt-1">
            {new Date(parte.actualizado_en).toLocaleDateString("es-ES")}
          </p>
        </div>
      </div>

      <GaleriaFotos workOrderId={id} titulo="Fotos del parte" />

      {/* Notas del parte */}
      {parte.notas && (
        <Card className="border-slate-100 mb-6">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">
              Notas
            </p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">{parte.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Resumen de horas por operario */}
      {resumenOperarios.length > 0 && (
        <Card className="border-slate-100 mb-6">
          <CardContent className="p-4">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-3">
              Horas por operario
            </p>
            <div className="space-y-2">
              {resumenOperarios.map(([nombre, horas]) => (
                <div key={nombre} className="flex items-center gap-3">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: colorDe(nombre) }}
                  />
                  <span className="text-sm text-slate-700 flex-1 truncate">{nombre}</span>
                  <span className="text-sm font-medium text-slate-900 font-['JetBrains_Mono']">
                    {horas.toFixed(1)} h
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lista de sesiones */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Sesiones registradas</h2>
        {parteAbierto && (
          <Button
            onClick={abrirNuevaSesion}
            size="sm"
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="nueva-sesion-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nueva sesion
          </Button>
        )}
      </div>

      {sessionsOrdenadas.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400" data-testid="no-sessions">
            Este parte todavia no tiene sesiones registradas.
            {parteAbierto && (
              <>
                <br />
                <button
                  type="button"
                  onClick={abrirNuevaSesion}
                  className="text-xs text-indigo-600 hover:text-indigo-800 font-medium mt-1"
                >
                  Anadir la primera sesion
                </button>
              </>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessionsOrdenadas.map((s) => {
            const nombres = nombresDeSesion(s);
            const firmante = nombreFirmante(s);
            const tareas = (s.tareas_ids || [])
              .map((tid) => (tareasPorId[tid] ? { id: tid, nombre: tareasPorId[tid] } : null))
              .filter(Boolean);
            return (
              <Card key={s.id} className="border-slate-100" data-testid={`session-${s.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2 text-sm flex-wrap">
                      <Calendar className="w-4 h-4 text-slate-400" />
                      <span className="font-medium text-slate-900">
                        {new Date(s.fecha).toLocaleDateString("es-ES", {
                          weekday: "short",
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                      <Clock className="w-4 h-4 text-slate-400 ml-2" />
                      <span className="text-slate-700">
                        {s.hora_inicio} – {s.hora_fin}
                      </span>
                      <span className="text-xs text-slate-400 font-['JetBrains_Mono']">
                        ({horasDeSesion(s.hora_inicio, s.hora_fin).toFixed(1)} h)
                      </span>
                    </div>
                    {parteAbierto && (
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-slate-100"
                          onClick={() => abrirEditarSesion(s)}
                          data-testid={`editar-sesion-${s.id}`}
                        >
                          <Pencil className="w-4 h-4 text-slate-600" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 hover:bg-red-50"
                          onClick={() => setSesionABorrar(s)}
                          data-testid={`borrar-sesion-${s.id}`}
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </Button>
                      </div>
                    )}
                  </div>

                  {nombres.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {nombres.map((n) => (
                        <span
                          key={n}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {tareas.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {tareas.map((t) => {
                        const zonas = s.tareas_zonas?.[t.id] || [];
                        const zonasReales = zonas.filter((z) => z !== "X");
                        return (
                          <span
                            key={t.id}
                            className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"
                          >
                            {t.nombre}
                            {parte.usa_zonas && zonasReales.length > 0 && (
                              <span className="font-semibold ml-1">
                                · {zonasReales.join(",")}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {firmante && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs">
                      <UserCheck className="w-3.5 h-3.5 text-slate-400" />
                      <span className="text-slate-500">Responsable: {firmante}</span>
                      {s.firma_responsable ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Firmado
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">
                          Pendiente de firma
                        </span>
                      )}
                    </div>
                  )}

                  {s.notas && (
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{s.notas}</p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogo: enlace de firma generado */}
      <Dialog open={dialogEnlaceOpen} onOpenChange={setDialogEnlaceOpen}>
        <DialogContent className="max-w-md" data-testid="enlace-firma-dialog">
          <DialogHeader>
            <DialogTitle>Enlace de firma</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-slate-500">
              Comparte este enlace con el cliente (WhatsApp, email...) para que revise el
              parte y firme. No necesita crear cuenta ni iniciar sesion.
            </p>
            <div className="flex gap-2">
              <Input
                readOnly
                value={enlaceGenerado || ""}
                onFocus={(e) => e.target.select()}
                className="font-mono text-xs"
                data-testid="enlace-firma-input"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => copiarAlPortapapeles(enlaceGenerado, true)}
                className="border-slate-200 shrink-0"
                data-testid="copiar-enlace-btn"
              >
                Copiar
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogEnlaceOpen(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialogo crear/editar sesion */}
      <SessionDialog
        open={sessionDialogOpen}
        onOpenChange={setSessionDialogOpen}
        workOrderId={id}
        session={sesionEditando}
        usaZonas={!!parte.usa_zonas}
        onSaved={fetchParte}
      />

      {/* Confirmar borrado de sesion */}
      <AlertDialog
        open={!!sesionABorrar}
        onOpenChange={(open) => !open && setSesionABorrar(null)}
      >
        <AlertDialogContent data-testid="borrar-sesion-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta sesion?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminara la sesion del{" "}
              <span className="font-semibold">
                {sesionABorrar &&
                  new Date(sesionABorrar.fecha).toLocaleDateString("es-ES")}
              </span>{" "}
              y sus horas dejaran de contar en el resumen. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={borrandoSesion}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminarSesion}
              disabled={borrandoSesion}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirmar-borrar-sesion-btn"
            >
              {borrandoSesion ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Confirmar borrado del parte completo */}
      <AlertDialog open={confirmarEliminarParte} onOpenChange={setConfirmarEliminarParte}>
        <AlertDialogContent data-testid="eliminar-parte-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este parte?</AlertDialogTitle>
            <AlertDialogDescription>
              Vas a eliminar <span className="font-semibold">{parte.titulo}</span>. Solo es
              posible porque no tiene sesiones registradas. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={accionando}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={eliminarParte}
              disabled={accionando}
              className="bg-red-600 hover:bg-red-700"
              data-testid="confirmar-eliminar-parte-btn"
            >
              {accionando ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrderDetailPage;
