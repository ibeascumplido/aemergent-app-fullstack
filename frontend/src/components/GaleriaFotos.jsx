import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Camera, Trash2, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const MESES_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

const formatearFechaCorta = (fechaISO) => {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
};

const formatearFechaLarga = (fechaISO) => {
  const [y, m, d] = fechaISO.split("-");
  return `${Number(d)} de ${MESES_ES[Number(m) - 1]} de ${y}`;
};

const agruparPorLote = (fotos) => {
  const mapa = {};
  const orden = [];
  fotos.forEach((f) => {
    const clave = f.lote_id || `individual-${f.id}`;
    if (!mapa[clave]) {
      mapa[clave] = [];
      orden.push(clave);
    }
    mapa[clave].push(f);
  });
  return orden.map((clave) => mapa[clave]);
};

/**
 * Galeria de fotos ya clasificadas (Fase 8). Dos modos:
 * - workOrderId: modo simple, las fotos de ese parte, agrupadas por lote.
 * - clientId: modo "Fotografias" del cliente (una seccion mas, junto a
 *   partes/ubicaciones), con filtros de fecha, antes/despues, operario y
 *   zona (esta ultima pendiente), agrupado por dia.
 * Si no hay fotos, no renderiza nada (con filtros activos, si muestra el
 * bloque para poder cambiar el filtro).
 */
const GaleriaFotos = ({ workOrderId, clientId, titulo = "Fotos" }) => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const modoArchivo = !!clientId;

  const [fotos, setFotos] = useState([]);
  const [operarios, setOperarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const [fechaDesde, setFechaDesde] = useState("");
  const [fechaHasta, setFechaHasta] = useState("");
  const [antesDespues, setAntesDespues] = useState("none");
  const [operarioId, setOperarioId] = useState("none");

  useEffect(() => {
    if (modoArchivo) {
      axios
        .get(`${API}/users/operarios`)
        .then((res) => setOperarios(res.data))
        .catch(() => setOperarios([]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoArchivo]);

  const cargar = async () => {
    try {
      const params = workOrderId ? { work_order_id: workOrderId } : { client_id: clientId };
      if (modoArchivo) {
        if (fechaDesde) params.fecha_desde = fechaDesde;
        if (fechaHasta) params.fecha_hasta = fechaHasta;
        if (antesDespues !== "none") params.antes_despues = antesDespues;
        if (operarioId !== "none") params.operario_id = operarioId;
      }
      const res = await axios.get(`${API}/fotos`, { params });
      setFotos(res.data);
    } catch (err) {
      console.error("Error cargando fotos:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workOrderId, clientId, fechaDesde, fechaHasta, antesDespues, operarioId]);

  const eliminarFoto = async (e, fotoId) => {
    e.stopPropagation();
    try {
      await axios.delete(`${API}/fotos/${fotoId}`);
      toast.success("Foto eliminada");
      await cargar();
    } catch (err) {
      console.error("Error eliminando foto:", err);
      toast.error("Error al eliminar la foto");
    }
  };

  const grupos = useMemo(() => agruparPorLote(fotos), [fotos]);

  const gruposPorFecha = useMemo(() => {
    if (!modoArchivo) return null;
    const porFecha = {};
    fotos.forEach((f) => {
      const clave = f.fecha || f.creado_en.slice(0, 10);
      if (!porFecha[clave]) porFecha[clave] = [];
      porFecha[clave].push(f);
    });
    return Object.entries(porFecha)
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([fecha, fotosDelDia]) => ({ fecha, grupos: agruparPorLote(fotosDelDia) }));
  }, [fotos, modoArchivo]);

  const renderMiniatura = (f) => (
    <div key={f.id} className="group relative">
      <button
        type="button"
        onClick={() =>
          modoArchivo ? navigate(`/fotos/lote/${f.lote_id || f.id}`) : setFotoAmpliada(f)
        }
        className="block w-20 h-20 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all"
        data-testid={`foto-${f.id}`}
      >
        <img src={f.url} alt="" className="w-full h-full object-cover" />
        <div className="absolute bottom-1 left-1 right-1 flex items-center gap-1 flex-wrap">
          {f.antes_despues && (
            <span
              className={`text-[9px] font-bold px-1 py-0.5 rounded text-white ${
                f.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
              }`}
            >
              {f.antes_despues === "antes" ? "Antes" : "Después"}
            </span>
          )}
          {f.fecha && !modoArchivo && (
            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-black/60 text-white">
              {formatearFechaCorta(f.fecha)}
            </span>
          )}
        </div>
      </button>
      {isAdmin && !modoArchivo && (
        <button
          type="button"
          onClick={(e) => eliminarFoto(e, f.id)}
          className="absolute top-1 right-1 bg-black/50 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
          data-testid={`borrar-foto-${f.id}`}
        >
          <Trash2 className="w-3 h-3" />
        </button>
      )}
    </div>
  );

  if (loading) return null;
  if (!modoArchivo && fotos.length === 0) return null;

  return (
    <>
      <div className="mb-6" data-testid="galeria-fotos">
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-slate-400" />
          {titulo} {fotos.length > 0 && `(${fotos.length})`}
        </h2>

        {modoArchivo && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-4 p-3 rounded-lg border border-slate-100 bg-slate-50/50">
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
        )}

        {modoArchivo ? (
          fotos.length === 0 ? (
            <p className="text-sm text-slate-400 py-4">No hay fotos con estos filtros.</p>
          ) : (
            <div className="space-y-5">
              {gruposPorFecha.map(({ fecha, grupos: gruposDia }) => (
                <div key={fecha}>
                  <p className="text-sm font-semibold text-slate-700 mb-2 capitalize">
                    {formatearFechaLarga(fecha)}
                  </p>
                  <div className="space-y-2">
                    {gruposDia.map((grupo) => {
                      const primera = grupo[0];
                      return (
                        <div
                          key={grupo.map((f) => f.id).join("-")}
                          className="border border-slate-100 rounded-lg p-2.5"
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <p className="text-xs text-slate-400">{primera.operario_nombre}</p>
                            {primera.work_order_titulo && (
                              <p className="text-xs text-slate-400">
                                {primera.work_order_titulo}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {grupo.map((f) => renderMiniatura(f))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="space-y-3">
            {grupos.map((grupo) => {
              const primera = grupo[0];
              return (
                <div
                  key={grupo.map((f) => f.id).join("-")}
                  className="border border-slate-100 rounded-lg p-3"
                  data-testid={`grupo-fotos-${primera.lote_id || primera.id}`}
                >
                  <div className="flex gap-2 flex-wrap">{grupo.map((f) => renderMiniatura(f))}</div>
                  {primera.audio_url && (
                    <audio controls src={primera.audio_url} className="w-full max-w-xs mt-2 h-8" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 text-white"
          >
            <X className="w-6 h-6" />
          </button>
          <div
            className="flex flex-col items-center gap-3 max-w-full max-h-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img
              src={fotoAmpliada.url}
              alt=""
              className="max-w-full max-h-[70vh] rounded-lg object-contain"
            />
            <div className="flex items-center gap-2 flex-wrap justify-center">
              {fotoAmpliada.antes_despues && (
                <span
                  className={`text-xs font-medium px-2 py-1 rounded text-white ${
                    fotoAmpliada.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                >
                  {fotoAmpliada.antes_despues === "antes" ? "Antes" : "Después"}
                </span>
              )}
              {fotoAmpliada.fecha && (
                <span className="text-xs text-white/80 bg-white/10 px-2 py-1 rounded">
                  {new Date(fotoAmpliada.fecha + "T00:00:00").toLocaleDateString("es-ES")}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default GaleriaFotos;
