import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { ListChecks, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const PRIORIDAD_DOT = {
  5: "bg-red-500",
  4: "bg-orange-500",
  3: "bg-amber-500",
  2: "bg-slate-400",
  1: "bg-slate-300",
};

/**
 * Widget del dashboard (Fase 13) para el administrador: todas las
 * tareas pendientes de cualquier cliente/centro, agrupadas por cliente,
 * para ver de un vistazo que queda por hacer en cualquier sitio.
 */
const TareasAdminWidget = () => {
  const [tareas, setTareas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get(`${API}/tareas-centro/pendientes-todas`)
      .then((res) => setTareas(res.data))
      .catch((err) => console.error("Error cargando tareas pendientes:", err))
      .finally(() => setLoading(false));
  }, []);

  if (loading || tareas.length === 0) return null;

  const porCliente = tareas.reduce((acc, t) => {
    const clave = t.client_id;
    if (!acc[clave]) acc[clave] = { nombre: t.client_nombre, tareas: [] };
    acc[clave].tareas.push(t);
    return acc;
  }, {});

  return (
    <Card className="border-slate-100 shadow-sm mb-6" data-testid="tareas-admin-widget">
      <CardContent className="p-4">
        <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2 mb-3">
          <ListChecks className="w-4 h-4 text-slate-400" />
          Tareas pendientes ({tareas.length})
        </h2>
        <div className="space-y-3">
          {Object.entries(porCliente).map(([clientId, grupo]) => (
            <div key={clientId}>
              <Link
                to={`/clients/${clientId}`}
                className="flex items-center justify-between text-sm font-medium text-slate-700 hover:text-indigo-600 mb-1.5"
              >
                {grupo.nombre} ({grupo.tareas.length})
                <ChevronRight className="w-4 h-4 text-slate-300" />
              </Link>
              <div className="space-y-1">
                {grupo.tareas.slice(0, 4).map((t) => (
                  <div key={t.id} className="flex items-center gap-2 text-xs text-slate-500 pl-1">
                    <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${PRIORIDAD_DOT[t.prioridad]}`} />
                    <span className="truncate">{t.descripcion}</span>
                    {t.centro_nombre && (
                      <span className="text-slate-300 shrink-0">· {t.centro_nombre}</span>
                    )}
                  </div>
                ))}
                {grupo.tareas.length > 4 && (
                  <p className="text-xs text-slate-300 pl-1">
                    +{grupo.tareas.length - 4} más
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
};

export default TareasAdminWidget;
