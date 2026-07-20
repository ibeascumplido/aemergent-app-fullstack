import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, Truck, AlertTriangle, CheckCircle, Plus, Check, Trash2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;
const DIAS_AVISO_PREVIO = 30;

const calcularAlerta = (fecha) => {
  if (!fecha) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const objetivo = new Date(fecha + "T00:00:00");
  const dias = Math.round((objetivo - hoy) / (1000 * 60 * 60 * 24));
  if (dias < 0) return { tipo: "vencida", dias };
  if (dias <= DIAS_AVISO_PREVIO) return { tipo: "proxima", dias };
  return { tipo: "ok", dias };
};

const Badge = ({ alerta, etiqueta }) => {
  if (!alerta) return null;
  const estilos = {
    vencida: "bg-red-50 text-red-700",
    proxima: "bg-amber-50 text-amber-700",
    ok: "bg-emerald-50 text-emerald-700",
  };
  const textos = {
    vencida: `${etiqueta} vencida`,
    proxima: `${etiqueta} en ${alerta.dias} días`,
    ok: `${etiqueta} al día`,
  };
  const Icono = alerta.tipo === "ok" ? CheckCircle : AlertTriangle;
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full ${estilos[alerta.tipo]}`}>
      <Icono className="w-3.5 h-3.5" />
      {textos[alerta.tipo]}
    </span>
  );
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

const VehiculoDetailPage = () => {
  const { vehiculoId } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useAuth();

  const [vehiculo, setVehiculo] = useState(null);
  const [averias, setAverias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [guardando, setGuardando] = useState(false);

  const [form, setForm] = useState(null);

  const [nuevaFecha, setNuevaFecha] = useState(hoyISO());
  const [nuevaDescripcion, setNuevaDescripcion] = useState("");
  const [anadiendo, setAnadiendo] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

  const cargar = async () => {
    try {
      const [vRes, aRes] = await Promise.all([
        axios.get(`${API}/vehiculos/${vehiculoId}`),
        axios.get(`${API}/vehiculos/${vehiculoId}/averias`),
      ]);
      setVehiculo(vRes.data);
      setForm({
        matricula: vRes.data.matricula || "",
        marca: vRes.data.marca || "",
        modelo: vRes.data.modelo || "",
        anio: vRes.data.anio || "",
        kilometraje: vRes.data.kilometraje || "",
        fecha_itv: vRes.data.fecha_itv || "",
        fecha_proxima_revision: vRes.data.fecha_proxima_revision || "",
        notas: vRes.data.notas || "",
      });
      setAverias(aRes.data);
    } catch (err) {
      console.error("Error cargando vehículo:", err);
      toast.error("No se pudo cargar el vehículo");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vehiculoId]);

  const guardar = async () => {
    setGuardando(true);
    try {
      await axios.put(`${API}/vehiculos/${vehiculoId}`, {
        matricula: form.matricula.trim().toUpperCase(),
        marca: form.marca.trim() || null,
        modelo: form.modelo.trim() || null,
        anio: form.anio ? Number(form.anio) : null,
        kilometraje: form.kilometraje ? Number(form.kilometraje) : null,
        fecha_itv: form.fecha_itv || null,
        fecha_proxima_revision: form.fecha_proxima_revision || null,
        notas: form.notas,
      });
      toast.success("Vehículo actualizado");
      await cargar();
    } catch (err) {
      console.error("Error guardando vehículo:", err);
      toast.error("No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const anadirAveria = async () => {
    if (!nuevaDescripcion.trim()) {
      toast.error("Describe la avería");
      return;
    }
    setAnadiendo(true);
    try {
      await axios.post(`${API}/vehiculos/${vehiculoId}/averias`, {
        fecha: nuevaFecha,
        descripcion: nuevaDescripcion.trim(),
      });
      toast.success("Avería registrada");
      setNuevaDescripcion("");
      setNuevaFecha(hoyISO());
      await cargar();
    } catch (err) {
      console.error("Error registrando avería:", err);
      toast.error("No se pudo registrar");
    } finally {
      setAnadiendo(false);
    }
  };

  const toggleResuelta = async (averiaId) => {
    try {
      await axios.put(`${API}/averias-vehiculo/${averiaId}/resolver`);
      await cargar();
    } catch (err) {
      console.error("Error actualizando avería:", err);
      toast.error("No se pudo actualizar");
    }
  };

  const eliminarAveria = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/averias-vehiculo/${aBorrar.id}`);
      toast.success("Avería eliminada");
      setABorrar(null);
      await cargar();
    } catch (err) {
      console.error("Error eliminando avería:", err);
      toast.error("No se pudo eliminar");
    }
  };

  if (loading || !form) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (!vehiculo) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate("/vehiculos")} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontró este vehículo.
          </CardContent>
        </Card>
      </div>
    );
  }

  const alertaItv = calcularAlerta(form.fecha_itv);
  const alertaRevision = calcularAlerta(form.fecha_proxima_revision);

  return (
    <div data-testid="vehiculo-detail-page">
      <Button
        variant="ghost"
        onClick={() => navigate("/vehiculos")}
        className="mb-4 -ml-3"
        size="sm"
      >
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver a Vehículos
      </Button>

      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="w-14 h-14 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <Truck className="w-7 h-7 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            {vehiculo.matricula}
          </h1>
          <p className="text-sm text-slate-500">
            {[vehiculo.marca, vehiculo.modelo].filter(Boolean).join(" ") || "Sin marca/modelo"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <Badge alerta={alertaItv} etiqueta="ITV" />
          <Badge alerta={alertaRevision} etiqueta="Revisión" />
        </div>
      </div>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Datos</p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Matrícula</Label>
              <Input
                value={form.matricula}
                onChange={(e) => setForm((f) => ({ ...f, matricula: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Año</Label>
              <Input
                type="number"
                value={form.anio}
                onChange={(e) => setForm((f) => ({ ...f, anio: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Marca</Label>
              <Input
                value={form.marca}
                onChange={(e) => setForm((f) => ({ ...f, marca: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Modelo</Label>
              <Input
                value={form.modelo}
                onChange={(e) => setForm((f) => ({ ...f, modelo: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Kilometraje</Label>
              <Input
                type="number"
                value={form.kilometraje}
                onChange={(e) => setForm((f) => ({ ...f, kilometraje: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-4">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">
            ITV y revisión
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Próxima ITV</Label>
              <Input
                type="date"
                value={form.fecha_itv}
                onChange={(e) => setForm((f) => ({ ...f, fecha_itv: e.target.value }))}
                disabled={!isAdmin}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Próxima revisión</Label>
              <Input
                type="date"
                value={form.fecha_proxima_revision}
                onChange={(e) =>
                  setForm((f) => ({ ...f, fecha_proxima_revision: e.target.value }))
                }
                disabled={!isAdmin}
              />
            </div>
          </div>
          <p className="text-xs text-slate-400">
            Avisa aquí cuando falten {DIAS_AVISO_PREVIO} días o menos, o si ya se ha pasado la fecha.
          </p>
        </CardContent>
      </Card>

      <Card className="border-slate-100 mb-6">
        <CardContent className="p-4 space-y-2">
          <p className="text-xs uppercase tracking-wider text-slate-500 font-medium">Notas</p>
          <Textarea
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            rows={3}
            disabled={!isAdmin}
          />
        </CardContent>
      </Card>

      {isAdmin && (
        <Button
          onClick={guardar}
          disabled={guardando}
          className="bg-indigo-600 hover:bg-indigo-700 text-white mb-8"
          data-testid="guardar-vehiculo-btn"
        >
          {guardando ? "Guardando..." : "Guardar cambios"}
        </Button>
      )}

      <div>
        <h2 className="text-lg font-semibold text-slate-900 mb-3">Averías</h2>

        <div className="flex items-end gap-2 mb-4 flex-wrap">
          <div className="space-y-1.5">
            <Label className="text-xs">Fecha</Label>
            <Input
              type="date"
              value={nuevaFecha}
              onChange={(e) => setNuevaFecha(e.target.value)}
              className="w-40"
            />
          </div>
          <div className="space-y-1.5 flex-1 min-w-[200px]">
            <Label className="text-xs">Descripción</Label>
            <Input
              value={nuevaDescripcion}
              onChange={(e) => setNuevaDescripcion(e.target.value)}
              placeholder="Ej. Ruido en el motor"
              data-testid="nueva-averia-input"
            />
          </div>
          <Button
            onClick={anadirAveria}
            disabled={anadiendo}
            className="bg-slate-800 hover:bg-slate-900 text-white"
            data-testid="anadir-averia-btn"
          >
            <Plus className="w-4 h-4 mr-1" />
            Añadir
          </Button>
        </div>

        {averias.length === 0 ? (
          <p className="text-sm text-slate-400">Sin averías registradas.</p>
        ) : (
          <div className="space-y-2">
            {averias.map((a) => (
              <div
                key={a.id}
                className={`flex items-center justify-between gap-3 p-3 rounded-lg border ${
                  a.resuelta ? "border-slate-100 bg-slate-50/50" : "border-amber-200 bg-amber-50/50"
                }`}
                data-testid={`averia-${a.id}`}
              >
                <div className="min-w-0">
                  <p className={`text-sm ${a.resuelta ? "text-slate-500 line-through" : "text-slate-800"}`}>
                    {a.descripcion}
                  </p>
                  <p className="text-xs text-slate-400">
                    {new Date(a.fecha + "T00:00:00").toLocaleDateString("es-ES")}
                    {a.resuelta && a.fecha_resolucion &&
                      ` · Resuelta el ${new Date(a.fecha_resolucion + "T00:00:00").toLocaleDateString("es-ES")}`}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => toggleResuelta(a.id)}
                    className={a.resuelta ? "text-slate-400" : "text-emerald-600 hover:bg-emerald-50"}
                    data-testid={`resolver-averia-${a.id}`}
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  {isAdmin && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setABorrar(a)}
                      className="text-red-500 hover:bg-red-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={!!aBorrar} onOpenChange={(open) => !open && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar esta avería?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará el registro de "{aBorrar?.descripcion}". Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={eliminarAveria} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default VehiculoDetailPage;
