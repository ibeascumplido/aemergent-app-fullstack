import { useState } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

// TEMP: espejo de la lista hardcodeada de ClientsPage.
// Se sustituirá por fetch al backend cuando exista el modelo Client (Entrega 2).
const CLIENTES_INICIALES = [
  { id: "sanitas", nombre: "SANITAS" },
  { id: "leroy-merlin", nombre: "LEROY MERLIN" },
  { id: "ikea", nombre: "IKEA" },
  { id: "iberdrola", nombre: "IBERDROLA" },
  { id: "style-outlet", nombre: "STYLE OUTLET" },
  { id: "clarins", nombre: "CLARINS" },
  { id: "galp", nombre: "GALP" },
];

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
    key: "partes",
    titulo: "Partes de trabajo",
    descripcion: "Registros de intervenciones",
    icon: ClipboardList,
    color: "indigo",
  },
  {
    key: "presupuestos",
    titulo: "Presupuestos asociados",
    descripcion: "Presupuestos vinculados a este cliente",
    icon: FileText,
    color: "red",
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
  const { id } = useParams();
  const navigate = useNavigate();
  const cliente = CLIENTES_INICIALES.find((c) => c.id === id);

  // Fallback si alguien entra a una url de cliente inexistente.
  if (!cliente) {
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
            No se encontró el cliente <span className="font-mono">{id}</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  // Logo: intenta cargar /logos/<id>.png y si falla muestra el icono Building2 con color.
  // Los logos los subirá el usuario después a frontend/public/logos/.
  const [logoOk, setLogoOk] = useState(true);
  const logoUrl = `/logos/${cliente.id}.png`;

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
            style={{ backgroundColor: logoOk ? "#fff" : colorDe(cliente.nombre) }}
          >
            {logoOk ? (
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

      {/* Grid de secciones */}
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
