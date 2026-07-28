import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Euro, Clock, Biohazard, Check, X, Pencil, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
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

const SUBTIPO_LABEL = {
  normal: "Hora extra normal",
  festivo: "Hora extra festivo",
  hora: "Plus por hora",
  dia: "Plus por día",
  variable: "Precio variable",
};

const ESTADO_PILL = {
  pendiente: "bg-amber-50 text-amber-700 border-amber-200",
  aceptado: "bg-green-50 text-green-700 border-green-200",
  rechazado: "bg-red-50 text-red-600 border-red-200",
};

const AdminPagosExtraPage = () => {
  const [filtroEstado, setFiltroEstado] = useState("pendiente");
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);

  const [editando, setEditando] = useState(null); // objeto pago o null
  const [editSubtipo, setEditSubtipo] = useState("");
  const [editCentro, setEditCentro] = useState("");
  const [editTrabajo, setEditTrabajo] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [editImporte, setEditImporte] = useState("");
  const [editNotaAdmin, setEditNotaAdmin] = useState("");
  const [guardando, setGuardando] = useState(false);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const params = {};
      if (filtroEstado !== "todos") params.estado = filtroEstado;
      const res = await axios.get(`${API}/admin/pagos-extra`, { params });
      setPagos(res.data);
    } catch (err) {
      console.error("Error cargando pagos extra:", err);
      toast.error("No se pudieron cargar los pagos extra");
    } finally {
      setLoading(false);
    }
  }, [filtroEstado]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const abrirEdicion = (p) => {
    setEditando(p);
    setEditSubtipo(p.subtipo);
    setEditCentro(p.centro_nombre || "");
    setEditTrabajo(p.trabajo_descripcion || "");
    setEditFecha(p.fecha);
    setEditCantidad(String(p.cantidad));
    setEditImporte(String(p.importe));
    setEditNotaAdmin(p.nota_admin || "");
  };

  const guardarEdicion = async () => {
    setGuardando(true);
    try {
      const res = await axios.patch(`${API}/admin/pagos-extra/${editando.id}`, {
        subtipo: editSubtipo,
        centro_nombre: editCentro.trim() || null,
        trabajo_descripcion: editTrabajo.trim() || null,
        fecha: editFecha,
        cantidad: parseFloat(editCantidad) || editando.cantidad,
        importe: parseFloat(editImporte),
        nota_admin: editNotaAdmin.trim() || null,
      });
      setPagos((prev) => prev.map((x) => (x.id === res.data.id ? { ...x, ...res.data } : x)));
      toast.success("Cambios guardados");
      setEditando(null);
    } catch (err) {
      console.error("Error guardando:", err);
      toast.error(err?.response?.data?.detail || "No se pudo guardar");
    } finally {
      setGuardando(false);
    }
  };

  const resolver = async (id, aceptar) => {
    try {
      await axios.post(`${API}/admin/pagos-extra/${id}/resolver`, null, {
        params: { aceptar },
      });
      toast.success(aceptar ? "Pago aceptado" : "Pago rechazado");
      cargar();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo procesar");
    }
  };

  return (
    <div data-testid="admin-pagos-extra-page">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
          <Euro className="w-6 h-6 text-emerald-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Pagos extra
          </h1>
          <p className="text-sm text-slate-500">Revisa, ajusta y aprueba horas extra y pluses</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        {["pendiente", "aceptado", "rechazado", "todos"].map((e) => (
          <button
            key={e}
            onClick={() => setFiltroEstado(e)}
            className={`px-3 py-1.5 rounded-lg text-sm border capitalize transition-colors ${
              filtroEstado === e
                ? "bg-slate-800 text-white border-slate-800"
                : "bg-white text-slate-500 border-slate-200"
            }`}
            data-testid={`filtro-${e}`}
          >
            {e}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : pagos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400 text-sm">
            No hay solicitudes en este estado.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagos.map((p) => {
            const esHoras = p.categoria === "horas_extra";
            return (
              <Card key={p.id} className="border-slate-100" data-testid={`admin-pago-${p.id}`}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          esHoras ? "bg-blue-50 text-blue-600" : "bg-purple-50 text-purple-600"
                        }`}
                      >
                        {esHoras ? <Clock className="w-4.5 h-4.5" /> : <Biohazard className="w-4.5 h-4.5" />}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-800 flex items-center gap-1.5">
                          <Users className="w-3.5 h-3.5 text-slate-400" />
                          {p.operario_nombre}
                        </p>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {SUBTIPO_LABEL[p.subtipo]} · {p.cantidad}
                          {esHoras || p.subtipo === "hora" ? " h" : " día(s)"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.trabajo_descripcion || "—"}
                          {p.centro_nombre ? ` · ${p.centro_nombre}` : ""}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(p.fecha).toLocaleDateString("es-ES")}
                        </p>
                        {p.nota && (
                          <p className="text-xs text-slate-500 mt-1 italic">"{p.nota}"</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-800 font-['JetBrains_Mono']">
                        {p.importe.toFixed(2)} €
                      </p>
                      <span
                        className={`inline-block text-[11px] px-2 py-0.5 rounded-full border mt-1 capitalize ${
                          ESTADO_PILL[p.estado]
                        }`}
                      >
                        {p.estado}
                      </span>
                    </div>
                  </div>

                  {p.nota_admin && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">
                      Tu nota: {p.nota_admin}
                    </p>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => abrirEdicion(p)}
                      data-testid={`editar-pago-${p.id}`}
                    >
                      <Pencil className="w-3.5 h-3.5 mr-1" />
                      Ajustar
                    </Button>
                    {p.estado !== "aceptado" && (
                      <Button
                        size="sm"
                        onClick={() => resolver(p.id, true)}
                        className="bg-green-600 hover:bg-green-700 text-white"
                        data-testid={`aceptar-pago-${p.id}`}
                      >
                        <Check className="w-3.5 h-3.5 mr-1" />
                        Aceptar
                      </Button>
                    )}
                    {p.estado !== "rechazado" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => resolver(p.id, false)}
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        data-testid={`rechazar-pago-${p.id}`}
                      >
                        <X className="w-3.5 h-3.5 mr-1" />
                        Rechazar
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialogo de edicion */}
      <Dialog open={!!editando} onOpenChange={(v) => !guardando && !v && setEditando(null)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Ajustar solicitud</DialogTitle>
          </DialogHeader>
          {editando && (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Tipo</Label>
                <Select value={editSubtipo} onValueChange={setEditSubtipo}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(editando.categoria === "horas_extra"
                      ? ["normal", "festivo", "variable"]
                      : ["hora", "dia", "variable"]
                    ).map((s) => (
                      <SelectItem key={s} value={s}>
                        {SUBTIPO_LABEL[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centro</Label>
                <Input value={editCentro} onChange={(e) => setEditCentro(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <Label>Tipo de trabajo</Label>
                <Input value={editTrabajo} onChange={(e) => setEditTrabajo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Día</Label>
                  <Input type="date" value={editFecha} onChange={(e) => setEditFecha(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Cantidad</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.5"
                    value={editCantidad}
                    onChange={(e) => setEditCantidad(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Importe final (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={editImporte}
                  onChange={(e) => setEditImporte(e.target.value)}
                  data-testid="edit-importe-input"
                />
                <p className="text-[11px] text-slate-400">
                  Si cambias el tipo o la cantidad y no tocas este campo, el importe se recalcula solo
                  con las tarifas.
                </p>
              </div>
              <div className="space-y-1.5">
                <Label>Nota para el operario (opcional)</Label>
                <Textarea
                  value={editNotaAdmin}
                  onChange={(e) => setEditNotaAdmin(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditando(null)} disabled={guardando}>
              Cancelar
            </Button>
            <Button
              onClick={guardarEdicion}
              disabled={guardando}
              className="bg-slate-800 hover:bg-slate-900 text-white"
              data-testid="guardar-edicion-pago-btn"
            >
              {guardando ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPagosExtraPage;
