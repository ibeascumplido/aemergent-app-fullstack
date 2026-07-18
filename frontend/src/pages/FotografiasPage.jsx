import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Image as ImageIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatearFechaLarga = (fechaISO) => {
  const [y, m, d] = fechaISO.split("-");
  return `${Number(d)} de ${MESES_ES[Number(m) - 1]} de ${y}`;
};

/**
 * Archivo filtrable de fotografias (Fase 8 parte 6): todas las fotos que
 * han llegado a un cliente, organizadas por fecha, con filtros de
 * fecha/antes-despues/operario. El filtro de zona queda pendiente (cada
 * jardin tendra su propia zona todavia por definir).
 */
const FotografiasPage = () => {
  const navigate = useNavigate();
  const [fotos, setFotos] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [antesDespues, setAntesDespues] = useState("none");
  const [operarioId, setOperarioId] = useState("none");

  useEffect(() => {
    axios
      .get(`${API}/users/operarios`)
      .then((res) => setOperarios(res.data))
      .catch(() => setOperarios([]));
  }, []);

  const cargar = async () => {
    setLoading(true);
    try {
      const params = {};
      if (fechaDesde) params.fecha_desde = fechaDesde;
      if (fechaHasta) params.fecha_hasta = fechaHasta;
      if (antesDespues !== "none") params.antes_despues = antesDespues;
      if (operarioId !== "none") params.operario_id = operarioId;
      const res = await axios.get(`${API}/fotos`, { params });
      setFotos(res.data);
    } catch (err) {
      console.error("Error cargando fotografías:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fechaDesde, fechaHasta, antesDespues, operarioId]);

  // Agrupar por fecha (o por dia de creado_en si no tiene fecha propia),
  // y dentro de cada fecha, por lote (para no repetir audio por foto).
  const gruposPorFecha = useMemo(() => {
    const porFecha = {};
    fotos.forEach((f) => {
      const clave = f.fecha || f.creado_en.slice(0, 10);
      if (!porFecha[clave]) porFecha[clave] = [];
      porFecha[clave].push(f);
    });
    return Object.entries(porFecha)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, fotosDelDia]) => {
        const porLote = {};
        const orden = [];
        fotosDelDia.forEach((f) => {
          const clave = f.lote_id || `individual-${f.id}`;
          if (!porLote[clave]) {
            porLote[clave] = [];
            orden.push(clave);
          }
          porLote[clave].push(f);
        });
        return { fecha, grupos: orden.map((c) => porLote[c]) };
      });
  }, [fotos]);

  return (
    <div data-testid="fotografias-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <ImageIcon className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Fotografías
          </h1>
          <p className="text-sm text-slate-500">
            {loading ? "Cargando..." : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"}`}
          </p>
        </div>
      </div>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Desde</Label>
              <Input
                type="date"
                value={fechaDesde}
                onChange={(e) => setFechaDesde(e.target.value)}
                data-testid="filtro-fecha-desde"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Hasta</Label>
              <Input
                type="date"
                value={fechaHasta}
                onChange={(e) => setFechaHasta(e.target.value)}
                data-testid="filtro-fecha-hasta"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Antes / Después</Label>
              <Select value={antesDespues} onValueChange={setAntesDespues}>
                <SelectTrigger data-testid="filtro-antes-despues">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todas</SelectItem>
                  <SelectItem value="antes">Antes</SelectItem>
                  <SelectItem value="despues">Después</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Operario</Label>
              <Select value={operarioId} onValueChange={setOperarioId}>
                <SelectTrigger data-testid="filtro-operario">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Todos</SelectItem>
                  {operarios.map((o) => (
                    <SelectItem key={o.user_id} value={o.user_id}>
                      {o.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-400">Zona</Label>
              <Select disabled>
                <SelectTrigger className="text-slate-400" data-testid="filtro-zona">
                  <SelectValue placeholder="Próximamente" />
                </SelectTrigger>
                <SelectContent />
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : gruposPorFecha.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            No hay fotos con estos filtros.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {gruposPorFecha.map(({ fecha, grupos }) => (
            <div key={fecha}>
              <p className="text-sm font-semibold text-slate-700 mb-2 capitalize">
                {formatearFechaLarga(fecha)}
              </p>
              <div className="space-y-2">
                {grupos.map((grupo) => {
                  const primera = grupo[0];
                  return (
                    <div
                      key={grupo.map((f) => f.id).join("-")}
                      className="border border-slate-100 rounded-lg p-2.5"
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-slate-400">{primera.operario_nombre}</p>
                        <p className="text-xs text-slate-400">
                          {primera.client_nombre}
                          {primera.work_order_titulo && ` · ${primera.work_order_titulo}`}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {grupo.map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() =>
                              navigate(`/fotos/lote/${f.lote_id || f.id}`)
                            }
                            className="relative block w-16 h-16 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all"
                            data-testid={`foto-archivo-${f.id}`}
                          >
                            <img src={f.url} alt="" className="w-full h-full object-cover" />
                            {f.antes_despues && (
                              <span
                                className={`absolute bottom-0.5 left-0.5 text-[8px] font-bold px-1 rounded text-white ${
                                  f.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
                                }`}
                              >
                                {f.antes_despues === "antes" ? "A" : "D"}
                              </span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default FotografiasPage;
