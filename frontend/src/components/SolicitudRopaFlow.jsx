import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Shirt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
 * Acceso rapido desde el dashboard (Fase 9 parte 7): el operario pide una
 * prenda+talla al administrador. Al aprobarla, se descuenta del stock de
 * Ropa automaticamente (backend); aqui solo se envia la peticion.
 */
const SolicitudRopaFlow = () => {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [prendas, setPrendas] = useState([]);
  const [prendaId, setPrendaId] = useState("");
  const [talla, setTalla] = useState("");
  const [cantidad, setCantidad] = useState(1);
  const [notas, setNotas] = useState("");
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    if (dialogOpen && prendas.length === 0) {
      axios
        .get(`${API}/ropa`)
        .then((res) => setPrendas(res.data))
        .catch(() => setPrendas([]));
    }
  }, [dialogOpen, prendas.length]);

  const abrir = () => {
    setPrendaId("");
    setTalla("");
    setCantidad(1);
    setNotas("");
    setDialogOpen(true);
  };

  const prendaActiva = prendas.find((p) => p.id === prendaId);

  const enviar = async () => {
    if (!prendaId) {
      toast.error("Selecciona una prenda");
      return;
    }
    if (!talla) {
      toast.error("Selecciona una talla");
      return;
    }
    setEnviando(true);
    try {
      await axios.post(`${API}/solicitudes-ropa`, {
        prenda_id: prendaId,
        talla,
        cantidad: Number(cantidad) || 1,
        notas: notas.trim(),
      });
      toast.success("Solicitud enviada");
      setDialogOpen(false);
    } catch (err) {
      console.error("Error enviando la solicitud:", err);
      toast.error(err?.response?.data?.detail || "No se pudo enviar la solicitud");
    } finally {
      setEnviando(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={abrir}
        className="mb-8 flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-semibold text-lg shadow-sm transition-colors bg-amber-500 hover:bg-amber-600"
        data-testid="solicitud-ropa-btn"
      >
        <Shirt className="w-6 h-6" />
        Solicitud de ropa
      </button>

      <Dialog open={dialogOpen} onOpenChange={(v) => !enviando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Solicitar ropa de trabajo</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Prenda</Label>
              <Select
                value={prendaId}
                onValueChange={(v) => {
                  setPrendaId(v);
                  setTalla("");
                }}
              >
                <SelectTrigger data-testid="solicitud-prenda-select">
                  <SelectValue placeholder="Selecciona..." />
                </SelectTrigger>
                <SelectContent>
                  {prendas.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.nombre}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {prendaActiva && (
              <div className="space-y-1.5">
                <Label>Talla</Label>
                <Select value={talla} onValueChange={setTalla}>
                  <SelectTrigger data-testid="solicitud-talla-select">
                    <SelectValue placeholder="Selecciona..." />
                  </SelectTrigger>
                  <SelectContent>
                    {prendaActiva.tallas.map((t) => (
                      <SelectItem key={t.talla} value={t.talla}>
                        {t.talla}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {prendaActiva.tallas.length === 0 && (
                  <p className="text-xs text-slate-400">
                    Esta prenda todavía no tiene tallas configuradas.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Cantidad</Label>
              <Input
                type="number"
                min="1"
                max="20"
                value={cantidad}
                onChange={(e) => setCantidad(e.target.value)}
                className="w-24"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Notas (opcional)</Label>
              <Textarea
                value={notas}
                onChange={(e) => setNotas(e.target.value)}
                rows={2}
                placeholder="Ej. es para sustituir una rota"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={enviar}
              disabled={enviando}
              className="bg-amber-500 hover:bg-amber-600 text-white"
              data-testid="enviar-solicitud-ropa-btn"
            >
              {enviando ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default SolicitudRopaFlow;
