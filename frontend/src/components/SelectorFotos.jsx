import { useRef } from "react";
import { toast } from "sonner";
import { Camera, Images, X } from "lucide-react";
import { comprimirImagen } from "@/lib/imagen";

/**
 * Selector de varias fotos (hasta `max`): botones "Hacer foto" (cámara) y
 * "Galería", con miniaturas. `fotos` es una lista de data-URIs y `onChange`
 * recibe la lista nueva. Los inputs se disparan por ref desde botones
 * normales (no por <label>), que es lo más estable dentro de un diálogo.
 */
const SelectorFotos = ({ fotos, onChange, max = 10, disabled = false }) => {
  const camRef = useRef(null);
  const galRef = useRef(null);

  const onElegir = async (e) => {
    const files = Array.from(e.target.files || []).filter((f) => f.type.startsWith("image/"));
    e.target.value = "";
    if (files.length === 0) return;
    try {
      const datos = [];
      for (const f of files) datos.push(await comprimirImagen(f));
      onChange([...fotos, ...datos].slice(0, max));
    } catch (err) {
      console.error("Error leyendo fotos:", err);
      toast.error("No se pudo leer la foto");
    }
  };

  return (
    <div className="space-y-2">
      {fotos.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {fotos.map((src, idx) => (
            <div key={idx} className="relative">
              <img src={src} alt="" className="w-16 h-16 rounded-md object-cover border border-slate-200" />
              <button
                type="button"
                onClick={() => onChange(fotos.filter((_, i) => i !== idx))}
                className="absolute -top-1.5 -right-1.5 bg-slate-900 text-white rounded-full p-0.5"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
      <input
        ref={camRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onElegir}
        className="hidden"
      />
      <input
        ref={galRef}
        type="file"
        accept="image/*"
        multiple
        onChange={onElegir}
        className="hidden"
      />
      <div className="flex gap-2 flex-wrap">
        <button
          type="button"
          disabled={disabled || fotos.length >= max}
          onClick={() => camRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          data-testid="selector-fotos-camara"
        >
          <Camera className="w-4 h-4" />
          Hacer foto
        </button>
        <button
          type="button"
          disabled={disabled || fotos.length >= max}
          onClick={() => galRef.current?.click()}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 disabled:opacity-50"
          data-testid="selector-fotos-galeria"
        >
          <Images className="w-4 h-4" />
          Galería
        </button>
      </div>
    </div>
  );
};

export default SelectorFotos;
