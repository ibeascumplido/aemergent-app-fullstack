import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  HardHat,
  CloudRain,
  Plus,
  X,
  Check,
  ShieldAlert,
  Users,
  Camera,
  Clock,
  CheckCircle,
  XCircle,
  FileText,
  Upload,
  ExternalLink,
  Trash2,
  PenLine,
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
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MOTIVOS = [
  { value: "altas_temperaturas", label: "Altas temperaturas" },
  { value: "bajas_temperaturas", label: "Bajas temperaturas" },
  { value: "lluvia", label: "Lluvia" },
  { value: "viento", label: "Viento" },
  { value: "nieve", label: "Nieve" },
  { value: "otro", label: "Otro" },
];

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

const emptyAviso = { motivo: "", descripcion: "", fecha_inicio: "", fecha_fin: "" };

const AdminPrevencionPage = () => {
  const [avisos, setAvisos] = useState([]);
  const [solicitudesEpi, setSolicitudesEpi] = useState([]);
  const [justificantes, setJustificantes] = useState([]);
  const [documentos, setDocumentos] = useState([]);
  const [config, setConfig] = useState({ protocolo_baja: "", mutua_nombre: "", mutua_url: "" });
  const [loading, setLoading] = useState(true);

  const [dialogAvisoOpen, setDialogAvisoOpen] = useState(false);
  const [avisoForm, setAvisoForm] = useState(emptyAviso);
  const [creandoAviso, setCreandoAviso] = useState(false);

  const [nombreDoc, setNombreDoc] = useState("");
  const [subiendoDoc, setSubiendoDoc] = useState(false);
  const [docABorrar, setDocABorrar] = useState(null);

  const [guardandoConfig, setGuardandoConfig] = useState(false);
  const [resolviendo, setResolviendo] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [avisosRes, epiRes, justRes, configRes, docsRes] = await Promise.all([
        axios.get(`${API}/avisos-clima`),
        axios.get(`${API}/solicitudes-epi`),
        axios.get(`${API}/justificantes-medicos`),
        axios.get(`${API}/configuracion/prevencion`),
        axios.get(`${API}/documentos-firma`, { params: { categoria: "prevencion" } }),
      ]);
      setAvisos(avisosRes.data);
      setSolicitudesEpi(epiRes.data);
      setJustificantes(justRes.data);
      setDocumentos(docsRes.data);
      setConfig({
        protocolo_baja: configRes.data.protocolo_baja || "",
        mutua_nombre: configRes.data.mutua_nombre || "",
        mutua_url: configRes.data.mutua_url || "",
      });
    } catch (err) {
      console.error("Error cargando prevención (admin):", err);
      toast.error("No se pudo cargar la información");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const crearAviso = async () => {
    if (!avisoForm.motivo || !avisoForm.fecha_inicio) {
      toast.error("Indica al menos el motivo y la fecha de inicio");
      return;
    }
    setCreandoAviso(true);
    try {
      await axios.post(`${API}/avisos-clima`, {
        motivo: avisoForm.motivo,
        descripcion: avisoForm.descripcion.trim(),
        fecha_inicio: avisoForm.fecha_inicio,
        fecha_fin: avisoForm.fecha_fin || null,
      });
      toast.success("Aviso enviado a toda la plantilla");
      setDialogAvisoOpen(false);
      setAvisoForm(emptyAviso);
      await cargar();
    } catch (err) {
      console.error("Error creando aviso:", err);
      toast.error("No se pudo crear el aviso");
    } finally {
      setCreandoAviso(false);
    }
  };

  const desactivarAviso = async (id) => {
    try {
      await axios.put(`${API}/avisos-clima/${id}/desactivar`);
      toast.success("Aviso desactivado");
      await cargar();
    } catch (err) {
      console.error("Error desactivando aviso:", err);
      toast.error("No se pudo desactivar");
    }
  };

  const resolverEpi = async (id, accion) => {
    setResolviendo(id);
    try {
      await axios.put(`${API}/solicitudes-epi/${id}/${accion}`);
      toast.success(accion === "aprobar" ? "Solicitud aprobada" : "Solicitud rechazada");
      await cargar();
    } catch (err) {
      console.error("Error resolviendo solicitud EPI:", err);
      toast.error(err?.response?.data?.detail || "No se pudo resolver");
    } finally {
      setResolviendo(null);
    }
  };

  const guardarConfig = async () => {
    setGuardandoConfig(true);
    try {
      await axios.put(`${API}/configuracion/prevencion`, {
        protocolo_baja: config.protocolo_baja.trim(),
        mutua_nombre: config.mutua_nombre.trim(),
        mutua_url: config.mutua_url.trim(),
      });
      toast.success("Configuración guardada");
    } catch (err) {
      console.error("Error guardando configuración:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardandoConfig(false);
    }
  };

  const subirDocumento = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!nombreDoc.trim()) {
      toast.error("Ponle antes un nombre al documento");
      return;
    }
    setSubiendoDoc(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        await axios.post(`${API}/documentos-firma`, {
          nombre: nombreDoc.trim(),
          pdf: reader.result,
          categoria: "prevencion",
        });
        toast.success("Documento subido, ya está disponible para firmar");
        setNombreDoc("");
        await cargar();
      } catch (err) {
        console.error("Error subiendo documento:", err);
        toast.error(err?.response?.data?.detail || "No se pudo subir el documento");
      } finally {
        setSubiendoDoc(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const borrarDocumento = async () => {
    if (!docABorrar) return;
    try {
      await axios.delete(`${API}/documentos-firma/${docABorrar.id}`);
      toast.success("Documento eliminado");
      setDocABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error borrando documento:", err);
      toast.error("No se pudo eliminar");
    }
  };

  const avisosActivos = avisos.filter((a) => a.activo);
  const solicitudesPendientes = solicitudesEpi.filter((s) => s.estado === "pendiente");
  const solicitudesResueltas = solicitudesEpi.filter((s) => s.estado !== "pendiente");

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  return (
    <div data-testid="admin-prevencion-page">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center">
            <HardHat className="w-6 h-6 text-amber-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Prevención
            </h1>
            <p className="text-sm text-slate-500">Avisos, EPI, protocolo de baja y justificantes</p>
          </div>
        </div>
        <Button
          onClick={() => setDialogAvisoOpen(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white"
          data-testid="btn-nuevo-aviso-clima"
        >
          <Plus className="w-4 h-4 mr-2" />
          Aviso climatológico
        </Button>
      </div>

      {/* Avisos climatologicos activos */}
      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
            <CloudRain className="w-3.5 h-3.5" />
            Avisos activos
          </p>
          {avisosActivos.length === 0 ? (
            <p className="text-sm text-slate-400">No hay ningún aviso activo ahora mismo.</p>
          ) : (
            <div className="space-y-2">
              {avisosActivos.map((a) => (
                <div
                  key={a.id}
                  className="flex items-start justify-between gap-3 bg-amber-50 border border-amber-100 rounded-lg p-3"
                  data-testid={`admin-aviso-${a.id}`}
                >
                  <div>
                    <p className="font-medium text-amber-900">
                      {MOTIVOS.find((m) => m.value === a.motivo)?.label || a.motivo}
                    </p>
                    <p className="text-xs text-amber-700">
                      {a.fecha_inicio}
                      {a.fecha_fin ? ` → ${a.fecha_fin}` : ""}
                    </p>
                    {a.descripcion && <p className="text-sm text-amber-800 mt-1">{a.descripcion}</p>}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => desactivarAviso(a.id)}
                    className="border-amber-200 text-amber-700 hover:bg-amber-100 shrink-0"
                    data-testid={`btn-desactivar-aviso-${a.id}`}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    Desactivar
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Solicitudes de EPI */}
      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            Solicitudes de material EPI
          </p>
          {solicitudesPendientes.length === 0 ? (
            <p className="text-sm text-slate-400">No hay solicitudes pendientes.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {solicitudesPendientes.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between py-2.5"
                  data-testid={`solicitud-epi-${s.id}`}
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">
                      {EPI_TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo} x{s.cantidad}
                    </p>
                    <p className="text-xs text-slate-500">
                      {s.operario_nombre}
                      {s.notas ? ` · ${s.notas}` : ""}
                    </p>
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => resolverEpi(s.id, "rechazar")}
                      disabled={resolviendo === s.id}
                      className="border-red-200 text-red-600 hover:bg-red-50"
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => resolverEpi(s.id, "aprobar")}
                      disabled={resolviendo === s.id}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
          {solicitudesResueltas.length > 0 && (
            <details className="pt-1">
              <summary className="text-xs text-slate-400 cursor-pointer">
                Ver resueltas ({solicitudesResueltas.length})
              </summary>
              <div className="divide-y divide-slate-100 mt-2">
                {solicitudesResueltas.map((s) => {
                  const aprobada = s.estado === "aprobada";
                  const Icon = aprobada ? CheckCircle : XCircle;
                  return (
                    <div key={s.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-slate-600">
                        {EPI_TIPOS.find((t) => t.value === s.tipo)?.label || s.tipo} x{s.cantidad} ·{" "}
                        {s.operario_nombre}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1 text-xs font-medium ${
                          aprobada ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        {aprobada ? "Aprobada" : "Rechazada"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </details>
          )}
        </CardContent>
      </Card>

      {/* Documentos de prevencion */}
      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-4 space-y-3">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            Documentos de prevención
          </p>
          <div className="flex items-end gap-2 flex-wrap">
            <div className="space-y-1.5 flex-1 min-w-[200px]">
              <Label>Nombre del documento</Label>
              <Input
                value={nombreDoc}
                onChange={(e) => setNombreDoc(e.target.value)}
                placeholder="Ej. Protocolo de uso de EPI"
                data-testid="nombre-documento-input"
              />
            </div>
            <label
              className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed cursor-pointer transition-colors shrink-0 ${
                subiendoDoc
                  ? "opacity-60 border-slate-200"
                  : "border-slate-300 hover:border-indigo-400 hover:bg-indigo-50/50"
              }`}
            >
              <input
                type="file"
                accept="application/pdf"
                onChange={subirDocumento}
                disabled={subiendoDoc}
                className="hidden"
                data-testid="documento-file-input"
              />
              <Upload className="w-4 h-4 text-slate-500" />
              <span className="text-sm text-slate-600">
                {subiendoDoc ? "Subiendo..." : "Subir PDF"}
              </span>
            </label>
          </div>

          {documentos.length === 0 ? (
            <p className="text-sm text-slate-400">Todavía no has subido ningún documento.</p>
          ) : (
            <div className="divide-y divide-slate-100">
              {documentos.map((d) => (
                <div
                  key={d.id}
                  className="flex items-center justify-between py-2.5"
                  data-testid={`admin-documento-${d.id}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">{d.nombre}</p>
                    {d.firmado ? (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" />
                        Firmado por {d.firmado_por_nombre}
                      </p>
                    ) : (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <PenLine className="w-3 h-3" />
                        Pendiente de firma
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <a
                      href={d.pdf_firmado_url || d.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="p-2 text-slate-400 hover:text-indigo-600"
                      title="Ver PDF"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      type="button"
                      onClick={() => setDocABorrar(d)}
                      className="p-2 text-slate-400 hover:text-red-600"
                      title="Eliminar"
                      data-testid={`borrar-documento-${d.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Protocolo de baja / mutua */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
              <ShieldAlert className="w-3.5 h-3.5" />
              Protocolo en caso de baja
            </p>
            <div className="space-y-1.5">
              <Label>Protocolo de actuación</Label>
              <Textarea
                value={config.protocolo_baja}
                onChange={(e) => setConfig((c) => ({ ...c, protocolo_baja: e.target.value }))}
                placeholder="Ej. Avisar al encargado, llamar a la mutua, acudir al centro más cercano..."
                rows={5}
                data-testid="protocolo-baja-textarea"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Nombre de la mutua</Label>
                <Input
                  value={config.mutua_nombre}
                  onChange={(e) => setConfig((c) => ({ ...c, mutua_nombre: e.target.value }))}
                  data-testid="mutua-nombre-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>URL centros de la mutua</Label>
                <Input
                  value={config.mutua_url}
                  onChange={(e) => setConfig((c) => ({ ...c, mutua_url: e.target.value }))}
                  placeholder="https://..."
                  data-testid="mutua-url-input"
                />
              </div>
            </div>
            <Button
              onClick={guardarConfig}
              disabled={guardandoConfig}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-config-prevencion-btn"
            >
              {guardandoConfig ? "Guardando..." : "Guardar"}
            </Button>
          </CardContent>
        </Card>

        {/* Justificantes medicos */}
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5" />
              Justificantes médicos subidos
            </p>
            {justificantes.length === 0 ? (
              <p className="text-sm text-slate-400">Nadie ha subido justificantes todavía.</p>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {justificantes.map((j) => (
                  <a
                    key={j.id}
                    href={j.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-3 hover:bg-slate-50 rounded-lg p-1.5 -mx-1.5"
                    data-testid={`admin-justificante-${j.id}`}
                  >
                    <img
                      src={j.url}
                      alt=""
                      className="w-12 h-12 rounded-lg object-cover border border-slate-200 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-800 flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-400" />
                        {j.operario_nombre}
                      </p>
                      <p className="text-xs text-slate-500 truncate">
                        {j.descripcion || "Sin descripción"}
                      </p>
                      <p className="text-xs text-slate-400">
                        {new Date(j.creado_en).toLocaleDateString("es-ES")}
                      </p>
                    </div>
                  </a>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Dialogo nuevo aviso climatologico */}
      <Dialog open={dialogAvisoOpen} onOpenChange={setDialogAvisoOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nuevo aviso climatológico</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Motivo</Label>
              <Select
                value={avisoForm.motivo}
                onValueChange={(v) => setAvisoForm((f) => ({ ...f, motivo: v }))}
              >
                <SelectTrigger data-testid="aviso-motivo-select">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {MOTIVOS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Desde</Label>
                <Input
                  type="date"
                  value={avisoForm.fecha_inicio}
                  onChange={(e) => setAvisoForm((f) => ({ ...f, fecha_inicio: e.target.value }))}
                  data-testid="aviso-fecha-inicio-input"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Hasta (opcional)</Label>
                <Input
                  type="date"
                  value={avisoForm.fecha_fin}
                  onChange={(e) => setAvisoForm((f) => ({ ...f, fecha_fin: e.target.value }))}
                  data-testid="aviso-fecha-fin-input"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Descripción (opcional)</Label>
              <Textarea
                value={avisoForm.descripcion}
                onChange={(e) => setAvisoForm((f) => ({ ...f, descripcion: e.target.value }))}
                placeholder="Detalles adicionales para la plantilla"
                rows={2}
                data-testid="aviso-descripcion-input"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogAvisoOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={crearAviso}
              disabled={creandoAviso}
              className="bg-amber-600 hover:bg-amber-700 text-white"
              data-testid="confirmar-aviso-btn"
            >
              {creandoAviso ? "Enviando..." : "Enviar a toda la plantilla"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!docABorrar} onOpenChange={(open) => !open && setDocABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar este documento?</AlertDialogTitle>
            <AlertDialogDescription>
              {docABorrar?.firmado
                ? "Este documento ya está firmado. Al eliminarlo se perderá también la firma."
                : "Esta acción no se puede deshacer."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrarDocumento} className="bg-red-600 hover:bg-red-700">
              <Trash2 className="w-4 h-4 mr-2" />
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default AdminPrevencionPage;
