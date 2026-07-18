import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Send } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Hilo de mensajes de un lote de fotos (Fase 8 parte 4). Reutilizable:
 * lo usa tanto el admin (desde el dialogo de clasificar) como el operario
 * (desde "Mis fotos"). Cada mensaje nuevo dispara una notificacion a la
 * otra parte por el sistema de notificaciones ya existente.
 */
const ComentariosLote = ({ loteId }) => {
  const { user } = useAuth();
  const [comentarios, setComentarios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const finRef = useRef(null);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/fotos/lote/${loteId}/comentarios`);
      setComentarios(res.data);
    } catch (err) {
      console.error("Error cargando comentarios:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (loteId) cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteId]);

  useEffect(() => {
    finRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [comentarios]);

  const enviar = async () => {
    const t = texto.trim();
    if (!t) return;
    setEnviando(true);
    try {
      const res = await axios.post(`${API}/fotos/lote/${loteId}/comentarios`, { texto: t });
      setComentarios((prev) => [...prev, res.data]);
      setTexto("");
    } catch (err) {
      console.error("Error enviando mensaje:", err);
      toast.error("No se pudo enviar el mensaje");
    } finally {
      setEnviando(false);
    }
  };

  if (!loteId) return null;

  return (
    <div className="border border-slate-200 rounded-lg overflow-hidden" data-testid="comentarios-lote">
      <div className="max-h-56 overflow-y-auto p-3 space-y-2 bg-slate-50">
        {loading ? (
          <p className="text-xs text-slate-400 text-center">Cargando...</p>
        ) : comentarios.length === 0 ? (
          <p className="text-xs text-slate-400 text-center">
            Sin mensajes todavía. Escribe algo si necesitas preguntar.
          </p>
        ) : (
          comentarios.map((c) => {
            const esMio = c.autor_id === user?.user_id;
            return (
              <div key={c.id} className={`flex ${esMio ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-1.5 text-sm ${
                    esMio
                      ? "bg-indigo-600 text-white"
                      : c.es_admin
                      ? "bg-purple-100 text-purple-900"
                      : "bg-white border border-slate-200 text-slate-700"
                  }`}
                >
                  {!esMio && (
                    <p className="text-[10px] font-semibold opacity-70 mb-0.5">
                      {c.autor_nombre}
                      {c.es_admin ? " · Admin" : ""}
                    </p>
                  )}
                  <p className="whitespace-pre-wrap">{c.texto}</p>
                </div>
              </div>
            );
          })
        )}
        <div ref={finRef} />
      </div>
      <div className="flex items-center gap-2 p-2 border-t border-slate-200 bg-white">
        <input
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              enviar();
            }
          }}
          placeholder="Escribe un mensaje..."
          className="flex-1 text-sm px-3 py-1.5 rounded-lg border border-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-400"
          data-testid="comentario-input"
        />
        <button
          type="button"
          onClick={enviar}
          disabled={enviando || !texto.trim()}
          className="p-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white transition-colors"
          data-testid="enviar-comentario-btn"
        >
          <Send className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default ComentariosLote;
