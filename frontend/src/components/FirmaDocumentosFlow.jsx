import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { PenLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
 * Acceso rapido desde el dashboard (Fase 11): localizar un parte abierto
 * de un cliente registrado y saltar directo a firmarlo presencialmente.
 * Elige cliente -> lista de sus partes abiertos (marcando cuales ya
 * estan firmados) -> al confirmar, navega al parte con ?firmar=1 para
 * que se abra el dialogo de firma presencial automaticamente.
 */
const FirmaDocumentosFlow = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");

  const [partes, setPartes] = useState(null);
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
    setClienteId("");
    setPartes(null);
    setParteSeleccionado("");
    setDialogOpen(true);
  };

  const onCambiarCliente = async (id) => {
    setClienteId(id);
    setParteSeleccionado("");
    setCargandoPartes(true);
    try {
      const res = await axios.get(`${API}/work-orders`, {
        params: { client_id: id, estado: "abierto" },
      });
      setPartes(res.data);
    } catch (err) {
      console.error("Error buscando partes:", err);
      setPartes([]);
    } finally {
      setCargandoPartes(false);
    }
  };

  const continuar = () => {
    if (!clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!parteSeleccionado) {
      toast.error("Selecciona un parte");
      return;
    }
    setContinuando(true);
    setDialogOpen(false);
    navigate(`/work-orders/${parteSeleccionado}?firmar=1`);
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="group relative flex flex-col items-center justify-center gap-3 py-7 px-3 rounded-2xl bg-gradient-to-br from-slate-800 via-slate-900 to-slate-900 border border-slate-700/50 hover:border-slate-500/60 transition-colors overflow-hidden"
        data-testid="firma-documentos-btn"
      >
        <div
          className="absolute w-12 h-3 rounded-full blur-md opacity-70"
          style={{ backgroundColor: "#94a3b8", top: "calc(50% + 6px)" }}
        />
        <div className="relative w-14 h-14 rounded-full bg-black/40 flex items-center justify-center shadow-inner">
          <PenLine
            className="w-6 h-6 text-slate-300"
            style={{ filter: "drop-shadow(0 0 6px rgba(148,163,184,0.7))" }}
          />
        </div>
        <span className="text-sm font-medium text-slate-100">Firma de documentos</span>
      </button>

      <Dialog open={dialogOpen} onOpenChange={(v) => !continuando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm max-h-[85dvh] flex flex-col p-0 gap-0">
          <DialogHeader className="p-6 pb-2 shrink-0">
            <DialogTitle>Firmar un parte</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 overflow-y-auto min-h-0 flex-1 px-6 py-2">
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <Select value={clienteId} onValueChange={onCambiarCliente}>
                <SelectTrigger data-testid="firma-cliente-select">
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

            {clienteId && (
              <div className="space-y-1.5">
                <Label>Parte</Label>
                {cargandoPartes ? (
                  <p className="text-xs text-slate-400">Buscando partes abiertos...</p>
                ) : partes && partes.length > 0 ? (
                  <Select value={parteSeleccionado} onValueChange={setParteSeleccionado}>
                    <SelectTrigger data-testid="firma-parte-select">
                      <SelectValue placeholder="Elige un parte..." />
                    </SelectTrigger>
                    <SelectContent>
                      {partes.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          <span className="flex items-center gap-1.5">
                            {p.firma_cliente && (
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            )}
                            {p.titulo}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <p className="text-xs text-slate-400">
                    Este cliente no tiene partes abiertos.
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter className="p-6 pt-3 border-t border-slate-100 shrink-0">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={continuando}>
              Cancelar
            </Button>
            <Button
              onClick={continuar}
              disabled={continuando || cargandoPartes}
              className="bg-slate-800 hover:bg-slate-900 text-white"
              data-testid="continuar-firma-documentos-btn"
            >
              Ir a firmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FirmaDocumentosFlow;
