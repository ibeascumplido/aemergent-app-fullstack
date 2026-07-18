import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "sonner";
import {
  Camera,
  Mic,
  Square,
  Play,
  Pause,
  X,
  Check,
  Trash2,
} from "lucide-react";
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

const hoyISO = () => new Date().toISOString().slice(0, 10);

const generarLoteId = () =>
  window.crypto?.randomUUID ? window.crypto.randomUUID() : `lote-${Date.now()}-${Math.random()}`;

/**
 * Reemplaza el boton simple "Foto rapida" por una sesion de captura: se
 * pueden tomar varias fotos seguidas (se suben una a una, agrupadas por
 * lote_id), y al terminar aparece una mini-clasificacion opcional
 * (antes/despues, fecha, cliente, nota de voz) que se aplica a la vez a
 * todas las fotos del lote. Si se omite la clasificacion, las fotos
 * quedan igual que antes: sin clasificar, en la bandeja del admin.
 */
const FotoRapidaFlow = () => {
  const [paso, setPaso] = useState("boton"); // boton | capturando | clasificando
  const [loteId, setLoteId] = useState(null);
  const [fotos, setFotos] = useState([]); // [{id, url}]
  const [subiendoFoto, setSubiendoFoto] = useState(false);

  const [clientes, setClientes] = useState([]);
  const [antesDespues, setAntesDespues] = useState("none");
  const [fecha, setFecha] = useState(hoyISO());
  const [clienteId, setClienteId] = useState("none");
  const [enviando, setEnviando] = useState(false);

  // Grabacion de audio
  const [grabando, setGrabando] = useState(false);
  const [audioDataUrl, setAudioDataUrl] = useState(null);
  const [audioPreviewUrl, setAudioPreviewUrl] = useState(null);
  const [reproduciendo, setReproduciendo] = useState(false);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioElRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    if (paso !== "clasificando") return;
    axios
      .get(`${API}/clients`)
      .then((res) => setClientes(res.data))
      .catch(() => setClientes([]));
  }, [paso]);

  const iniciarSesion = () => {
    const nuevo = generarLoteId();
    setLoteId(nuevo);
    setFotos([]);
    setPaso("capturando");
    return nuevo;
  };

  const handleFotoSeleccionada = (e, loteIdParaEstaFoto) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const idLote = loteIdParaEstaFoto || loteId;
    setSubiendoFoto(true);
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const res = await axios.post(`${API}/fotos`, { imagen: reader.result, lote_id: idLote });
        setFotos((prev) => [...prev, { id: res.data.id, url: res.data.url }]);
      } catch (err) {
        console.error("Error subiendo foto:", err);
        toast.error("No se pudo subir la foto");
      } finally {
        setSubiendoFoto(false);
      }
    };
    reader.onerror = () => {
      toast.error("No se pudo leer la foto");
      setSubiendoFoto(false);
    };
    reader.readAsDataURL(file);
  };

  const irAClasificar = () => {
    setAntesDespues("none");
    setFecha(hoyISO());
    setClienteId("none");
    setAudioDataUrl(null);
    setAudioPreviewUrl(null);
    setPaso("clasificando");
  };

  const cancelarSesion = () => {
    // Las fotos ya subidas no se borran: quedan sin clasificar, esperando
    // al admin, igual que si se hubiera usado el flujo simple de antes.
    setPaso("boton");
    setLoteId(null);
    setFotos([]);
  };

  // --- Grabacion de audio ---------------------------------------------

  const iniciarGrabacion = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioPreviewUrl(URL.createObjectURL(blob));
        const reader = new FileReader();
        reader.onload = () => setAudioDataUrl(reader.result);
        reader.readAsDataURL(blob);
        streamRef.current?.getTracks().forEach((t) => t.stop());
      };
      mr.start();
      mediaRecorderRef.current = mr;
      setGrabando(true);
    } catch (err) {
      console.error("Error accediendo al microfono:", err);
      toast.error("No se pudo acceder al micrófono");
    }
  };

  const detenerGrabacion = () => {
    mediaRecorderRef.current?.stop();
    setGrabando(false);
  };

  const borrarAudio = () => {
    setAudioDataUrl(null);
    setAudioPreviewUrl(null);
    setReproduciendo(false);
  };

  const toggleReproducir = () => {
    if (!audioElRef.current) return;
    if (reproduciendo) {
      audioElRef.current.pause();
    } else {
      audioElRef.current.play();
    }
  };

  // --- Envio final -------------------------------------------------------

  const finalizarEnvio = async () => {
    setEnviando(true);
    try {
      const payload = {
        antes_despues: antesDespues === "none" ? null : antesDespues,
        fecha: fecha || null,
        client_id: clienteId === "none" ? null : clienteId,
        audio: audioDataUrl,
      };
      await axios.put(`${API}/fotos/lote/${loteId}/clasificar`, payload);
      toast.success(
        fotos.length > 1 ? `${fotos.length} fotos enviadas` : "Foto enviada"
      );
      setPaso("boton");
      setLoteId(null);
      setFotos([]);
    } catch (err) {
      console.error("Error clasificando lote:", err);
      toast.error("No se pudo guardar la clasificación, pero las fotos ya están subidas");
    } finally {
      setEnviando(false);
    }
  };

  // --- Render --------------------------------------------------------------

  if (paso === "boton") {
    return (
      <label
        className="mb-8 flex items-center justify-center gap-3 w-full py-4 rounded-xl text-white font-semibold text-lg shadow-sm transition-colors bg-red-500 hover:bg-red-600 cursor-pointer"
        data-testid="foto-rapida-btn"
      >
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => {
            const nuevoLote = iniciarSesion();
            handleFotoSeleccionada(e, nuevoLote);
          }}
          className="hidden"
        />
        <Camera className="w-6 h-6" />
        Foto rápida
      </label>
    );
  }

  if (paso === "capturando") {
    return (
      <div className="mb-8 border border-slate-200 rounded-xl p-4" data-testid="sesion-captura">
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-slate-900">
            {fotos.length} {fotos.length === 1 ? "foto" : "fotos"}
          </p>
          <button
            type="button"
            onClick={cancelarSesion}
            className="text-xs text-slate-400 hover:text-slate-700"
          >
            Cancelar
          </button>
        </div>

        {fotos.length > 0 && (
          <div className="flex gap-2 flex-wrap mb-3">
            {fotos.map((f) => (
              <img
                key={f.id}
                src={f.url}
                alt=""
                className="w-14 h-14 rounded-lg object-cover border border-slate-200"
              />
            ))}
          </div>
        )}

        <label
          className={`flex items-center justify-center gap-2 w-full py-3 rounded-lg text-white font-medium cursor-pointer transition-colors ${
            subiendoFoto ? "bg-red-300 cursor-wait" : "bg-red-500 hover:bg-red-600"
          }`}
          data-testid="tomar-otra-foto-btn"
        >
          <input
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFotoSeleccionada}
            disabled={subiendoFoto}
            className="hidden"
          />
          <Camera className="w-5 h-5" />
          {subiendoFoto ? "Subiendo..." : fotos.length === 0 ? "Tomar foto" : "Tomar otra foto"}
        </label>

        {fotos.length > 0 && (
          <Button
            onClick={irAClasificar}
            disabled={subiendoFoto}
            className="w-full mt-2 bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="finalizar-captura-btn"
          >
            Finalizar ({fotos.length} {fotos.length === 1 ? "foto" : "fotos"})
          </Button>
        )}
      </div>
    );
  }

  // paso === "clasificando"
  return (
    <Dialog open onOpenChange={(v) => !v && !enviando && setPaso("capturando")}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>
            Clasificar {fotos.length > 1 ? `${fotos.length} fotos` : "foto"} (opcional)
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 flex-wrap">
          {fotos.slice(0, 6).map((f) => (
            <img
              key={f.id}
              src={f.url}
              alt=""
              className="w-12 h-12 rounded-lg object-cover border border-slate-200"
            />
          ))}
          {fotos.length > 6 && (
            <span className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center text-xs text-slate-500">
              +{fotos.length - 6}
            </span>
          )}
        </div>

        <div className="space-y-3 py-1">
          <div className="space-y-1.5">
            <Label>Antes / Después</Label>
            <Select value={antesDespues} onValueChange={setAntesDespues}>
              <SelectTrigger data-testid="foto-antes-despues-select">
                <SelectValue placeholder="Sin especificar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                <SelectItem value="antes">Antes</SelectItem>
                <SelectItem value="despues">Después</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="foto-fecha">Fecha</Label>
            <input
              id="foto-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="w-full h-9 px-3 rounded-md border border-slate-200 text-sm"
              data-testid="foto-fecha-input"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Cliente</Label>
            <Select value={clienteId} onValueChange={setClienteId}>
              <SelectTrigger data-testid="foto-cliente-select">
                <SelectValue placeholder="Sin especificar" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Sin especificar</SelectItem>
                {clientes.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.nombre}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Nota de voz (opcional)</Label>
            {audioPreviewUrl ? (
              <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={toggleReproducir}
                  className="text-indigo-600"
                  data-testid="reproducir-audio-btn"
                >
                  {reproduciendo ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                </button>
                <audio
                  ref={audioElRef}
                  src={audioPreviewUrl}
                  onPlay={() => setReproduciendo(true)}
                  onPause={() => setReproduciendo(false)}
                  onEnded={() => setReproduciendo(false)}
                  className="hidden"
                />
                <span className="text-xs text-slate-500 flex-1">Nota grabada</span>
                <button
                  type="button"
                  onClick={borrarAudio}
                  className="text-slate-400 hover:text-red-600"
                  data-testid="borrar-audio-btn"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={grabando ? detenerGrabacion : iniciarGrabacion}
                className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                  grabando
                    ? "bg-red-50 border-red-300 text-red-600 animate-pulse"
                    : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                }`}
                data-testid="grabar-audio-btn"
              >
                {grabando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {grabando ? "Detener grabación" : "Grabar nota de voz"}
              </button>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-col gap-2">
          <Button
            onClick={finalizarEnvio}
            disabled={enviando || grabando}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
            data-testid="enviar-fotos-btn"
          >
            <Check className="w-4 h-4 mr-2" />
            {enviando ? "Enviando..." : "Enviar"}
          </Button>
          <button
            type="button"
            onClick={() => setPaso("capturando")}
            disabled={enviando}
            className="text-xs text-slate-400 hover:text-slate-700 inline-flex items-center gap-1"
          >
            <X className="w-3 h-3" />
            Volver a las fotos
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default FotoRapidaFlow;
