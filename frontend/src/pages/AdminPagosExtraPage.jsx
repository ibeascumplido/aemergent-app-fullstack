import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { Euro, Clock, Biohazard, Check, X, Pencil, Users, Plus, Trash2 } from "lucide-react";
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

const TOX_TIPO_LABEL = {
  fitosanitario: "Aplicación de fitosanitario",
  altura: "Trabajo en altura",
  glorieta: "Trabajo en glorieta",
  motosierra: "Trabajo con motosierra",
  otro: "Otro trabajo peligroso",
};

const TOX_PRODUCTO_LABEL = {
  herbicida: "Herbicida",
  fungicida: "Fungicida",
  insecticida: "Insecticida",
  otro: "Otro fitosanitario",
};

const AdminPagosExtraPage = () => {
  const { isAdmin, isFacturacion } = useAuth();
  // Facturación solo ve los pagos ya aceptados por el administrador.
  const [filtroEstado, setFiltroEstado] = useState(isFacturacion ? "aceptado" : "pendiente");
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fotoAmpliada, setFotoAmpliada] = useState(null);

  const [editando, setEditando] = useState(null); // objeto pago o null
  const [editSubtipo, setEditSubtipo] = useState("");
  const [editCentro, setEditCentro] = useState("");
  const [editTrabajo, setEditTrabajo] = useState("");
  const [editFecha, setEditFecha] = useState("");
  const [editCantidad, setEditCantidad] = useState("");
  const [editImporte, setEditImporte] = useState("");
  const [editNotaAdmin, setEditNotaAdmin] = useState("");
  const [guardando, setGuardando] = useState(false);

  // Asignar pago directamente
  const [operarios, setOperarios] = useState([]);
  const [asignarOpen, setAsignarOpen] = useState(false);
  const [asigOperario, setAsigOperario] = useState("");
  const [asigModo, setAsigModo] = useState("libre"); // "libre" | "tipo"
  const [asigCategoria, setAsigCategoria] = useState("horas_extra");
  const [asigSubtipo, setAsigSubtipo] = useState("normal");
  const [asigCantidad, setAsigCantidad] = useState("");
  const [asigImporte, setAsigImporte] = useState("");
  const [asigFecha, setAsigFecha] = useState(new Date().toISOString().slice(0, 10));
  const [asigNota, setAsigNota] = useState("");
  const [asignando, setAsignando] = useState(false);
  const [aBorrar, setABorrar] = useState(null);

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

  // Cargar operarios para el selector de asignación (solo admin)
  useEffect(() => {
    if (!isAdmin) return;
    axios
      .get(`${API}/users/operarios`)
      .then((res) => setOperarios(res.data || []))
      .catch(() => {});
  }, [isAdmin]);

  // Ejecuta el borrado cuando se confirma (aBorrar pasa a tener un pago)
  useEffect(() => {
    if (aBorrar) borrarPago();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aBorrar]);

  const abrirAsignar = () => {
    setAsigOperario("");
    setAsigModo("libre");
    setAsigCategoria("horas_extra");
    setAsigSubtipo("normal");
    setAsigCantidad("");
    setAsigImporte("");
    setAsigFecha(new Date().toISOString().slice(0, 10));
    setAsigNota("");
    setAsignarOpen(true);
  };

  const asignarPago = async () => {
    if (!asigOperario) {
      toast.error("Elige un trabajador");
      return;
    }
    const payload = {
      operario_id: asigOperario,
      fecha: asigFecha,
      nota: asigNota.trim() || null,
    };
    if (asigModo === "libre") {
      const imp = parseFloat(asigImporte);
      if (!imp || imp <= 0) {
        toast.error("Indica un importe válido");
        return;
      }
      payload.categoria = "horas_extra";
      payload.subtipo = "variable";
      payload.cantidad = 1;
      payload.importe_manual = imp;
    } else {
      const cant = parseFloat(asigCantidad);
      if (!cant || cant <= 0) {
        toast.error("Indica la cantidad");
        return;
      }
      payload.categoria = asigCategoria;
      payload.subtipo = asigSubtipo;
      payload.cantidad = cant;
    }
    setAsignando(true);
    try {
      await axios.post(`${API}/admin/pagos-extra/asignar`, payload);
      toast.success("Pago asignado");
      setAsignarOpen(false);
      await cargar();
    } catch (err) {
      console.error("Error asignando pago:", err);
      toast.error(err?.response?.data?.detail || "No se pudo asignar");
    } finally {
      setAsignando(false);
    }
  };

  const borrarPago = async () => {
    if (!aBorrar) return;
    try {
      await axios.delete(`${API}/admin/pagos-extra/${aBorrar.id}`);
      toast.success("Pago eliminado");
      setPagos((prev) => prev.filter((p) => p.id !== aBorrar.id));
    } catch (err) {
      console.error("Error borrando pago:", err);
      toast.error("No se pudo eliminar");
    } finally {
      setABorrar(null);
    }
  };

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
          <p className="text-sm text-slate-500">
            {isFacturacion
              ? "Pagos extra aceptados por el administrador"
              : "Revisa, ajusta y aprueba horas extra y pluses"}
          </p>
        </div>
        {isAdmin && !isFacturacion && (
          <Button
            onClick={abrirAsignar}
            className="ml-auto bg-emerald-600 hover:bg-emerald-700 text-white"
            data-testid="asignar-pago-btn"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            Asignar pago
          </Button>
        )}
      </div>

      {!isFacturacion && (
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
      )}

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

                  {p.tox_tipo_trabajo && (
                    <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50/40 p-2.5 text-xs space-y-1">
                      <p className="font-semibold text-amber-700 flex items-center gap-1.5">
                        <Biohazard className="w-3.5 h-3.5" />
                        Trabajo peligroso
                      </p>
                      <p className="text-slate-600">
                        <span className="font-medium">Tipo:</span> {TOX_TIPO_LABEL[p.tox_tipo_trabajo] || p.tox_tipo_trabajo}
                        {p.tox_tipo_trabajo === "fitosanitario" && p.tox_producto && (
                          <>
                            {" · "}
                            {p.tox_producto === "otro" && p.tox_producto_detalle
                              ? p.tox_producto_detalle
                              : TOX_PRODUCTO_LABEL[p.tox_producto] || p.tox_producto}
                          </>
                        )}
                      </p>
                      {p.tox_zona && (
                        <p className="text-slate-600">
                          <span className="font-medium">Zona:</span> {p.tox_zona}
                        </p>
                      )}
                      {(p.tox_hora_inicio || p.tox_hora_fin) && (
                        <p className="text-slate-600">
                          <span className="font-medium">Horario:</span> {p.tox_hora_inicio || "?"} – {p.tox_hora_fin || "?"}
                        </p>
                      )}
                      {p.tox_foto_url && (
                        <button
                          type="button"
                          onClick={() => setFotoAmpliada(p.tox_foto_url)}
                          className="mt-1"
                        >
                          <img
                            src={p.tox_foto_url}
                            alt="Zona trabajada"
                            className="w-16 h-16 rounded-lg object-cover border border-slate-200"
                          />
                        </button>
                      )}
                    </div>
                  )}

                  {!isFacturacion && (
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
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("¿Eliminar este pago? No se puede deshacer.")) {
                            setABorrar(p);
                          }
                        }}
                        className="ml-auto text-slate-300 hover:text-red-500 p-1 self-center"
                        title="Eliminar pago"
                        data-testid={`borrar-pago-${p.id}`}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                  )}
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

      {fotoAmpliada && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setFotoAmpliada(null)}
          data-testid="foto-pantalla-completa"
        >
          <button
            type="button"
            onClick={() => setFotoAmpliada(null)}
            className="absolute top-4 right-4 text-white/80 hover:text-white"
            aria-label="Cerrar"
          >
            <X className="w-7 h-7" />
          </button>
          <img
            src={fotoAmpliada}
            alt="Zona trabajada"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Diálogo: asignar pago directamente */}
      <Dialog open={asignarOpen} onOpenChange={(v) => !asignando && setAsignarOpen(v)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Asignar pago a un trabajador</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Trabajador</Label>
              <select
                value={asigOperario}
                onChange={(e) => setAsigOperario(e.target.value)}
                className="w-full h-10 rounded-md border border-slate-200 px-3 text-sm bg-white"
                data-testid="asig-operario-select"
              >
                <option value="">Elige un trabajador...</option>
                {operarios.map((o) => (
                  <option key={o.user_id} value={o.user_id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <Label>¿Cómo?</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setAsigModo("libre")}
                  className={`flex-1 py-2 rounded-lg text-sm border ${
                    asigModo === "libre" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  Importe libre
                </button>
                <button
                  type="button"
                  onClick={() => setAsigModo("tipo")}
                  className={`flex-1 py-2 rounded-lg text-sm border ${
                    asigModo === "tipo" ? "bg-slate-800 text-white border-slate-800" : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  Por tipo
                </button>
              </div>
            </div>

            {asigModo === "libre" ? (
              <div className="space-y-1.5">
                <Label>Importe (€)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={asigImporte}
                  onChange={(e) => setAsigImporte(e.target.value)}
                  placeholder="0.00"
                  data-testid="asig-importe"
                />
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Tipo</Label>
                  <select
                    value={asigCategoria}
                    onChange={(e) => {
                      setAsigCategoria(e.target.value);
                      setAsigSubtipo(e.target.value === "horas_extra" ? "normal" : "dia");
                    }}
                    className="w-full h-10 rounded-md border border-slate-200 px-2 text-sm bg-white"
                  >
                    <option value="horas_extra">Horas extra</option>
                    <option value="plus">Plus</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label>Subtipo</Label>
                  <select
                    value={asigSubtipo}
                    onChange={(e) => setAsigSubtipo(e.target.value)}
                    className="w-full h-10 rounded-md border border-slate-200 px-2 text-sm bg-white"
                  >
                    {asigCategoria === "horas_extra" ? (
                      <>
                        <option value="normal">Normal</option>
                        <option value="festivo">Festivo</option>
                      </>
                    ) : (
                      <>
                        <option value="dia">Por día</option>
                        <option value="hora">Por hora</option>
                      </>
                    )}
                  </select>
                </div>
                <div className="space-y-1.5 col-span-2">
                  <Label>Cantidad ({asigCategoria === "horas_extra" || asigSubtipo === "hora" ? "horas" : "días"})</Label>
                  <Input
                    type="number"
                    step="0.5"
                    value={asigCantidad}
                    onChange={(e) => setAsigCantidad(e.target.value)}
                    placeholder="0"
                    data-testid="asig-cantidad"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Fecha</Label>
              <Input
                type="date"
                value={asigFecha}
                onChange={(e) => setAsigFecha(e.target.value)}
                data-testid="asig-fecha"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea
                value={asigNota}
                onChange={(e) => setAsigNota(e.target.value)}
                rows={2}
                placeholder="Concepto del pago"
                data-testid="asig-nota"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAsignarOpen(false)} disabled={asignando}>
              Cancelar
            </Button>
            <Button
              onClick={asignarPago}
              disabled={asignando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="asig-confirmar-btn"
            >
              {asignando ? "Asignando..." : "Asignar pago"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPagosExtraPage;
