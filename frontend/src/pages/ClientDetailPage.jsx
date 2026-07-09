import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Building2,
  Image as ImageIcon,
  AlertTriangle,
  ClipboardList,
  FileText,
  Users,
  ListTodo,
  MessageSquare,
  ChevronRight,
  Plus,
  Clock,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
import { toast } from "sonner";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Mismo esquema de color estable por nombre que en ClientsPage.
const COLORES = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const colorDe = (nombre) => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return COLORES[Math.abs(h) % COLORES.length];
};

// Definición de las 7 secciones del dashboard del cliente.
// Cada una tendrá su propia página/panel en entregas siguientes.
const SECCIONES = [
  {
    key: "fotografias",
    titulo: "Fotografías",
    descripcion: "Galería de imágenes del cliente",
    icon: ImageIcon,
    color: "sky",
  },
  {
    key: "incidencias",
    titulo: "Incidencias",
    descripcion: "Problemas y avisos abiertos",
    icon: AlertTriangle,
    color: "orange",
  },
  {
    key: "contactos",
    titulo: "Contactos de responsables",
    descripcion: "Personas de contacto y roles",
    icon: Users,
    color: "purple",
  },
  {
    key: "pendientes",
    titulo: "Trabajos pendientes",
    descripcion: "Asuntos y tareas por resolver",
    icon: ListTodo,
    color: "emerald",
  },
  {
    key: "comentarios",
    titulo: "Comentarios del operario",
    descripcion: "Notas con fecha y asunto",
    icon: MessageSquare,
    color: "amber",
  },
];

// Mapa de estilos por color (Tailwind necesita clases literales, no se pueden interpolar).
const COLOR_CLASSES = {
  sky: { bg: "bg-sky-50", text: "text-sky-600" },
  orange: { bg: "bg-orange-50", text: "text-orange-600" },
  indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  red: { bg: "bg-red-50", text: "text-red-500" },
  purple: { bg: "bg-purple-50", text: "text-purple-600" },
  emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
  amber: { bg: "bg-amber-50", text: "text-amber-600" },
};

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

const ClientDetailPage = () => {
  // El parámetro de ruta es el slug del cliente (URL-friendly, estable).
  const { id: slug } = useParams();
  const navigate = useNavigate();
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [logoOk, setLogoOk] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setNotFound(false);
    setLogoOk(true);
    (async () => {
      try {
        const res = await axios.get(`${API}/clients/${slug}`);
        if (!cancelado) setCliente(res.data);
      } catch (err) {
        if (!cancelado) {
          if (err?.response?.status === 404) {
            setNotFound(true);
          } else {
            console.error("Error cargando cliente:", err);
            toast.error("Error al cargar el cliente");
          }
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, [slug]);

  // Presupuestos asociados + totales por cliente (Fase 4)
  const [presupuestos, setPresupuestos] = useState([]);
  const [summary, setSummary] = useState({ count: 0, total_facturado: 0, total_pendiente: 0 });
  const [loadingBudgets, setLoadingBudgets] = useState(true);

  useEffect(() => {
    let cancelado = false;
    setLoadingBudgets(true);
    (async () => {
      try {
        const [resList, resSummary] = await Promise.all([
          axios.get(`${API}/clients/${slug}/budgets`),
          axios.get(`${API}/clients/${slug}/budgets/summary`),
        ]);
        if (!cancelado) {
          setPresupuestos(resList.data);
          setSummary(resSummary.data);
        }
      } catch (err) {
        // Silencioso: si no hay cliente, ya lo maneja el fetch principal.
        // Un 404 aqui solo pasa si se llama con slug invalido.
        if (err?.response?.status !== 404) {
          console.error("Error cargando presupuestos del cliente:", err);
        }
      } finally {
        if (!cancelado) setLoadingBudgets(false);
      }
    })();
    return () => { cancelado = true; };
  }, [slug]);

  // Formateador de euros (es-ES, base imponible)
  const fmtEur = (n) =>
    new Intl.NumberFormat("es-ES", {
      style: "currency",
      currency: "EUR",
    }).format(Number(n) || 0);

  // ==============================
  // Partes de trabajo (Fase 5A.2 parte 1)
  // ==============================
  const [partes, setPartes] = useState([]);
  const [partesSummary, setPartesSummary] = useState({
    total: 0,
    abiertos: 0,
    cerrados: 0,
    archivados: 0,
    total_horas: 0,
  });
  const [loadingPartes, setLoadingPartes] = useState(true);

  const [dialogNuevoParte, setDialogNuevoParte] = useState(false);
  const [nuevoParteForm, setNuevoParteForm] = useState({
    titulo: "",
    budget_template_id: "",
  });
  const [creandoParte, setCreandoParte] = useState(false);

  const fetchPartes = async () => {
    try {
      setLoadingPartes(true);
      const [resList, resSummary] = await Promise.all([
        axios.get(`${API}/clients/${slug}/work-orders`),
        axios.get(`${API}/clients/${slug}/work-orders/summary`),
      ]);
      setPartes(resList.data);
      setPartesSummary(resSummary.data);
    } catch (err) {
      if (err?.response?.status !== 404) {
        console.error("Error cargando partes:", err);
      }
    } finally {
      setLoadingPartes(false);
    }
  };

  useEffect(() => {
    fetchPartes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const abrirNuevoParte = () => {
    setNuevoParteForm({ titulo: "", budget_template_id: "" });
    setDialogNuevoParte(true);
  };

  const guardarNuevoParte = async () => {
    const titulo = nuevoParteForm.titulo.trim();
    if (!titulo) {
      toast.error("El titulo es obligatorio");
      return;
    }
    if (!cliente?.id) {
      toast.error("Cliente no cargado");
      return;
    }
    setCreandoParte(true);
    try {
      const payload = { client_id: cliente.id, titulo };
      if (nuevoParteForm.budget_template_id) {
        payload.budget_template_id = nuevoParteForm.budget_template_id;
      }
      const res = await axios.post(`${API}/work-orders`, payload);
      toast.success("Parte creado");
      setDialogNuevoParte(false);
      navigate(`/work-orders/${res.data.id}`);
    } catch (err) {
      console.error("Error creando parte:", err);
      const status = err?.response?.status;
      if (status === 404) toast.error("Cliente o presupuesto no encontrado");
      else toast.error("Error al crear el parte");
    } finally {
      setCreandoParte(false);
    }
  };

  const estadoBadge = (estado) => {
    const map = {
      abierto: { txt: "Abierto", cls: "bg-emerald-100 text-emerald-700" },
      cerrado: { txt: "Cerrado", cls: "bg-slate-200 text-slate-700" },
      archivado: { txt: "Archivado", cls: "bg-amber-100 text-amber-700" },
    };
    const b = map[estado] || map.abierto;
    return (
      <span className={`text-xs px-1.5 py-0.5 rounded ${b.cls}`}>{b.txt}</span>
    );
  };

  // Estado de carga inicial.
  if (loading) {
    return (
      <div data-testid="client-detail-loading" className="p-8 text-center text-slate-400">
        Cargando cliente...
      </div>
    );
  }

  // Cliente inexistente en la base de datos.
  if (notFound || !cliente) {
    return (
      <div data-testid="client-not-found">
        <Button
          variant="ghost"
          onClick={() => navigate("/clients")}
          className="mb-4 text-slate-600 hover:text-slate-900"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver a clientes
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontró el cliente <span className="font-mono">{slug}</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logo real del cliente: viene del backend en cliente.logo_url (data-URI base64 o URL).
  // Si no hay o falla la carga, mostramos el icono Building2 con color de marca.
  const logoUrl = cliente.logo_url || null;

  const abrirSeccion = (seccion) => {
    // Entregas siguientes engancharán rutas reales por sección.
    toast.info(`${seccion.titulo}: próximamente disponible`);
  };

  return (
    <div data-testid="client-detail-page">
      {/* Volver + breadcrumb ligero */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate("/clients")}
          className="mb-4 -ml-2 text-slate-600 hover:text-slate-900"
          data-testid="back-to-clients"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Clientes
        </Button>

        {/* Cabecera con logo + nombre */}
        <div className="flex items-center gap-5">
          <div
            className="w-20 h-20 rounded-2xl flex items-center justify-center overflow-hidden shrink-0 shadow-sm"
            style={{ backgroundColor: logoUrl && logoOk ? "#fff" : colorDe(cliente.nombre) }}
          >
            {logoUrl && logoOk ? (
              <img
                src={logoUrl}
                alt={cliente.nombre}
                className="w-full h-full object-contain p-2"
                onError={() => setLogoOk(false)}
                data-testid="client-logo"
              />
            ) : (
              <Building2 className="w-10 h-10 text-white" data-testid="client-logo-fallback" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope'] truncate">
              {cliente.nombre}
            </h1>
            <p className="text-slate-500 mt-1">Ficha del cliente</p>
          </div>
        </div>
      </div>

      {/* Tarjeta especial: Presupuestos asociados con totales reales */}
      <Card className="border-slate-100 shadow-sm mb-6" data-testid="section-presupuestos">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-50 flex items-center justify-center">
                <FileText className="w-6 h-6 text-red-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Presupuestos asociados</p>
                <p className="text-sm text-slate-500">
                  {loadingBudgets
                    ? "Cargando..."
                    : `${summary.count} ${summary.count === 1 ? "presupuesto" : "presupuestos"} en total`}
                </p>
              </div>
            </div>
            {!loadingBudgets && summary.count > 0 && (
              <button
                type="button"
                onClick={() => navigate(`/budgets?cliente=${encodeURIComponent(slug)}`)}
                className="text-sm text-indigo-600 hover:text-indigo-700 font-medium inline-flex items-center gap-1"
                data-testid="ver-todos-presupuestos"
              >
                Ver todos <ChevronRight className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Totales facturado + pendiente */}
          {!loadingBudgets && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-lg bg-green-50 border border-green-100 p-4">
                <p className="text-xs uppercase tracking-wider text-green-700 font-medium">
                  Facturado
                </p>
                <p className="text-2xl font-bold text-green-900 font-['JetBrains_Mono'] mt-1">
                  {fmtEur(summary.total_facturado)}
                </p>
                <p className="text-xs text-green-700 mt-1">base imponible</p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-4">
                <p className="text-xs uppercase tracking-wider text-amber-700 font-medium">
                  Pendiente por facturar
                </p>
                <p className="text-2xl font-bold text-amber-900 font-['JetBrains_Mono'] mt-1">
                  {fmtEur(summary.total_pendiente)}
                </p>
                <p className="text-xs text-amber-700 mt-1">base imponible</p>
              </div>
            </div>
          )}

          {/* Lista compacta de presupuestos recientes */}
          {loadingBudgets ? (
            <p className="text-sm text-slate-400 text-center py-4">Cargando presupuestos...</p>
          ) : presupuestos.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4" data-testid="no-presupuestos">
              Este cliente aun no tiene presupuestos vinculados
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {presupuestos.slice(0, 5).map((b) => (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => navigate(`/budgets/${b.id}`)}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 transition-colors px-2 -mx-2 rounded"
                  data-testid={`presupuesto-row-${b.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-medium text-indigo-600 text-sm">
                        {b.budget_number}
                      </span>
                      <span className="text-xs text-slate-400">{b.budget_date}</span>
                      {b.facturado && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          Facturado
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-slate-700 truncate mt-0.5">
                      {b.titulo || b.servicios_descripcion || "Sin titulo"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono font-medium text-slate-900 text-sm">
                      {fmtEur(b.total_base)}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
              {presupuestos.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-3">
                  Mostrando 5 de {presupuestos.length}. Pulsa "Ver todos" para el listado completo.
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tarjeta especial: Partes de trabajo (Fase 5A.2 parte 1) */}
      <Card className="border-slate-100 shadow-sm mb-6" data-testid="section-partes">
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
                <ClipboardList className="w-6 h-6 text-indigo-500" />
              </div>
              <div>
                <p className="font-semibold text-slate-900">Partes de trabajo</p>
                <p className="text-sm text-slate-500">
                  {loadingPartes
                    ? "Cargando..."
                    : `${partesSummary.total} ${partesSummary.total === 1 ? "parte" : "partes"} · ${partesSummary.total_horas} h totales`}
                </p>
              </div>
            </div>
            <Button
              onClick={abrirNuevoParte}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
              size="sm"
              data-testid="btn-nuevo-parte"
            >
              <Plus className="w-4 h-4 mr-1" />
              Nuevo parte
            </Button>
          </div>

          {!loadingPartes && partesSummary.total > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-lg bg-emerald-50 border border-emerald-100 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-emerald-700 font-medium">
                  Abiertos
                </p>
                <p className="text-2xl font-bold text-emerald-900 font-['JetBrains_Mono'] mt-1">
                  {partesSummary.abiertos}
                </p>
              </div>
              <div className="rounded-lg bg-slate-100 border border-slate-200 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-slate-600 font-medium">
                  Cerrados
                </p>
                <p className="text-2xl font-bold text-slate-800 font-['JetBrains_Mono'] mt-1">
                  {partesSummary.cerrados}
                </p>
              </div>
              <div className="rounded-lg bg-amber-50 border border-amber-100 p-3 text-center">
                <p className="text-xs uppercase tracking-wider text-amber-700 font-medium">
                  Archivados
                </p>
                <p className="text-2xl font-bold text-amber-900 font-['JetBrains_Mono'] mt-1">
                  {partesSummary.archivados}
                </p>
              </div>
            </div>
          )}

          {loadingPartes ? (
            <p className="text-sm text-slate-400 text-center py-4">Cargando partes...</p>
          ) : partes.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-4" data-testid="no-partes">
              Este cliente aun no tiene partes de trabajo
            </p>
          ) : (
            <div className="divide-y divide-slate-100 border-t border-slate-100">
              {partes.slice(0, 5).map((wo) => (
                <button
                  key={wo.id}
                  type="button"
                  onClick={() => navigate(`/work-orders/${wo.id}`)}
                  className="w-full flex items-center gap-3 py-3 text-left hover:bg-slate-50 transition-colors px-2 -mx-2 rounded"
                  data-testid={`parte-row-${wo.id}`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-slate-900 text-sm truncate max-w-xs">
                        {wo.titulo}
                      </span>
                      {estadoBadge(wo.estado)}
                      {wo.budget_number && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-mono">
                          {wo.budget_number}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Creado {new Date(wo.creado_en).toLocaleDateString("es-ES")}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                </button>
              ))}
              {partes.length > 5 && (
                <p className="text-xs text-slate-400 text-center pt-3">
                  Mostrando 5 de {partes.length}
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal: Nuevo parte de trabajo */}
      <Dialog open={dialogNuevoParte} onOpenChange={setDialogNuevoParte}>
        <DialogContent data-testid="dialog-nuevo-parte">
          <DialogHeader>
            <DialogTitle>Nuevo parte de trabajo</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="parte-titulo">Titulo</Label>
              <Input
                id="parte-titulo"
                value={nuevoParteForm.titulo}
                onChange={(e) =>
                  setNuevoParteForm((f) => ({ ...f, titulo: e.target.value }))
                }
                placeholder="Ej. Mantenimiento marzo 2026"
                data-testid="parte-titulo-input"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Presupuesto asociado (opcional)</Label>
              <Select
                value={nuevoParteForm.budget_template_id || "none"}
                onValueChange={(v) =>
                  setNuevoParteForm((f) => ({
                    ...f,
                    budget_template_id: v === "none" ? "" : v,
                  }))
                }
              >
                <SelectTrigger data-testid="parte-budget-select">
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
              <p className="text-xs text-slate-400">
                Vinculalo a un presupuesto para trazabilidad, o dejalo suelto si es un trabajo puntual.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => setDialogNuevoParte(false)}
              disabled={creandoParte}
            >
              Cancelar
            </Button>
            <Button
              onClick={guardarNuevoParte}
              disabled={creandoParte}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="parte-save-btn"
            >
              {creandoParte ? "Creando..." : "Crear y abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grid con las 5 secciones restantes (todas siguen en modo Proximamente) */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
      >
        {SECCIONES.map((s) => {
          const styles = COLOR_CLASSES[s.color];
          const Icon = s.icon;
          return (
            <motion.div key={s.key} variants={item}>
              <Card
                className="border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group h-full"
                onClick={() => abrirSeccion(s)}
                data-testid={`section-${s.key}`}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div
                      className={`w-12 h-12 rounded-xl ${styles.bg} flex items-center justify-center`}
                    >
                      <Icon className={`w-6 h-6 ${styles.text}`} />
                    </div>
                    <span className="text-2xl font-bold text-slate-300 font-['JetBrains_Mono']">
                      0
                    </span>
                  </div>
                  <p className="font-semibold text-slate-900 group-hover:text-slate-700 transition-colors">
                    {s.titulo}
                  </p>
                  <p className="text-sm text-slate-500 mt-1">{s.descripcion}</p>
                  <p className="text-xs text-slate-300 mt-3 uppercase tracking-wider">
                    Próximamente
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </motion.div>

      {/* Nota placeholder — se eliminará cuando las secciones sean reales */}
      <div className="mt-8 text-xs text-slate-400 text-center">
        Los datos de cada sección se conectarán al backend en la siguiente entrega.
      </div>
    </div>
  );
};

export default ClientDetailPage;
