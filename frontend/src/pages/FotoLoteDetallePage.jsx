import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Camera } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import ComentariosLote from "@/components/ComentariosLote";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Pagina compartida admin/operario (Fase 8 parte 5): destino directo al
 * pinchar una notificacion de conversacion sobre fotos. Antes había que
 * volver al listado y buscar el grupo correcto entre varios; ahora se
 * llega directo a esta foto/grupo y su chat.
 */
const FotoLoteDetallePage = () => {
  const { loteId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [fotos, setFotos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [loading, setLoading] = useState(true);

  const [clienteSel, setClienteSel] = useState("");
  const [woSel, setWoSel] = useState("none");
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const [fotosRes, clientesRes] = await Promise.all([
        axios.get(`${API}/fotos`, { params: { lote_id: loteId } }),
        isAdmin ? axios.get(`${API}/clients`) : Promise.resolve({ data: [] }),
      ]);
      setFotos(fotosRes.data);
      setClientes(clientesRes.data);
      if (fotosRes.data[0]?.client_id) {
        setClienteSel(fotosRes.data[0].client_id);
      }
    } catch (err) {
      console.error("Error cargando la foto:", err);
      toast.error("No se pudo cargar esta conversación");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loteId]);

  useEffect(() => {
    if (!clienteSel) {
      setWorkOrders([]);
      return;
    }
    const cliente = clientes.find((c) => c.id === clienteSel);
    if (!cliente) return;
    axios
      .get(`${API}/clients/${cliente.slug}/work-orders`)
      .then((res) => setWorkOrders(res.data))
      .catch(() => setWorkOrders([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clienteSel]);

  const primera = fotos[0];

  useEffect(() => {
    if (primera?.work_order_id) setWoSel(primera.work_order_id);
  }, [primera]);

  const guardarClasificacion = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API}/fotos/lote/${loteId}/clasificar`, {
        client_id: clienteSel || null,
        work_order_id: woSel === "none" ? null : woSel,
      });
      toast.success("Clasificación guardada");
      await cargar();
    } catch (err) {
      console.error("Error guardando clasificación:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (fotos.length === 0) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontró esta conversación.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="foto-lote-detalle-page">
      <Button
        variant="ghost"
        onClick={() => navigate(isAdmin ? "/fotos-por-clasificar" : "/mis-fotos")}
        className="mb-4 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Camera className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            {fotos.length > 1 ? `${fotos.length} fotos` : "Foto"}
          </h1>
          <p className="text-sm text-slate-500">Enviadas por {primera.operario_nombre}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4">
        {fotos.map((f) => (
          <div key={f.id} className="relative">
            <img
              src={f.url}
              alt=""
              className="w-24 h-24 rounded-lg object-cover border border-slate-200"
            />
            {f.antes_despues && (
              <span
                className={`absolute bottom-1 left-1 text-[9px] font-bold px-1.5 py-0.5 rounded text-white ${
                  f.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
                }`}
              >
                {f.antes_despues === "antes" ? "Antes" : "Después"}
              </span>
            )}
          </div>
        ))}
      </div>

      {primera.fecha && (
        <p className="text-xs text-slate-400 mb-4">
          {new Date(primera.fecha + "T00:00:00").toLocaleDateString("es-ES")}
        </p>
      )}

      {primera.audio_url && (
        <audio controls src={primera.audio_url} className="w-full max-w-sm mb-4 h-9" />
      )}

      {isAdmin ? (
        <Card className="border-slate-100 mb-6">
          <CardContent className="p-4 space-y-3">
            <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
              Clasificación
            </p>
            <div className="space-y-1.5">
              <label className="text-xs text-slate-500">Cliente</label>
              <Select value={clienteSel} onValueChange={setClienteSel}>
                <SelectTrigger data-testid="foto-cliente-select">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {clientes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {clienteSel && (
              <div className="space-y-1.5">
                <label className="text-xs text-slate-500">Parte de trabajo (opcional)</label>
                <Select value={woSel} onValueChange={setWoSel}>
                  <SelectTrigger data-testid="foto-parte-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Sin parte concreto</SelectItem>
                    {workOrders.map((wo) => (
                      <SelectItem key={wo.id} value={wo.id}>
                        {wo.titulo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <Button
              onClick={guardarClasificacion}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-clasificacion-btn"
            >
              {guardando ? "Guardando..." : "Guardar clasificación"}
            </Button>
          </CardContent>
        </Card>
      ) : (
        (primera.client_nombre || primera.work_order_titulo) && (
          <p className="text-sm text-slate-500 mb-6">
            {primera.client_nombre}
            {primera.work_order_titulo && ` · ${primera.work_order_titulo}`}
          </p>
        )
      )}

      <div>
        <p className="text-xs uppercase tracking-wider text-slate-500 font-medium mb-2">
          Conversación
        </p>
        <ComentariosLote loteId={loteId} />
      </div>
    </div>
  );
};

export default FotoLoteDetallePage;
