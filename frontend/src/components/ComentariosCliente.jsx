import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { MessageSquare, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Comentarios del operario (Fase 16): notas rapidas con fecha, viven
 * dentro del bloque de Actividad junto a Fotos y Tareas pendientes.
 */
const ComentariosCliente = ({ clientId }) => {
  const { user, isAdmin } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/comentarios-cliente`, { params: { client_id: clientId } });
      setComentarios(res.data);
    } catch (err) {
      console.error("Error cargando comentarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const enviar = async () => {
    if (!texto.trim()) return;
    setEnviando(true);
    try {
      await axios.post(`${API}/comentarios-cliente`, { client_id: clientId, texto: texto.trim() });
      setTexto("");
      await cargar();
    } catch (err) {
      console.error("Error enviando comentario:", err);
      toast.error("No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  const eliminar = async (id) => {
    try {
      await axios.delete(`${API}/comentarios-cliente/${id}`);
      await cargar();
    } catch (err) {
      console.error("Error eliminando comentario:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading) return null;

  return (
    <div data-testid="comentarios-cliente">
      <h3 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-slate-400" />
        Comentarios del operario
      </h3>

      <div className="flex items-start gap-2 mb-4">
        <Textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          placeholder="Escribe una nota rápida sobre este cliente..."
          rows={2}
          className="flex-1"
          data-testid="nuevo-comentario-input"
        />
        <Button
          size="sm"
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="bg-amber-500 hover:bg-amber-600 text-white shrink-0"
          data-testid="enviar-comentario-btn"
        >
          <Send className="w-4 h-4" />
        </Button>
      </div>

      {comentarios.length === 0 ? (
        <p className="text-sm text-slate-400">Sin comentarios todavía.</p>
      ) : (
        <div className="space-y-2">
          {comentarios.map((c) => (
            <div
              key={c.id}
              className="flex items-start justify-between gap-2 px-3 py-2 rounded-lg bg-amber-50/50 border border-amber-100"
              data-testid={`comentario-${c.id}`}
            >
              <div className="min-w-0">
                <p className="text-sm text-slate-700">{c.texto}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {c.creado_por_nombre} · {new Date(c.creado_en).toLocaleDateString("es-ES")}
                </p>
              </div>
              {(isAdmin || c.creado_por === user?.user_id) && (
                <button
                  type="button"
                  onClick={() => eliminar(c.id)}
                  className="text-slate-300 hover:text-red-500 shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ComentariosCliente;
