import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Camera, MessageCircle, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import ComentariosLote from "@/components/ComentariosLote";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const formatearFecha = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
};

/**
 * Pagina personal (Fase 8 parte 4): cualquier usuario ve las fotos que
 * el mismo ha subido con "Foto rapida", agrupadas por sesion, y puede
 * abrir la conversacion para responder si el admin le ha preguntado algo.
 */
const MisFotosPage = () => {
  const [fotos, setFotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [abierto, setAbierto] = useState(null); // lote_id del grupo expandido

  useEffect(() => {
    axios
      .get(`${API}/fotos`, { params: { mias: true } })
      .then((res) => setFotos(res.data))
      .catch((err) => console.error("Error cargando mis fotos:", err))
      .finally(() => setLoading(false));
  }, []);

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
    return orden.map((clave) => ({ clave, fotos: mapa[clave] }));
  }, [fotos]);

  return (
    <div data-testid="mis-fotos-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Camera className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Mis fotos
          </h1>
          <p className="text-sm text-slate-500">Lo que has enviado con Foto rápida</p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : grupos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            Todavía no has enviado ninguna foto.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {grupos.map(({ clave, fotos: grupo }) => {
            const primera = grupo[0];
            const expandido = abierto === clave;
            return (
              <div key={clave} className="border border-slate-200 rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                  <p className="text-xs text-slate-400">
                    {primera.fecha ? formatearFecha(primera.fecha) : formatearFecha(primera.creado_en.slice(0, 10))}
                    {primera.client_nombre && ` · ${primera.client_nombre}`}
                    {primera.work_order_titulo && ` · ${primera.work_order_titulo}`}
                    {!primera.client_nombre && " · Sin clasificar todavía"}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAbierto(expandido ? null : clave)}
                    className="inline-flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium"
                    data-testid={`toggle-conversacion-${clave}`}
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    Conversación
                    {expandido ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {grupo.map((f) => (
                    <div key={f.id} className="relative">
                      <img
                        src={f.url}
                        alt=""
                        className="w-20 h-20 rounded-lg object-cover border border-slate-200"
                      />
                      {f.antes_despues && (
                        <span
                          className={`absolute bottom-1 left-1 text-[9px] font-bold px-1 py-0.5 rounded text-white ${
                            f.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
                          }`}
                        >
                          {f.antes_despues === "antes" ? "Antes" : "Desp."}
                        </span>
                      )}
                    </div>
                  ))}
                </div>

                {primera.audio_url && (
                  <audio controls src={primera.audio_url} className="w-full max-w-xs mt-2 h-8" />
                )}

                {expandido && (
                  <div className="mt-3">
                    <ComentariosLote loteId={primera.lote_id || primera.id} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default MisFotosPage;
