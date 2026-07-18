import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Camera, Trash2, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Galeria reutilizable de fotos ya clasificadas (Fase 8). Se usa tanto en
 * la ficha del cliente (todas sus fotos) como dentro de un parte de
 * trabajo concreto (solo las de ese parte). Si no hay fotos, no renderiza
 * nada - no añade una seccion vacia a la pagina.
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

  if (loading || fotos.length === 0) return null;

  return (
    <>
      <div className="mb-6" data-testid="galeria-fotos">
        <h2 className="text-lg font-semibold text-slate-900 mb-3 flex items-center gap-2">
          <Camera className="w-5 h-5 text-slate-400" />
          {titulo} ({fotos.length})
        </h2>
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
          {fotos.map((f) => (
            <div key={f.id} className="group relative">
              <button
                type="button"
                onClick={() => setFotoAmpliada(f)}
                className="block w-full aspect-square rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all"
                data-testid={`foto-${f.id}`}
              >
                <img src={f.url} alt="" className="w-full h-full object-cover" />
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
          <img
            src={fotoAmpliada.url}
            alt=""
            className="max-w-full max-h-full rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
};

export default GaleriaFotos;
