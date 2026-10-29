import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";

// Dictado por voz (Web Speech API del navegador, en español). Cada frase
// terminada se entrega a onTexto para añadirla al texto que ya hay.
// Si el navegador no lo soporta, el botón no se muestra.
const SpeechRecognitionAPI =
  typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

const BotonDictado = ({ onTexto, disabled = false, className = "" }) => {
  const [escuchando, setEscuchando] = useState(false);
  const [provisional, setProvisional] = useState("");
  const recRef = useRef(null);

  useEffect(() => () => recRef.current?.abort?.(), []);

  if (!SpeechRecognitionAPI) return null;

  const parar = () => {
    recRef.current?.stop();
  };

  const empezar = () => {
    const rec = new SpeechRecognitionAPI();
    rec.lang = "es-ES";
    rec.continuous = true;
    rec.interimResults = true;
    rec.onresult = (e) => {
      let interino = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const t = e.results[i][0].transcript;
        if (e.results[i].isFinal) onTexto(t.trim());
        else interino += t;
      }
      setProvisional(interino);
    };
    rec.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        toast.error("Permite el micrófono en el navegador para poder dictar");
      } else if (e.error !== "no-speech" && e.error !== "aborted") {
        toast.error("No se pudo dictar. Inténtalo de nuevo");
      }
    };
    rec.onend = () => {
      setEscuchando(false);
      setProvisional("");
    };
    recRef.current = rec;
    try {
      rec.start();
      setEscuchando(true);
    } catch {
      toast.error("No se pudo iniciar el micrófono");
    }
  };

  return (
    <div className={className}>
      <button
        type="button"
        onClick={escuchando ? parar : empezar}
        disabled={disabled}
        className={`inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors disabled:opacity-50 ${
          escuchando
            ? "bg-red-500 text-white border-red-500 animate-pulse"
            : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
        }`}
        data-testid="boton-dictado"
      >
        {escuchando ? <Square className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
        {escuchando ? "Parar dictado" : "Dictar"}
      </button>
      {escuchando && (
        <p className="text-xs text-slate-500 mt-1 italic">{provisional || "Escuchando... habla ahora"}</p>
      )}
    </div>
  );
};

export default BotonDictado;
