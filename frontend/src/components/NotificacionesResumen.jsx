import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Bell, Check, CheckCheck, Trash2, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  calcularDestino,
  getNotificationIcon,
  getNotificationBgColor,
  formatTime,
} from "@/lib/notificaciones";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const LIMITE_INICIAL = 6;
const PASO = 15;

const NotificacionesResumen = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [sinLeer, setSinLeer] = useState(0);
  const [loading, setLoading] = useState(true);
  const [soloSinLeer, setSoloSinLeer] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const [mostrar, setMostrar] = useState(LIMITE_INICIAL);
  const [expandida, setExpandida] = useState(null);

  const cargar = useCallback(async () => {
    try {
      const [n, c] = await Promise.all([
        axios.get(`${API}/notifications`, { params: { limit: 300 } }),
        axios.get(`${API}/notifications/count`),
      ]);
      setItems(n.data);
      setSinLeer(c.data.unread_count);
    } catch (e) {
      console.error("Error cargando notificaciones:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargar();
    const t = setInterval(cargar, 30000);
    return () => clearInterval(t);
  }, [cargar]);

  const marcarLeida = async (id) => {
    try {
      await axios.post(`${API}/notifications/${id}/read`);
      setItems((p) => p.map((n) => (n.id === id ? { ...n, read: true } : n)));
      setSinLeer((p) => Math.max(0, p - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const marcarTodas = async () => {
    try {
      await axios.post(`${API}/notifications/read-all`);
      setItems((p) => p.map((n) => ({ ...n, read: true })));
      setSinLeer(0);
    } catch (e) {
      console.error(e);
    }
  };

  const eliminar = async (n) => {
    try {
      await axios.delete(`${API}/notifications/${n.id}`);
      setItems((p) => p.filter((x) => x.id !== n.id));
      if (!n.read) setSinLeer((p) => Math.max(0, p - 1));
    } catch (e) {
      console.error(e);
    }
  };

  const abrir = async (n) => {
    if (!n.read) await marcarLeida(n.id);
    const destino = calcularDestino(n);
    if (destino) navigate(destino);
  };

  const lista = soloSinLeer ? items.filter((n) => !n.read) : items;
  const visibles = lista.slice(0, mostrar);
  const restantes = lista.length - visibles.length;

  return (
    <Card className="border-slate-100 shadow-sm" data-testid="notificaciones-resumen">
      <CardHeader className={`pb-4 ${abierto ? "border-b border-slate-50" : ""} ${sinLeer > 0 ? "bg-blue-50/60" : ""}`}>
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <button
            type="button"
            className="flex items-center gap-2 text-left flex-1 min-w-0"
            onClick={() => { setAbierto((v) => !v); setMostrar(LIMITE_INICIAL); }}
            aria-expanded={abierto}
            data-testid="notificaciones-toggle"
          >
            <Bell className={`w-5 h-5 flex-shrink-0 ${sinLeer > 0 ? "text-red-500" : "text-slate-400"}`} />
            <div className="min-w-0">
              <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Notificaciones</CardTitle>
              <p className={`text-sm ${sinLeer > 0 ? "text-red-600 font-medium" : "text-slate-500"}`}>
                {loading
                  ? "Cargando..."
                  : sinLeer > 0
                  ? `Tienes ${sinLeer} ${sinLeer === 1 ? "notificación nueva" : "notificaciones nuevas"}`
                  : "No hay notificaciones nuevas"}
              </p>
            </div>
            {abierto ? <ChevronUp className="w-5 h-5 text-slate-400 ml-auto" /> : <ChevronDown className="w-5 h-5 text-slate-400 ml-auto" />}
          </button>
          {abierto && (
          <div className="flex items-center gap-1">
            <Button
              variant={soloSinLeer ? "default" : "outline"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setSoloSinLeer((v) => !v)}
            >
              Sin leer
            </Button>
            {sinLeer > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs text-slate-500" onClick={marcarTodas}>
                <CheckCheck className="w-3 h-3 mr-1" />
                Marcar todas
              </Button>
            )}
          </div>
          )}
        </div>
      </CardHeader>
      {abierto && (
      <CardContent className="p-0">
        {loading ? (
          <div className="p-6 text-center text-slate-400">Cargando...</div>
        ) : lista.length === 0 ? (
          <div className="p-8 text-center">
            <Bell className="w-10 h-10 text-slate-200 mx-auto mb-2" />
            <p className="text-slate-500 text-sm">
              {soloSinLeer ? "No tienes notificaciones sin leer" : "No tienes notificaciones"}
            </p>
          </div>
        ) : (
          <>
            <ul className="divide-y divide-slate-100">
              {visibles.map((n) => {
                const destino = calcularDestino(n);
                const abierta = expandida === n.id;
                return (
                  <li key={n.id} className={`p-3 hover:bg-slate-50 transition-colors ${getNotificationBgColor(n.type, n.read)}`}>
                    <div className="flex gap-3">
                      <div className="flex-shrink-0 mt-0.5">{getNotificationIcon(n.type)}</div>
                      <div
                        className={`flex-1 min-w-0 ${destino ? "cursor-pointer" : ""}`}
                        onClick={() => abrir(n)}
                      >
                        <p className={`text-sm ${n.read ? "text-slate-600" : "text-slate-900 font-medium"}`}>{n.title}</p>
                        <p className={`text-sm text-slate-500 mt-0.5 ${abierta ? "" : "line-clamp-2"}`}>{n.message}</p>
                        <p className="text-xs text-slate-400 mt-1">{formatTime(n.created_at)}</p>
                      </div>
                      <div className="flex-shrink-0 flex flex-col gap-1">
                        {!n.read && (
                          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-green-600" title="Marcar como leída" onClick={() => marcarLeida(n.id)}>
                            <Check className="w-3 h-3" />
                          </Button>
                        )}
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-slate-700" title={abierta ? "Ver menos" : "Ver detalle"} onClick={() => setExpandida(abierta ? null : n.id)}>
                          {abierta ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400 hover:text-red-600" title="Eliminar" onClick={() => eliminar(n)}>
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            {(restantes > 0 || mostrar > LIMITE_INICIAL) && (
              <div className="p-2 border-t border-slate-100 flex justify-center gap-2">
                {restantes > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs text-slate-600" onClick={() => setMostrar((m) => m + PASO)}>
                    Ver {Math.min(PASO, restantes)} más ({restantes} restantes)
                  </Button>
                )}
                {mostrar > LIMITE_INICIAL && (
                  <Button variant="ghost" size="sm" className="text-xs text-slate-500" onClick={() => setMostrar(LIMITE_INICIAL)}>
                    Ver menos
                  </Button>
                )}
              </div>
            )}
          </>
        )}
      </CardContent>
      )}
    </Card>
  );
};

export default NotificacionesResumen;
