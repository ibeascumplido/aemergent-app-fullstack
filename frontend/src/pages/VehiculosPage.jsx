import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Truck, Plus, AlertTriangle, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIAS_AVISO_PREVIO = 30;

const calcularAlerta = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha + "T00:00:00");
  const dias = Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return "vencida";
  if (dias <= DIAS_AVISO_PREVIO) return "proxima";
  return null;
};

const emptyForm = {
  matricula: "",
  marca: "",
  modelo: "",
  anio: "",
  kilometraje: "",
  fecha_itv: "",
  fecha_proxima_revision: "",
};

const VehiculosPage = () => {
  const { isAdmin } = useAuth();
  const navigate = useNavigate();
  const [vehiculos, setVehiculos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/vehiculos`);
      setVehiculos(res.data);
    } catch (err) {
      console.error("Error cargando vehículos:", err);
      toast.error("Error al cargar los vehículos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  const abrirNuevo = () => {
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const crear = async () => {
    if (!form.matricula.trim()) {
      toast.error("La matrícula es obligatoria");
      return;
    }
    setGuardando(true);
    try {
      await axios.post(`${API}/vehiculos`, {
        matricula: form.matricula.trim().toUpperCase(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        anio: form.anio ? Number(form.anio) : null,
        kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
        fecha_itv: form.fecha_itv || null,
        fecha_proxima_revision: form.fecha_proxima_revision || null,
      });
      toast.success("Vehículo creado");
      setDialogOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error creando vehículo:", err);
      toast.error("Error al crear el vehículo");
    } finally {
      setGuardando(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  return (
    <div data-testid="vehiculos-page">
      <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Truck className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Vehículos
            </h1>
            <p className="text-sm text-slate-500">
              {vehiculos.length} {vehiculos.length === 1 ? "vehículo" : "vehículos"}
            </p>
          </div>
        </div>
        {isAdmin && (
          <Button
            onClick={abrirNuevo}
            className="bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="nuevo-vehiculo-btn"
          >
            <Plus className="w-4 h-4 mr-2" />
            Nuevo vehículo
          </Button>
        )}
      </div>

      {vehiculos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400">
            Todavía no hay vehículos registrados.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {vehiculos.map((v) => {
            const alertaItv = calcularAlerta(v.fecha_itv);
            const alertaRevision = calcularAlerta(v.fecha_proxima_revision);
            return (
              <Card
                key={v.id}
                className="border-slate-100 cursor-pointer hover:border-indigo-200 transition-colors"
                onClick={() => navigate(`/vehiculos/${v.id}`)}
                data-testid={`vehiculo-${v.id}`}
              >
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-900">{v.matricula}</span>
                      {(v.marca || v.modelo) && (
                        <span className="text-sm text-slate-500">
                          {[v.marca, v.modelo].filter(Boolean).join(" ")}
                        </span>
                      )}
                      {v.anio && <span className="text-xs text-slate-400">({v.anio})</span>}
                    </div>
                    <div className="flex items-center gap-3 flex-wrap mt-1">
                      {alertaItv && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            alertaItv === "vencida"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          ITV {alertaItv === "vencida" ? "vencida" : "próxima"}
                        </span>
                      )}
                      {alertaRevision && (
                        <span
                          className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                            alertaRevision === "vencida"
                              ? "bg-red-50 text-red-700"
                              : "bg-amber-50 text-amber-700"
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Revisión mecánica {alertaRevision === "vencida" ? "vencida" : "próxima"}
                        </span>
                      )}
                    </div>
                  </div>
                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0" />
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !guardando && setDialogOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nuevo vehículo</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label>Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                placeholder="1234ABC"
                data-testid="matricula-input"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Marca</Label>
                <Input
                  value={form.marca}
                  onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Modelo</Label>
                <Input
                  value={form.modelo}
                  onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Año</Label>
                <Input
                  type="number"
                  value={form.anio}
                  onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Kilometraje</Label>
                <Input
                  type="number"
                  value={form.kilometraje}
                  onChange={(e) => setForm((f) => ({ ...f, kilometraje: e.target.value }))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Próxima ITV</Label>
                <Input
                  type="date"
                  value={form.fecha_itv}
                  onChange={(e) => setForm((f) => ({ ...f, fecha_itv: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Próxima revisión mecánica</Label>
                <Input
                  type="date"
                  value={form.fecha_proxima_revision}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, fecha_proxima_revision: e.target.value }))
                  }
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={crear}
              disabled={guardando}
              className="bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="crear-vehiculo-btn"
            >
              {guardando ? "Creando..." : "Crear vehículo"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default VehiculosPage;
