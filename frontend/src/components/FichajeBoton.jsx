import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import { Clock, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const JORNADA_ESTANDAR_HORAS = 7.5;
const TOPE_CONTADOR_HORAS = 12;

/** Cuenta hacia delante desde la hora de entrada, con tope en 12h. */
const useContadorJornada = (entradaISO, activo) => {
  const [ahora, setAhora] = useState(Date.now());
  useEffect(() => {
    if (!activo) return;
    setAhora(Date.now()); // actualizar ya mismo, sin esperar al primer intervalo
    const interval = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [activo]);

  if (!activo || !entradaISO) return null;
  const transcurridoMs = Math.max(0, ahora - new Date(entradaISO).getTime());
  const topeMs = TOPE_CONTADOR_HORAS * 60 * 60 * 1000;
  const enTope = transcurridoMs >= topeMs;
  const msMostrado = Math.min(transcurridoMs, topeMs);
  const horas = Math.floor(msMostrado / 3600000);
  const minutos = Math.floor((msMostrado % 3600000) / 60000);
  const segundos = Math.floor((msMostrado % 60000) / 1000);
  const jornadaCumplida = transcurridoMs >= JORNADA_ESTANDAR_HORAS * 60 * 60 * 1000;
  return {
    texto: `${String(horas).padStart(2, "0")}:${String(minutos).padStart(2, "0")}:${String(segundos).padStart(2, "0")}${enTope ? "+" : ""}`,
    jornadaCumplida,
  };
};

/**
 * Boton de fichaje (Fase 19), junto al saludo del dashboard. Muy simple a
 * proposito: solo entrada/salida, con geolocalizacion y el sitio desde
 * donde se ficha (cliente/centro registrado, o el estandar "Inicia
 * Madrid" para cuando se trabaja desde la oficina). Sin turnos ni
 * calculo de horas, solo el registro de eventos.
 */
const FichajeBoton = () => {
  const [estado, setEstado] = useState("fuera"); // dentro | fuera
  const [ultimoFichaje, setUltimoFichaje] = useState(null);
  const [loading, setLoading] = useState(true);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [modo, setModo] = useState("estandar"); // estandar | cliente
  const [clientes, setClientes] = useState([]);
  const [clienteId, setClienteId] = useState("");
  const [centrosDelCliente, setCentrosDelCliente] = useState([]);
  const [centroId, setCentroId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [permisoUbicacion, setPermisoUbicacion] = useState(null); // null | "granted" | "denied" | "prompt"

  const cargarEstado = async () => {
    try {
      const res = await axios.get(`${API}/fichajes/hoy`);
      setEstado(res.data.estado);
      const lista = res.data.fichajes || [];
      setUltimoFichaje(lista.length > 0 ? lista[lista.length - 1] : null);
    } catch (err) {
      console.error("Error cargando estado de fichaje:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargarEstado();
  }, []);

  const abrirDialogo = () => {
    setModo("estandar");
    setClienteId("");
    setCentroId("");
    setCentrosDelCliente([]);
    setDialogOpen(true);
    if (clientes.length === 0) {
      axios
        .get(`${API}/clients`)
        .then((res) => setClientes(res.data))
        .catch(() => setClientes([]));
    }
    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: "geolocation" })
        .then((status) => {
          setPermisoUbicacion(status.state);
          status.onchange = () => setPermisoUbicacion(status.state);
        })
        .catch(() => setPermisoUbicacion(null));
    }
  };

  const onCambiarCliente = (id) => {
    setClienteId(id);
    setCentroId("");
    setCentrosDelCliente([]);
    const cliente = clientes.find((c) => c.id === id);
    if (cliente) {
      axios
        .get(`${API}/clients/${cliente.slug}/centros`)
        .then((res) => setCentrosDelCliente(res.data))
        .catch(() => setCentrosDelCliente([]));
    }
  };

  const enviarFichaje = async (lat, lng, precision) => {
    setEnviando(true);
    try {
      await axios.post(`${API}/fichajes`, {
        tipo: estado === "dentro" ? "salida" : "entrada",
        latitud: lat,
        longitud: lng,
        precision_metros: precision,
        destino_tipo: modo,
        destino_cliente_id: modo === "cliente" ? clienteId || null : null,
        destino_centro_id: modo === "cliente" ? centroId || null : null,
      });
      toast.success(estado === "dentro" ? "Salida fichada" : "Entrada fichada");
      setDialogOpen(false);
      await cargarEstado();
    } catch (err) {
      console.error("Error fichando:", err);
      toast.error(err?.response?.data?.detail || "No se pudo fichar");
    } finally {
      setEnviando(false);
    }
  };

  const redondear = (n) => Math.round(n * 100) / 100;

  const obtenerUbicacionFresca = () => {
    // watchPosition entrega la PRIMERA lectura disponible en cuanto la
    // tiene, en vez de esperar a la "mejor" posible como getCurrentPosition
    // (que en algunos moviles se queda esperando de mas). Le damos un
    // margen real de 20s antes de rendirnos.
    let resuelto = false;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        if (resuelto) return;
        resuelto = true;
        navigator.geolocation.clearWatch(watchId);
        enviarFichaje(
          redondear(pos.coords.latitude),
          redondear(pos.coords.longitude),
          pos.coords.accuracy
        );
      },
      (err) => {
        if (resuelto) return;
        resuelto = true;
        navigator.geolocation.clearWatch(watchId);
        manejarErrorUbicacion(err);
      },
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 }
    );
  };

  const confirmarFichaje = () => {
    if (modo === "cliente" && !clienteId) {
      toast.error("Selecciona un cliente");
      return;
    }
    if (!navigator.geolocation) {
      enviarFichaje(null, null, null);
      return;
    }
    setEnviando(true);

    // Paso 1: pedir cualquier posicion que el propio movil YA tenga
    // guardada (aunque tenga hasta 1 hora), sin obligar a calcular una
    // nueva. Para una ubicacion aproximada nos vale de sobra, y responde
    // casi al instante si existe. Solo si no hay ninguna guardada (poco
    // habitual) se intenta obtener una nueva de verdad, con margen real.
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        enviarFichaje(
          redondear(pos.coords.latitude),
          redondear(pos.coords.longitude),
          pos.coords.accuracy
        );
      },
      (err) => {
        if (err.code === err.PERMISSION_DENIED) {
          manejarErrorUbicacion(err);
          return;
        }
        obtenerUbicacionFresca();
      },
      { enableHighAccuracy: false, timeout: 3000, maximumAge: 3600000 }
    );
  };

  const manejarErrorUbicacion = (err) => {
    console.error("Error de geolocalización:", err);
    let mensaje = "No se pudo obtener tu ubicación. Se ficha sin ubicación.";
    if (err.code === err.PERMISSION_DENIED) {
      mensaje =
        "Ubicación bloqueada para esta app. Actívala en los ajustes del navegador (icono del candado, junto a la URL) y vuelve a intentarlo.";
    } else if (err.code === err.POSITION_UNAVAILABLE) {
      mensaje = "No se pudo determinar tu ubicación. Comprueba que el GPS esté activado.";
    } else if (err.code === err.TIMEOUT) {
      mensaje = "Tardó demasiado en obtener tu ubicación. Se ficha sin ubicación.";
    }
    toast.error(mensaje, { duration: 6000 });
    enviarFichaje(null, null, null);
  };

  const dentro = estado === "dentro";
  const contador = useContadorJornada(ultimoFichaje?.fecha_hora, dentro);

  if (loading) return null;

  return (
    <>
      <button
        type="button"
        onClick={abrirDialogo}
        className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border shadow-sm transition-all shrink-0 ${
          dentro
            ? contador?.jornadaCumplida
              ? "bg-amber-50 border-amber-200 text-amber-700 hover:bg-amber-100"
              : "bg-green-50 border-green-200 text-green-700 hover:bg-green-100"
            : "bg-white border-slate-200 text-slate-700 hover:border-red-200"
        }`}
        data-testid="fichaje-btn"
      >
        <span
          className={`w-2 h-2 rounded-full ${
            dentro ? (contador?.jornadaCumplida ? "bg-amber-500" : "bg-green-500 animate-pulse") : "bg-slate-300"
          }`}
        />
        <Clock className="w-4 h-4" />
        <span className="text-sm font-semibold">
          {dentro ? "Fichar salida" : "Fichar entrada"}
        </span>
        {dentro && contador && (
          <span className="text-xs font-mono opacity-80">· {contador.texto}</span>
        )}
      </button>

      <Dialog open={dialogOpen} onOpenChange={(v) => !enviando && setDialogOpen(v)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{dentro ? "Fichar salida" : "Fichar entrada"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {ultimoFichaje && (
              <p className="text-xs text-slate-400">
                {dentro ? "Entrada fichada" : "Última salida"} a las{" "}
                {new Date(ultimoFichaje.fecha_hora).toLocaleTimeString("es-ES", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}{" "}
                en {ultimoFichaje.destino_nombre}.
              </p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setModo("estandar")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  modo === "estandar"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
                data-testid="fichaje-modo-estandar-btn"
              >
                Inicia Madrid
              </button>
              <button
                type="button"
                onClick={() => setModo("cliente")}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                  modo === "cliente"
                    ? "bg-indigo-50 border-indigo-200 text-indigo-700"
                    : "bg-white border-slate-200 text-slate-500"
                }`}
                data-testid="fichaje-modo-cliente-btn"
              >
                Cliente / Centro
              </button>
            </div>

            {modo === "cliente" && (
              <>
                <div className="space-y-1.5">
                  <Label>Cliente</Label>
                  <Select value={clienteId} onValueChange={onCambiarCliente}>
                    <SelectTrigger data-testid="fichaje-cliente-select">
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
                {clienteId && centrosDelCliente.length > 0 && (
                  <div className="space-y-1.5">
                    <Label>Centro (opcional)</Label>
                    <Select value={centroId} onValueChange={setCentroId}>
                      <SelectTrigger data-testid="fichaje-centro-select">
                        <SelectValue placeholder="Selecciona..." />
                      </SelectTrigger>
                      <SelectContent>
                        {centrosDelCliente.map((ce) => (
                          <SelectItem key={ce.id} value={ce.id}>
                            {ce.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}

            <p className="text-xs text-slate-400 flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 shrink-0" />
              Se guardará tu ubicación aproximada en este momento.
            </p>
            {permisoUbicacion === "denied" && (
              <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg p-2.5" data-testid="aviso-ubicacion-bloqueada">
                Tienes la ubicación bloqueada para esta app. Ábrela en los ajustes del
                navegador (icono del candado junto a la URL) y actívala, o el fichaje se
                guardará sin ubicación.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={enviando}>
              Cancelar
            </Button>
            <Button
              onClick={confirmarFichaje}
              disabled={enviando}
              className={`text-white ${dentro ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
              data-testid="confirmar-fichaje-btn"
            >
              {enviando ? "Fichando..." : dentro ? "Confirmar salida" : "Confirmar entrada"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default FichajeBoton;
