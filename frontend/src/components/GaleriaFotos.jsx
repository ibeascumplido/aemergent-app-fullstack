import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatearFechaCorta = (fechaISO) => {
  const [, m, d] = fechaISO.split("-");
  return `${d}/${m}`;
};

/**
 * Galeria reutilizable de fotos ya clasificadas (Fase 8). Se usa tanto en
 * la ficha del cliente (todas sus fotos) como dentro de un parte de
 * trabajo concreto (solo las de ese parte). Si no hay fotos, no renderiza
 * nada - no añade una seccion vacia a la pagina.
 *
 * Las fotos se agrupan por lote_id (la sesion de captura en la que se
 * tomaron juntas): asi el audio de la nota de voz se muestra UNA vez por
 * grupo, no repetido en cada foto individual.
 */
const GaleriaFotos = ({ workOrderId, clientId, titulo = "Fotos" }) => {
  const { isAdmin } = useAuth();
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const cargar = async () => {
    try {
      const params = workOrderId ? { work_order_id: workOrderId } : { client_id: clientId };
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
  }, [workOrderId, clientId]);

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

  const grupos = useMemo(() => {
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
  }, [fotos]);

  if (loading || fotos.length === 0) return null;

  return (
    <>
      <div className="mb-6" data-testid="galeria-fotos">
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-slate-400" />
          {titulo} ({fotos.length})
        </h2>
        <div className="space-y-3">
          {grupos.map((grupo) => {
            const primera = grupo[0];
            return (
              <div
                key={grupo.map((f) => f.id).join("-")}
                className="border border-slate-100 rounded-lg p-3"
                data-testid={`grupo-fotos-${primera.lote_id || primera.id}`}
              >
                <div className="flex gap-2 flex-wrap">
                  {grupo.map((f) => (
                    <div key={f.id} className="group relative">
                      <button
                        type="button"
                        onClick={() => setFotoAmpliada(f)}
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
                          {f.fecha && (
                            <span className="text-[9px] font-medium px-1 py-0.5 rounded bg-black/60 text-white">
                              {formatearFechaCorta(f.fecha)}
                            </span>
                          )}
                        </div>
                      </button>
                      {isAdmin && (
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
                  ))}
                </div>
                {primera.audio_url && (
                  <audio
                    controls
                    src={primera.audio_url}
                    className="w-full max-w-xs mt-2 h-8"
                  />
                )}
              </div>
            );
          })}
        </div>
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
            {/* El audio ya se muestra una vez por grupo en la lista, no aqui, para no repetirlo */}
          </div>
        </div>
      )}
    </>
  );
};

export default GaleriaFotos;
