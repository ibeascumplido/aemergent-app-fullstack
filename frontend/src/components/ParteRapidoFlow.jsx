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

const hoyISO = () => new Date().toISOString().slice(0, 10);
const hoyMes = () => new Date().toISOString().slice(0, 7);

/** Lunes de la semana que contiene la fecha dada (YYYY-MM-DD) */
const lunesDeLaSemana = (fechaISO) => {
  const d = new Date(fechaISO + "T00:00:00");
  const dia = d.getDay(); // 0 = domingo
  const offset = dia === 0 ? -6 : 1 - dia;
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
};

const formatearRangoSemana = (lunesISO) => {
  const inicio = new Date(lunesISO + "T00:00:00");
  const fin = new Date(inicio);
  fin.setDate(fin.getDate() + 6);
  const fmt = (d) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
  return `${fmt(inicio)} - ${fmt(fin)}`;
};

/**
 * Acceso rapido desde el dashboard (Fase 10) para iniciar un parte de
 * trabajo. Primero se elige el tipo (estandar o rejilla, y si es rejilla
 * el periodo: mensual o semanal - la semanal es para trabajos puntuales
 * de varios dias, tipicamente 4-5). Despues cliente y centro (ambos
 * pueden ser registrados o escritos a mano si aun no estan de alta). Si
 * el cliente+centro elegido tiene partes abiertos, se puede continuar
 * uno o crear otro nuevo.
 */
const ParteRapidoFlow = () => {
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);

  const [tipoParte, setTipoParte] = useState("estandar"); // estandar | rejilla
  const [rejillaPeriodo, setRejillaPeriodo] = useState("mensual"); // mensual | semanal
  const [mesRejilla, setMesRejilla] = useState(hoyMes());
  const [fechaSemana, setFechaSemana] = useState(hoyISO());

  const [clientes, setClientes] = useState([]);
  const [clienteRegistrado, setClienteRegistrado] = useState(true);
  const [clienteId, setClienteId] = useState("");
  const [clienteLibre, setClienteLibre] = useState("");

  const [centrosDelCliente, setCentrosDelCliente] = useState([]);
  const [cargandoCentros, setCargandoCentros] = useState(false);
  const [centroOpcion, setCentroOpcion] = useState("ninguno"); // ninguno | registrado | libre
  const [centroId, setCentroId] = useState("");
  const [centroLibre, setCentroLibre] = useState("");

  const [partesAbiertos, setPartesAbiertos] = useState(null);
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
    setTipoParte("estandar");
    setRejillaPeriodo("mensual");
    setMesRejilla(hoyMes());
    setFechaSemana(hoyISO());
    setClienteRegistrado(true);
    setClienteId("");
    setClienteLibre("");
    setCentrosDelCliente([]);
    setCentroOpcion("ninguno");
    setCentroId("");
    setCentroLibre("");
    setPartesAbiertos(null);
    setParteSeleccionado("");
    setDialogOpen(true);
  };

  const buscarPartesAbiertos = async (idCliente, idCentro) => {
    setCargandoPartes(true);
    try {
      const params = { client_id: idCliente, estado: "abierto" };
      if (idCentro) params.centro_id = idCentro;
      const res = await axios.get(`${API}/work-orders`, { params });
      setPartesAbiertos(res.data);
      if (res.data.length === 1) setParteSeleccionado(res.data[0].id);
      else setParteSeleccionado("");
    } catch (err) {
      console.error("Error buscando partes abiertos:", err);
      setPartesAbiertos([]);
    } finally {
      setCargandoPartes(false);
    }
  };

  const onCambiarCliente = (id) => {
    setClienteId(id);
    setCentroOpcion("ninguno");
    setCentroId("");
    setCentrosDelCliente([]);
    setPartesAbiertos(null);
    setParteSeleccionado("");
    buscarPartesAbiertos(id, null);

    const cliente = clientes.find((c) => c.id === id);
    if (cliente) {
      setCargandoCentros(true);
      axios
        .get(`${API}/clients/${cliente.slug}/centros`)
        .then((res) => setCentrosDelCliente(res.data))
        .catch(() => setCentrosDelCliente([]))
        .finally(() => setCargandoCentros(false));
    }
  };

  const onCambiarCentroOpcion = (opcion) => {
    setCentroOpcion(opcion);
    setCentroId("");
    if (opcion === "ninguno") {
      buscarPartesAbiertos(clienteId, null);
    } else {
      setPartesAbiertos(null);
      setParteSeleccionado("");
    }
  };

  const onCambiarCentroRegistrado = (id) => {
    setCentroId(id);
    buscarPartesAbiertos(clienteId, id);
  };

  const tituloRapido = () => {
    const hoy = new Date().toLocaleDateString("es-ES", { day: "numeric", month: "short" });
    if (tipoParte === "rejilla") {
      return rejillaPeriodo === "semanal"
        ? `Rejilla semana ${formatearRangoSemana(lunesDeLaSemana(fechaSemana))}`
        : `Rejilla ${mesRejilla}`;
    }
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
    if (centroOpcion === "registrado" && !centroId) {
      toast.error("Selecciona un centro");
      return;
    }
    if (centroOpcion === "libre" && !centroLibre.trim()) {
      toast.error("Escribe el nombre del centro");
      return;
    }

    setContinuando(true);
    try {
      let workOrderId =
        clienteRegistrado && centroOpcion !== "libre" ? parteSeleccionado || null : null;

      if (!workOrderId) {
        const payload = {
          titulo: tituloRapido(),
          usa_zonas: tipoParte === "rejilla",
        };
        if (clienteRegistrado) {
          payload.client_id = clienteId;
        } else {
          payload.client_libre = clienteLibre.trim();
        }
        if (centroOpcion === "registrado") {
          payload.centro_id = centroId;
        } else if (centroOpcion === "libre") {
          payload.centro_libre = centroLibre.trim();
        }
        if (tipoParte === "rejilla") {
          payload.rejilla_tipo = rejillaPeriodo;
          if (rejillaPeriodo === "semanal") {
            payload.semana_inicio = lunesDeLaSemana(fechaSemana);
          } else {
            payload.mes_rejilla = mesRejilla;
          }
        }
        const res = await axios.post(`${API}/work-orders`, payload);
        workOrderId = res.data.id;
      }

      setDialogOpen(false);
      const destino = tipoParte === "rejilla" ? "" : "?nueva=1";
      navigate(`/work-orders/${workOrderId}${destino}`);
    } catch (err) {
      console.error("Error iniciando el parte:", err);
      toast.error(err?.response?.data?.detail || "No se pudo iniciar el parte");
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
        <DialogContent className="max-w-sm max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nuevo parte de trabajo</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Tipo de parte */}
            <div className="space-y-1.5">
              <Label>Tipo de parte</Label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTipoParte("estandar")}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    tipoParte === "estandar"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                  data-testid="tipo-estandar-btn"
                >
                  Estándar
                </button>
                <button
                  type="button"
                  onClick={() => setTipoParte("rejilla")}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    tipoParte === "rejilla"
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                  data-testid="tipo-rejilla-btn"
                >
                  Rejilla
                </button>
              </div>
            </div>

            {/* Periodo de la rejilla */}
            {tipoParte === "rejilla" && (
              <div className="space-y-1.5">
                <Label>Periodo</Label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => setRejillaPeriodo("mensual")}
                    className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                      rejillaPeriodo === "mensual"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                  >
                    Mensual
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejillaPeriodo("semanal")}
                    className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                      rejillaPeriodo === "semanal"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                    data-testid="periodo-semanal-btn"
                  >
                    Semanal
                  </button>
                </div>
                {rejillaPeriodo === "mensual" ? (
                  <Input
                    type="month"
                    value={mesRejilla}
                    onChange={(e) => setMesRejilla(e.target.value)}
                  />
                ) : (
                  <div>
                    <Input
                      type="date"
                      value={fechaSemana}
                      onChange={(e) => setFechaSemana(e.target.value)}
                      data-testid="fecha-semana-input"
                    />
                    <p className="text-xs text-slate-400 mt-1">
                      Semana del {formatearRangoSemana(lunesDeLaSemana(fechaSemana))} (lunes a
                      domingo). Ideal para trabajos puntuales de varios días.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Cliente */}
            <div className="space-y-1.5">
              <Label>Cliente</Label>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => setClienteRegistrado(true)}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    clienteRegistrado
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                >
                  Registrado
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setClienteRegistrado(false);
                    setPartesAbiertos(null);
                  }}
                  className={`flex-1 py-1.5 rounded-lg text-sm border transition-colors ${
                    !clienteRegistrado
                      ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                      : "bg-white border-slate-200 text-slate-500"
                  }`}
                  data-testid="cliente-no-registrado-btn"
                >
                  No registrado
                </button>
              </div>

              {clienteRegistrado ? (
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
              ) : (
                <Input
                  value={clienteLibre}
                  onChange={(e) => setClienteLibre(e.target.value)}
                  placeholder="Ej. Panadería López"
                  data-testid="cliente-libre-input"
                />
              )}
              {!clienteRegistrado && (
                <p className="text-xs text-slate-400">
                  El administrador lo vinculará a un cliente registrado más adelante.
                </p>
              )}
            </div>

            {/* Centro (solo con cliente registrado) */}
            {clienteRegistrado && clienteId && (
              <div className="space-y-1.5">
                <Label>Centro (opcional)</Label>
                <div className="flex gap-2 mb-2">
                  <button
                    type="button"
                    onClick={() => onCambiarCentroOpcion("ninguno")}
                    className={`flex-1 py-1 rounded-lg text-xs border transition-colors ${
                      centroOpcion === "ninguno"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                  >
                    Sin centro
                  </button>
                  <button
                    type="button"
                    onClick={() => onCambiarCentroOpcion("registrado")}
                    className={`flex-1 py-1 rounded-lg text-xs border transition-colors ${
                      centroOpcion === "registrado"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                    data-testid="centro-registrado-btn"
                  >
                    Registrado
                  </button>
                  <button
                    type="button"
                    onClick={() => onCambiarCentroOpcion("libre")}
                    className={`flex-1 py-1 rounded-lg text-xs border transition-colors ${
                      centroOpcion === "libre"
                        ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                        : "bg-white border-slate-200 text-slate-500"
                    }`}
                    data-testid="centro-libre-btn"
                  >
                    No registrado
                  </button>
                </div>

                {centroOpcion === "registrado" && (
                  <Select value={centroId} onValueChange={onCambiarCentroRegistrado}>
                    <SelectTrigger data-testid="parte-rapido-centro-select">
                      <SelectValue
                        placeholder={cargandoCentros ? "Cargando..." : "Selecciona un centro..."}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {centrosDelCliente.length === 0 && !cargandoCentros ? (
                        <p className="px-3 py-2 text-xs text-slate-400">
                          Este cliente no tiene centros registrados.
                        </p>
                      ) : (
                        centrosDelCliente.map((ce) => (
                          <SelectItem key={ce.id} value={ce.id}>
                            {ce.nombre}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                )}
                {centroOpcion === "libre" && (
                  <Input
                    value={centroLibre}
                    onChange={(e) => setCentroLibre(e.target.value)}
                    placeholder="Ej. Tienda de Alcobendas"
                    data-testid="centro-libre-input"
                  />
                )}
              </div>
            )}

            {/* Partes abiertos: solo si cliente+centro son ambos registrados (o cliente reg. sin centro) */}
            {clienteRegistrado && clienteId && centroOpcion !== "libre" && (
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
                    No hay partes abiertos para esta combinación: se creará uno nuevo.
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
