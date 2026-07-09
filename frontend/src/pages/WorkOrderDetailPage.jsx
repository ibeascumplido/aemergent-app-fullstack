import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ClipboardList,
  Building2,
  FileText,
  Clock,
  Calendar,
  Users,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import axios from "axios";

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

const WorkOrderDetailPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [parte, setParte] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setNotFound(false);
    (async () => {
      try {
        const res = await axios.get(`${API}/work-orders/${id}`);
        if (cancelado) return;
        setParte(res.data);
        // Cargar cliente para poder linkar de vuelta a su ficha
        try {
          const c = await axios.get(`${API}/clients/${res.data.client_slug}`);
          if (!cancelado) setCliente(c.data);
        } catch (err) {
          // Si el cliente no se puede cargar, seguimos sin info extra
        }
      } catch (err) {
        if (!cancelado) {
          if (err?.response?.status === 404) {
            setNotFound(true);
          } else {
            console.error("Error cargando parte:", err);
            toast.error("Error al cargar el parte");
          }
        }
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [id]);

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
            No se encontró el parte{" "}
            <span className="font-mono">{id?.slice(0, 8)}</span>.
          </CardContent>
        </Card>
      </div>
    );
  }

  const sessions = parte.sessions || [];
  const totalHoras = sessions.reduce((acc, s) => {
    try {
      const [h1, m1] = s.hora_inicio.split(":").map(Number);
      const [h2, m2] = s.hora_fin.split(":").map(Number);
      const min = h2 * 60 + m2 - (h1 * 60 + m1);
      return acc + (min > 0 ? min / 60 : 0);
    } catch {
      return acc;
    }
  }, 0);

  return (
    <div data-testid="work-order-detail-page" className="max-w-4xl">
      {/* Cabecera */}
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() =>
            cliente ? navigate(`/clients/${cliente.slug}`) : navigate(-1)
          }
          className="mb-2 text-slate-600 hover:text-slate-900 -ml-3"
          size="sm"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          {cliente ? `Volver a ${cliente.nombre}` : "Volver"}
        </Button>

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
        </div>
      </div>

      {/* Aviso: pagina en solo lectura */}
      <Card className="border-amber-200 bg-amber-50 mb-6">
        <CardContent className="p-4">
          <p className="text-sm text-amber-900">
            <strong>Vista de solo lectura.</strong> La edición y añadido de sesiones
            estará disponible en la siguiente entrega. De momento puedes ver los datos
            del parte y sus sesiones registradas.
          </p>
        </CardContent>
      </Card>

      {/* Resumen rápido */}
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

      {/* Lista de sesiones */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-slate-900">Sesiones registradas</h2>
      </div>

      {sessions.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400" data-testid="no-sessions">
            Este parte todavía no tiene sesiones registradas.
            <br />
            <span className="text-xs text-slate-400">
              La función para añadir sesiones llegará en la próxima entrega.
            </span>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {sessions.map((s) => (
            <Card key={s.id} className="border-slate-100" data-testid={`session-${s.id}`}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 text-sm">
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
                  </div>
                  {s.operarios_ids.length + (s.operarios_texto_libre ? 1 : 0) > 0 && (
                    <span className="text-xs text-slate-500 inline-flex items-center gap-1">
                      <Users className="w-3.5 h-3.5" />
                      {s.operarios_ids.length +
                        (s.operarios_texto_libre ? 1 : 0)}{" "}
                      operario/s
                    </span>
                  )}
                </div>
                {s.notas && (
                  <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">
                    {s.notas}
                  </p>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default WorkOrderDetailPage;
