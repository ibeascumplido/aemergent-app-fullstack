import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, Trash2 } from "lucide-react";
import ComentariosLote from "@/components/ComentariosLote";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Pagina dedicada (Fase 8 parte 3): antes esto vivia como widget en el
 * dashboard, pero recargaba demasiado esa pantalla. Ahora es un apartado
 * propio del menu de administrador, entre Planificacion y Presupuestos.
 * El dashboard solo muestra un aviso ligero con el contador.
 */
const FotosPorClasificarPage = () => {
  const [fotos, setFotos] = useState([]);
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);

  const [fotoActiva, setFotoActiva] = useState(null);
  const [clienteSel, setClienteSel] = useState("");
  const [workOrders, setWorkOrders] = useState([]);
  const [woSel, setWoSel] = useState("none");
  const [gruposExpandidos, setGruposExpandidos] = useState(new Set());
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const [fotosRes, clientesRes] = await Promise.all([
        axios.get(`${API}/fotos`, { params: { solo_sin_clasificar: true } }),
        axios.get(`${API}/clients`),
      ]);
      setFotos(fotosRes.data);
      setClientes(clientesRes.data);
    } catch (err) {
      console.error("Error cargando fotos sin clasificar:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirClasificar = (foto) => {
    setFotoActiva(foto);
    setClienteSel(foto.client_id || "");
    setWoSel("none");
    setWorkOrders([]);
  };

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

  const guardarClasificacion = async () => {
    if (!clienteSel) {
      toast.error("Selecciona un cliente");
      return;
    }
    setGuardando(true);
    try {
      await axios.put(`${API}/fotos/${fotoActiva.id}/clasificar`, {
        client_id: clienteSel,
        work_order_id: woSel === "none" ? null : woSel,
      });
      toast.success("Foto clasificada");
      setFotoActiva(null);
      await cargar();
    } catch (err) {
      console.error("Error clasificando foto:", err);
      toast.error("Error al clasificar la foto");
    } finally {
      setGuardando(false);
    }
  };

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

  return (
    <div data-testid="fotos-por-clasificar-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
          <Camera className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Fotos por clasificar
          </h1>
          <p className="text-sm text-slate-500">
            {loading ? "Cargando..." : `${fotos.length} ${fotos.length === 1 ? "foto" : "fotos"} pendientes`}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : fotos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            No hay fotos pendientes de clasificar. 🎉
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {grupos.map((grupo) => {
            const primera = grupo[0];
            const clave = grupo.map((f) => f.id).join("-");
            const expandido = gruposExpandidos.has(clave);
            const LIMITE = 6;
            const visibles = expandido ? grupo : grupo.slice(0, LIMITE);
            const restantes = grupo.length - visibles.length;
            return (
              <div
                key={clave}
                className="border border-slate-100 rounded-lg p-3"
                data-testid={`grupo-sin-clasificar-${primera.lote_id || primera.id}`}
              >
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-slate-500 font-medium truncate">
                    {primera.operario_nombre}
                  </p>
                  {primera.fecha && (
                    <p className="text-[10px] text-slate-400 shrink-0">
                      {(() => {
                        const [, m, d] = primera.fecha.split("-");
                        return `${d}/${m}`;
                      })()}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {visibles.map((f) => (
                    <div key={f.id} className="group">
                      <button
                        type="button"
                        onClick={() => abrirClasificar(f)}
                        className="relative block w-14 h-14 rounded-lg overflow-hidden border border-slate-200 hover:ring-2 hover:ring-indigo-400 transition-all"
                        data-testid={`foto-sin-clasificar-${f.id}`}
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
                        <span
                          onClick={(e) => eliminarFoto(e, f.id)}
                          role="button"
                          tabIndex={0}
                          className="absolute top-0.5 right-0.5 bg-black/50 hover:bg-red-600 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Trash2 className="w-2.5 h-2.5" />
                        </span>
                      </button>
                    </div>
                  ))}
                  {restantes > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setGruposExpandidos((prev) => new Set(prev).add(clave))
                      }
                      className="w-14 h-14 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400 hover:border-indigo-300 hover:text-indigo-500 transition-colors"
                      data-testid={`expandir-grupo-${clave}`}
                    >
                      +{restantes}
                    </button>
                  )}
                </div>
                {primera.audio_url && (
                  <audio controls src={primera.audio_url} className="w-full mt-2 h-8" />
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!fotoActiva} onOpenChange={(v) => !guardando && !v && setFotoActiva(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Clasificar foto</DialogTitle>
          </DialogHeader>
          {fotoActiva && (
            <div className="space-y-3">
              <img
                src={fotoActiva.url}
                alt=""
                className="w-full max-h-64 object-contain rounded-lg bg-slate-50 border border-slate-200"
              />
              <p className="text-xs text-slate-400">
                Enviada por {fotoActiva.operario_nombre}
                {fotoActiva.fecha &&
                  ` · ${new Date(fotoActiva.fecha + "T00:00:00").toLocaleDateString("es-ES")}`}
              </p>
              {fotoActiva.antes_despues && (
                <span
                  className={`inline-block text-xs font-medium px-2 py-1 rounded text-white ${
                    fotoActiva.antes_despues === "antes" ? "bg-amber-500" : "bg-emerald-500"
                  }`}
                >
                  {fotoActiva.antes_despues === "antes" ? "Antes" : "Después"}
                </span>
              )}
              {fotoActiva.audio_url && (
                <audio controls src={fotoActiva.audio_url} className="w-full" />
              )}
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

              <div className="space-y-1.5">
                <label className="text-xs text-slate-500">Preguntar al operario</label>
                <ComentariosLote loteId={fotoActiva.lote_id} />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setFotoActiva(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={guardarClasificacion}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="guardar-clasificacion-btn"
            >
              {guardando ? "Guardando..." : "Clasificar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FotosPorClasificarPage;
