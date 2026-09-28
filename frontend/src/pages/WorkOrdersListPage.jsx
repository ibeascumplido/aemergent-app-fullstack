import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Search, ChevronRight, MapPin, Building2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FILTROS_ESTADO = [
  { value: "", label: "Todos" },
  { value: "abierto", label: "Abiertos" },
  { value: "cerrado", label: "Cerrados" },
  { value: "archivado", label: "Archivados" },
];

const ESTADOS = {
  abierto: { txt: "Abierto", cls: "bg-emerald-100 text-emerald-700" },
  cerrado: { txt: "Cerrado", cls: "bg-slate-200 text-slate-700" },
  archivado: { txt: "Archivado", cls: "bg-amber-100 text-amber-700" },
};

const WorkOrdersListPage = () => {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(`${API}/work-orders/accesibles`, {
        params: filtroEstado ? { estado: filtroEstado } : {},
      })
      .then((res) => {
        if (!cancelado) setPartes(res.data || []);
      })
      .catch((err) => console.error("Error cargando partes:", err))
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtroEstado]);

  const partesFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return partes;
    return partes.filter((wo) =>
      [wo.titulo, wo.client_nombre, wo.centro_nombre, wo.numero]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [partes, searchTerm]);

  return (
    <div data-testid="work-orders-list-page">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <ClipboardList className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Partes de trabajo
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Todos los partes de la empresa" : "Los partes en los que participas"}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, número, cliente o centro..."
            className="pl-9"
            data-testid="buscador-partes"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value || "todos"}
              type="button"
              onClick={() => setFiltroEstado(f.value)}
              data-testid={`filtro-estado-${f.value || "todos"}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtroEstado === f.value
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-2 sm:p-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando partes...</p>
          ) : partesFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8" data-testid="no-partes-accesibles">
              {partes.length === 0
                ? isAdmin
                  ? "Todavía no hay ningún parte de trabajo."
                  : "Todavía no participas en ningún parte de trabajo."
                : "No hay partes que coincidan con la búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {partesFiltrados.map((wo) => {
                const b = ESTADOS[wo.estado] || ESTADOS.abierto;
                return (
                  <button
                    key={wo.id}
                    type="button"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="w-full flex items-center gap-3 py-3 px-2 text-left hover:bg-slate-50 transition-colors rounded"
                    data-testid={`parte-accesible-${wo.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm truncate max-w-xs">
                          {wo.titulo || wo.numero || "Parte sin título"}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${b.cls}`}>{b.txt}</span>
                      </div>
                      {wo.numero && wo.titulo && (
                        <p className="text-xs text-slate-400 mt-0.5">{wo.numero}</p>
                      )}
                      {wo.client_nombre && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {wo.client_nombre}
                        </p>
                      )}
                      {wo.centro_nombre && (
                        <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {wo.centro_nombre}
                        </p>
                      )}
                      {wo.creado_en && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Creado {new Date(wo.creado_en).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default WorkOrdersListPage;
