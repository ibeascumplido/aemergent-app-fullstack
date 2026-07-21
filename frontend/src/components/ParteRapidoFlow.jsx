import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Acceso rapido desde el dashboard (Fase 9 parte 7) para iniciar un parte
 * de trabajo sin tener que navegar Clientes -> cliente -> parte. Si el
 * cliente elegido tiene partes abiertos, deja elegir uno; si no tiene
 * ninguno, se crea uno nuevo. Si el cliente aun no esta registrado, se
 * puede escribir el nombre a mano (el admin lo vincula despues).
 */
const ParteRapidoFlow = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [clientes, setClientes] = useState([]);
  const [clienteRegistrado, setClienteRegistrado] = useState(true);
  const [clienteId, setClienteId] = useState("");
  const [clienteLibre, setClienteLibre] = useState("");

  const [partesAbiertos, setPartesAbiertos] = useState(null); // null = aun no consultado
  const [parteSeleccionado, setParteSeleccionado] = useState("");
  const [cargandoPartes, setCargandoPartes] = useState(false);
  const [continuando, setContinuando] = useState(false);

  useEffect(() => {
    if (dialogOpen && clientes.length === 0) {
      axios
        .get(`${API}/clients`)
        .then((res) => setClientes(res.data))
        .catch(() => setClientes([]));
    }
  }, [dialogOpen, clientes.length]);

  const abrir = () => {
    setClienteRegistrado(true);
    setClienteId("");
    setClienteLibre("");
    setPartesAbiertos(null);
    setParteSeleccionado("");
    setDialogOpen(true);
  };

  const buscarPartesAbiertos = async (idCliente) => {
    setCargandoPartes(true);
    try {
      const res = await axios.get(`${API}/work-orders`, {
        params: { client_id: idCliente, estado: "abierto" },
      });
      setPartesAbiertos(res.data);
      if (res.data.length === 1) setParteSeleccionado(res.data[0].id);
    } catch (err) {
      console.error("Error buscando partes abiertos:", err);
      setPartesAbiertos([]);
    } finally {
      setCargandoPartes(false);
    }
  };

  const onCambiarCliente = (id) => {
    setClienteId(id);
    setParteSeleccionado("");
    buscarPartesAbiertos(id);
  };

  const tituloRapido = () => {
    const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    return `Parte rápido - ${hoy}`;
  };

  const continuar = async () => {
    if (clienteRegistrado && !clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!clienteRegistrado && !clienteLibre.trim()) {
      toast.error("Escribe el nombre del cliente");
      return;
    }
    setContinuando(true);
    try {
      let workOrderId = parteSeleccionado || null;

      if (!workOrderId) {
        const payload = clienteRegistrado
          ? { client_id: clienteId, titulo: tituloRapido() }
          : { client_libre: clienteLibre.trim(), titulo: tituloRapido() };
        const res = await axios.post(`${API}/work-orders`, payload);
        workOrderId = res.data.id;
      }

      setDialogOpen(false);
      navigate(`/work-orders/${workOrderId}?nueva=1`);
    } catch (err) {
      console.error("Error iniciando el parte:", err);
      toast.error("No se pudo iniciar el parte");
    } finally {
      setContinuando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="mb-8 flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-semibold text-lg shadow-sm transition-colors bg-indigo-600 hover:bg-indigo-700"
        data-testid="parte-rapido-btn"
      >
        <ClipboardList className="w-6 h-6" />
        Parte de trabajo
      </button>

      <Dialog open={dialogOpen} onOpenChange={(v) => !continuando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>¿Para qué cliente?</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setClienteRegistrado(true)}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  clienteRegistrado
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
              >
                Cliente registrado
              </button>
              <button
                type="button"
                onClick={() => setClienteRegistrado(false)}
                className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                  !clienteRegistrado
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
                data-testid="cliente-no-registrado-btn"
              >
                No está registrado
              </button>
            </div>

            {clienteRegistrado ? (
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={clienteId} onValueChange={onCambiarCliente}>
                  <SelectTrigger data-testid="parte-rapido-cliente-select">
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
            ) : (
              <div className="space-y-1.5">
                <Label>Nombre del cliente</Label>
                <Input
                  value={clienteLibre}
                  onChange={(e) => setClienteLibre(e.target.value)}
                  placeholder="Ej. Panadería López"
                  data-testid="cliente-libre-input"
                />
                <p className="text-xs text-slate-400">
                  El administrador lo vinculará a un cliente registrado más adelante.
                </p>
              </div>
            )}

            {clienteRegistrado && clienteId && (
              <div className="space-y-1.5">
                <Label>Parte</Label>
                {cargandoPartes ? (
                  <p className="text-xs text-slate-400">Buscando partes abiertos...</p>
                ) : partesAbiertos && partesAbiertos.length > 0 ? (
                  <Select value={parteSeleccionado} onValueChange={setParteSeleccionado}>
                    <SelectTrigger data-testid="parte-existente-select">
                      <SelectValue placeholder="Elige un parte abierto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {partesAbiertos.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.titulo}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-slate-400">
                    Este cliente no tiene partes abiertos: se creará uno nuevo.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={continuando}>
              Cancelar
            </Button>
            <Button
              onClick={continuar}
              disabled={continuando || cargandoPartes}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="continuar-parte-rapido-btn"
            >
              {continuando ? "Abriendo..." : "Continuar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ParteRapidoFlow;
