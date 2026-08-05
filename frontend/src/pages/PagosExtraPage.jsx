import { useEffect, useState, useCallback } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Euro, Plus, Clock, Biohazard, Trash2, Check, X, Hourglass, Camera } from "lucide-react";
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

const TARIFAS = {
  horas_extra: {
    normal: { label: "Hora extra normal", precio: 19.01, unidad: "h" },
    festivo: { label: "Hora extra en festivo", precio: 27.7, unidad: "h" },
    variable: { label: "Precio variable (a convenir)", precio: null, unidad: "h" },
  },
  plus: {
    hora: { label: "Plus por hora", precio: 1.92, unidad: "h" },
    dia: { label: "Plus por día completo", precio: 14.42, unidad: "días" },
    variable: { label: "Precio variable (a convenir)", precio: null, unidad: "" },
  },
};

const hoyISO = () => new Date().toISOString().slice(0, 10);

const ESTADO_PILL = {
  pendiente: { label: "Pendiente", cls: "bg-amber-50 text-amber-700 border-amber-200", Icon: Hourglass },
  aceptado: { label: "Aceptado", cls: "bg-green-50 text-green-700 border-green-200", Icon: Check },
  rechazado: { label: "Rechazado", cls: "bg-red-50 text-red-600 border-red-200", Icon: X },
};

const PagosExtraPage = () => {
  const [pagos, setPagos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  // Formulario
  const [categoria, setCategoria] = useState("horas_extra");
  const [subtipo, setSubtipo] = useState("normal");
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [centros, setCentros] = useState([]);
  const [centroId, setCentroId] = useState("");
  const [centroLibre, setCentroLibre] = useState("");
  const [usarCentroLibre, setUsarCentroLibre] = useState(false);
  const [tareas, setTareas] = useState([]);
  const [tareaId, setTareaId] = useState("");
  const [trabajoLibre, setTrabajoLibre] = useState("");
  const [usarTrabajoLibre, setUsarTrabajoLibre] = useState(false);
  const [fecha, setFecha] = useState(hoyISO());
  const [cantidad, setCantidad] = useState("");
  const [importeManual, setImporteManual] = useState("");
  const [nota, setNota] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Cuestionario de toxicidad (solo cuando categoria === "plus")
  const [toxTipo, setToxTipo] = useState("");
  const [toxProducto, setToxProducto] = useState("");
  const [toxProductoDetalle, setToxProductoDetalle] = useState("");
  const [toxZona, setToxZona] = useState("");
  const [toxHoraInicio, setToxHoraInicio] = useState("");
  const [toxHoraFin, setToxHoraFin] = useState("");
  const [toxFoto, setToxFoto] = useState(null);

  const cargarPagos = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API}/pagos-extra/mios`);
      setPagos(res.data);
    } catch (err) {
      console.error("Error cargando pagos extra:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    cargarPagos();
  }, [cargarPagos]);

  const abrirDialogo = () => {
    setCategoria("horas_extra");
    setSubtipo("normal");
    setClienteId("");
    setCentros([]);
    setCentroId("");
    setCentroLibre("");
    setUsarCentroLibre(false);
    setTareaId("");
    setTrabajoLibre("");
    setUsarTrabajoLibre(false);
    setFecha(hoyISO());
    setCantidad("");
    setImporteManual("");
    setNota("");
    setToxTipo("");
    setToxProducto("");
    setToxProductoDetalle("");
    setToxZona("");
    setToxHoraInicio("");
    setToxHoraFin("");
    setToxFoto(null);
    setDialogOpen(true);
    if (clientes.length === 0) {
      axios.get(`${API}/clients`).then((res) => setClientes(res.data)).catch(() => {});
    }
    if (tareas.length === 0) {
      axios.get(`${API}/work-tasks`).then((res) => setTareas(res.data)).catch(() => {});
    }
  };

  const onCambiarCategoria = (c) => {
    setCategoria(c);
    setSubtipo(c === "horas_extra" ? "normal" : "hora");
    setImporteManual("");
  };

  const onCambiarCliente = (id) => {
    setClienteId(id);
    setCentroId("");
    setCentros([]);
    const cliente = clientes.find((c) => c.id === id);
    if (cliente) {
      axios
        .get(`${API}/clients/${cliente.slug}/centros`)
        .then((res) => setCentros(res.data))
        .catch(() => setCentros([]));
    }
  };

  const tarifaActual = TARIFAS[categoria]?.[subtipo];
  const esVariable = subtipo === "variable";
  const cantidadNum = parseFloat(cantidad) || 0;
  const importeEstimado = esVariable
    ? parseFloat(importeManual) || 0
    : (tarifaActual?.precio || 0) * cantidadNum;

  const onToxFoto = (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Sube una imagen");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setToxFoto(reader.result);
    reader.readAsDataURL(file);
  };

  const enviar = async () => {
    if (!cantidad || cantidadNum <= 0) {
      toast.error("Indica la cantidad (horas o días)");
      return;
    }
    if (esVariable && (!importeManual || parseFloat(importeManual) <= 0)) {
      toast.error("Indica el importe");
      return;
    }
    if (usarTrabajoLibre && !trabajoLibre.trim()) {
      toast.error("Describe el trabajo realizado");
      return;
    }
    if (!usarTrabajoLibre && !tareaId) {
      toast.error("Selecciona el tipo de trabajo");
      return;
    }
    // Cuestionario obligatorio para pluses de toxicidad/penosidad
    if (categoria === "plus") {
      if (!toxTipo) {
        toast.error("Indica el tipo de trabajo peligroso");
        return;
      }
      if (toxTipo === "fitosanitario" && !toxProducto) {
        toast.error("Indica el producto fitosanitario");
        return;
      }
      if (toxTipo === "fitosanitario" && toxProducto === "otro" && !toxProductoDetalle.trim()) {
        toast.error("Especifica qué producto fitosanitario");
        return;
      }
      if (!toxZona.trim()) {
        toast.error("Indica la zona trabajada");
        return;
      }
      if (!toxHoraInicio || !toxHoraFin) {
        toast.error("Indica el horario (de qué hora a qué hora)");
        return;
      }
    }
    setEnviando(true);
    try {
      await axios.post(`${API}/pagos-extra`, {
        categoria,
        subtipo,
        client_id: usarCentroLibre ? null : clienteId || null,
        client_nombre: usarCentroLibre ? null : null,
        centro_id: usarCentroLibre ? null : centroId || null,
        centro_nombre: usarCentroLibre ? centroLibre.trim() || null : null,
        tarea_id: usarTrabajoLibre ? null : tareaId || null,
        trabajo_descripcion: usarTrabajoLibre ? trabajoLibre.trim() : null,
        fecha,
        cantidad: cantidadNum,
        importe_manual: esVariable ? parseFloat(importeManual) : null,
        nota: nota.trim() || null,
        tox_tipo_trabajo: categoria === "plus" ? toxTipo : null,
        tox_producto: categoria === "plus" && toxTipo === "fitosanitario" ? toxProducto : null,
        tox_producto_detalle:
          categoria === "plus" && toxTipo === "fitosanitario" && toxProducto === "otro"
            ? toxProductoDetalle.trim()
            : null,
        tox_zona: categoria === "plus" ? toxZona.trim() : null,
        tox_hora_inicio: categoria === "plus" ? toxHoraInicio : null,
        tox_hora_fin: categoria === "plus" ? toxHoraFin : null,
        tox_foto: categoria === "plus" ? toxFoto : null,
      });
      toast.success("Solicitud enviada");
      setDialogOpen(false);
      cargarPagos();
    } catch (err) {
      console.error("Error enviando pago extra:", err);
      toast.error(err?.response?.data?.detail || "No se pudo enviar");
    } finally {
      setEnviando(false);
    }
  };

  const retirar = async (id) => {
    try {
      await axios.delete(`${API}/pagos-extra/${id}`);
      toast.success("Solicitud retirada");
      cargarPagos();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "No se pudo retirar");
    }
  };

  return (
    <div data-testid="pagos-extra-page">
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center">
            <Euro className="w-6 h-6 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              Pagos extra
            </h1>
            <p className="text-sm text-slate-500">Horas extra y pluses de toxicidad/penosidad</p>
          </div>
        </div>
        <Button
          onClick={abrirDialogo}
          className="bg-emerald-600 hover:bg-emerald-700 text-white"
          data-testid="nuevo-pago-extra-btn"
        >
          <Plus className="w-4 h-4 mr-2" />
          Nueva solicitud
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
      ) : pagos.length === 0 ? (
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-400 text-sm">
            Todavía no has enviado ninguna solicitud de pago extra.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {pagos.map((p) => {
            const est = ESTADO_PILL[p.estado] || ESTADO_PILL.pendiente;
            const EstIcon = est.Icon;
            const esHoras = p.categoria === "horas_extra";
            return (
              <Card key={p.id} className="border-slate-100" data-testid={`pago-${p.id}`}>
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
                        <p className="text-sm font-semibold text-slate-800">
                          {esHoras ? "Horas extra" : "Plus"} · {p.cantidad}
                          {esHoras ? " h" : p.subtipo === "dia" ? " día(s)" : " h"}
                        </p>
                        <p className="text-xs text-slate-500">
                          {p.trabajo_descripcion || "—"}
                          {p.centro_nombre ? ` · ${p.centro_nombre}` : ""}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {new Date(p.fecha).toLocaleDateString("es-ES")}
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-base font-bold text-slate-800 font-['JetBrains_Mono']">
                        {p.importe.toFixed(2)} €
                      </p>
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border mt-1 ${est.cls}`}
                      >
                        <EstIcon className="w-3 h-3" />
                        {est.label}
                      </span>
                    </div>
                  </div>
                  {p.nota_admin && (
                    <p className="text-xs text-slate-500 mt-2 bg-slate-50 rounded-lg p-2">
                      Nota del administrador: {p.nota_admin}
                    </p>
                  )}
                  {p.estado === "pendiente" && (
                    <button
                      onClick={() => retirar(p.id)}
                      className="text-xs text-red-500 hover:text-red-700 flex items-center gap-1 mt-2"
                      data-testid={`retirar-pago-${p.id}`}
                    >
                      <Trash2 className="w-3 h-3" />
                      Retirar solicitud
                    </button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={(v) => !enviando && setDialogOpen(v)}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nueva solicitud de pago extra</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {/* Categoria */}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => onCambiarCategoria("horas_extra")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  categoria === "horas_extra"
                    ? "bg-blue-50 border-blue-200 text-blue-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
                data-testid="cat-horas-extra-btn"
              >
                Horas extra
              </button>
              <button
                type="button"
                onClick={() => onCambiarCategoria("plus")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  categoria === "plus"
                    ? "bg-purple-50 border-purple-200 text-purple-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
                data-testid="cat-plus-btn"
              >
                Plus toxicidad/penosidad
              </button>
            </div>

            {/* Subtipo/tarifa */}
            <div className="space-y-1.5">
              <Label>Tipo</Label>
              <Select value={subtipo} onValueChange={setSubtipo}>
                <SelectTrigger data-testid="subtipo-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TARIFAS[categoria]).map(([key, t]) => (
                    <SelectItem key={key} value={key}>
                      {t.label}
                      {t.precio != null ? ` — ${t.precio.toFixed(2)} €/${t.unidad}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Cliente + centro */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Centro</Label>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={() => setUsarCentroLibre((v) => !v)}
                >
                  {usarCentroLibre ? "Elegir de la lista" : "Escribir a mano"}
                </button>
              </div>
              {usarCentroLibre ? (
                <Input
                  value={centroLibre}
                  onChange={(e) => setCentroLibre(e.target.value)}
                  placeholder="Nombre del centro/lugar"
                  data-testid="centro-libre-input"
                />
              ) : (
                <>
                  <Select value={clienteId} onValueChange={onCambiarCliente}>
                    <SelectTrigger data-testid="cliente-select">
                      <SelectValue placeholder="Cliente..." />
                    </SelectTrigger>
                    <SelectContent>
                      {clientes.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.nombre}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {clienteId && centros.length > 0 && (
                    <Select value={centroId} onValueChange={setCentroId}>
                      <SelectTrigger data-testid="centro-select">
                        <SelectValue placeholder="Centro (opcional)..." />
                      </SelectTrigger>
                      <SelectContent>
                        {centros.map((ce) => (
                          <SelectItem key={ce.id} value={ce.id}>
                            {ce.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </>
              )}
            </div>

            {/* Tipo de trabajo */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>Tipo de trabajo</Label>
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-600"
                  onClick={() => setUsarTrabajoLibre((v) => !v)}
                >
                  {usarTrabajoLibre ? "Elegir de la lista" : "Escribir a mano"}
                </button>
              </div>
              {usarTrabajoLibre ? (
                <Input
                  value={trabajoLibre}
                  onChange={(e) => setTrabajoLibre(e.target.value)}
                  placeholder="Describe el trabajo realizado"
                  data-testid="trabajo-libre-input"
                />
              ) : (
                <Select value={tareaId} onValueChange={setTareaId}>
                  <SelectTrigger data-testid="tarea-select">
                    <SelectValue placeholder="Selecciona una tarea..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tareas.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nombre}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Fecha + cantidad */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Día</Label>
                <Input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} data-testid="fecha-input" />
              </div>
              <div className="space-y-1.5">
                <Label>{categoria === "plus" && subtipo === "dia" ? "Nº de días" : "Nº de horas"}</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.5"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder="0"
                  data-testid="cantidad-input"
                />
              </div>
            </div>

            {/* Importe manual si variable */}
            {esVariable && (
              <div className="space-y-1.5">
                <Label>Importe total (€)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={importeManual}
                  onChange={(e) => setImporteManual(e.target.value)}
                  placeholder="0.00"
                  data-testid="importe-manual-input"
                />
              </div>
            )}

            {categoria === "plus" && (
              <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/40 p-3">
                <p className="text-xs uppercase tracking-wider text-amber-700 font-semibold flex items-center gap-1.5">
                  <Biohazard className="w-3.5 h-3.5" />
                  Datos del trabajo peligroso
                </p>

                <div className="space-y-1.5">
                  <Label>Tipo de trabajo</Label>
                  <Select value={toxTipo} onValueChange={setToxTipo}>
                    <SelectTrigger data-testid="tox-tipo-select">
                      <SelectValue placeholder="Elige..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fitosanitario">Aplicación de fitosanitario</SelectItem>
                      <SelectItem value="altura">Trabajo en altura</SelectItem>
                      <SelectItem value="glorieta">Trabajo en glorieta</SelectItem>
                      <SelectItem value="motosierra">Trabajo con motosierra</SelectItem>
                      <SelectItem value="otro">Otro trabajo peligroso</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {toxTipo === "fitosanitario" && (
                  <>
                    <div className="space-y-1.5">
                      <Label>Producto fitosanitario</Label>
                      <Select value={toxProducto} onValueChange={setToxProducto}>
                        <SelectTrigger data-testid="tox-producto-select">
                          <SelectValue placeholder="Elige..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="herbicida">Herbicida</SelectItem>
                          <SelectItem value="fungicida">Fungicida</SelectItem>
                          <SelectItem value="insecticida">Insecticida</SelectItem>
                          <SelectItem value="otro">Otro fitosanitario</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {toxProducto === "otro" && (
                      <div className="space-y-1.5">
                        <Label>¿Qué producto?</Label>
                        <Input
                          value={toxProductoDetalle}
                          onChange={(e) => setToxProductoDetalle(e.target.value)}
                          placeholder="Nombre del producto"
                          data-testid="tox-producto-detalle-input"
                        />
                      </div>
                    )}
                  </>
                )}

                <div className="space-y-1.5">
                  <Label>Zona trabajada</Label>
                  <Input
                    value={toxZona}
                    onChange={(e) => setToxZona(e.target.value)}
                    placeholder="Ej. zona norte, junto a los cipreses"
                    data-testid="tox-zona-input"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>De</Label>
                    <Input
                      type="time"
                      value={toxHoraInicio}
                      onChange={(e) => setToxHoraInicio(e.target.value)}
                      data-testid="tox-hora-inicio-input"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>A</Label>
                    <Input
                      type="time"
                      value={toxHoraFin}
                      onChange={(e) => setToxHoraFin(e.target.value)}
                      data-testid="tox-hora-fin-input"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label>Foto de la zona</Label>
                  {toxFoto ? (
                    <div className="relative inline-block">
                      <img src={toxFoto} alt="" className="w-24 h-24 rounded-lg object-cover border border-slate-200" />
                      <button
                        type="button"
                        onClick={() => setToxFoto(null)}
                        className="absolute -top-2 -right-2 bg-white rounded-full border border-slate-200 p-0.5 text-slate-500"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ) : (
                    <label className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 cursor-pointer hover:bg-slate-50">
                      <Camera className="w-4 h-4" />
                      Añadir foto
                      <input type="file" accept="image/*" onChange={onToxFoto} className="hidden" />
                    </label>
                  )}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Nota (opcional)</Label>
              <Textarea
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Cualquier detalle que quieras añadir"
                rows={2}
                data-testid="nota-input"
              />
            </div>

            {/* Importe estimado */}
            <div className="bg-emerald-50 border border-emerald-100 rounded-lg p-3 flex items-center justify-between">
              <span className="text-sm text-emerald-800">Importe estimado</span>
              <span className="text-lg font-bold text-emerald-700 font-['JetBrains_Mono']">
                {importeEstimado.toFixed(2)} €
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              El administrador revisará la solicitud y podrá ajustar el importe final.
            </p>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={enviar}
              disabled={enviando}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              data-testid="enviar-pago-extra-btn"
            >
              {enviando ? "Enviando..." : "Enviar solicitud"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PagosExtraPage;
