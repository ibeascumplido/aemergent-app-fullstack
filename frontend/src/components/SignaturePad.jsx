import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Eraser, PenLine } from "lucide-react";

/**
 * Canvas de firma sin dependencias externas (funciona con raton, dedo o lapiz
 * via Pointer Events). Pensado para reutilizarse tanto en la firma del
 * operario responsable (5A.3 parte 1) como en la firma del cliente (5A.3
 * parte 2, vista publica sin login).
 *
 * Props:
 * - value: data URL PNG existente (o null). Si se pasa, se muestra como
 *   imagen estatica con boton "Firmar de nuevo" en lugar del canvas.
 * - onChange(dataUrlOrNull): se llama al terminar cada trazo y al limpiar.
 * - disabled: deshabilita la interaccion (sigue mostrando la firma si la hay).
 * - height: alto en px del area de firma (por defecto 160).
 */
const SignaturePad = ({ value, onChange, disabled = false, height = 160 }) => {
  const canvasRef = useRef(null);
  const drawingRef = useRef(false);
  const lastPointRef = useRef(null);
  const vacioRef = useRef(true);

  const [modoFirma, setModoFirma] = useState(!value);

  useEffect(() => {
    setModoFirma(!value);
  }, [value]);

  const configurarContexto = (ctx) => {
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1e293b";
  };

  const resizeCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0) return;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);
    configurarContexto(ctx);
  };

  useEffect(() => {
    if (!modoFirma) return;
    resizeCanvas();
    vacioRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modoFirma]);

  const posDesdeEvento = (e) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const iniciarTrazo = (e) => {
    if (disabled) return;
    e.preventDefault();
    canvasRef.current.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = posDesdeEvento(e);
  };

  const trazar = (e) => {
    if (!drawingRef.current || disabled) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const p = posDesdeEvento(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    lastPointRef.current = p;
    vacioRef.current = false;
  };

  const terminarTrazo = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    onChange(vacioRef.current ? null : canvas.toDataURL("image/png"));
  };

  const limpiar = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    vacioRef.current = true;
    onChange(null);
  };

  // Firma ya guardada: se muestra como imagen estatica
  if (!modoFirma && value) {
    return (
      <div className="space-y-2">
        <div
          className="border border-slate-200 rounded-lg bg-white p-2 flex items-center justify-center"
          style={{ height }}
        >
          {/* eslint-disable-next-line jsx-a11y/img-redundant-alt */}
          <img src={value} alt="Firma" className="max-h-full max-w-full" />
        </div>
        {!disabled && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setModoFirma(true)}
            className="text-slate-500"
            data-testid="firmar-de-nuevo-btn"
          >
            <PenLine className="w-3.5 h-3.5 mr-1.5" />
            Firmar de nuevo
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <canvas
        ref={canvasRef}
        style={{ height, touchAction: "none" }}
        className={`w-full border border-slate-200 rounded-lg bg-white ${
          disabled ? "opacity-60" : "cursor-crosshair"
        }`}
        onPointerDown={iniciarTrazo}
        onPointerMove={trazar}
        onPointerUp={terminarTrazo}
        onPointerLeave={terminarTrazo}
        data-testid="signature-canvas"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-400">Firma con el dedo, el raton o el lapiz</p>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={limpiar}
          disabled={disabled}
          className="text-slate-500"
          data-testid="limpiar-firma-btn"
        >
          <Eraser className="w-3.5 h-3.5 mr-1.5" />
          Limpiar
        </Button>
      </div>
    </div>
  );
};

export default SignaturePad;
