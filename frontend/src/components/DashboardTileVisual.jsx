// Contenido visual compartido para las tarjetas de acceso rápido del
// dashboard (Foto rápida, Parte de trabajo, Solicitud de ropa, Firma de
// documentos, Mi Calendario, Tarea de hoy): icono circular con un arco de
// color, título, subtítulo y un botón cuadrado con flecha. Cada tarjeta
// decide el elemento contenedor (button, label o Link) y solo importa
// este contenido interior para mantener el mismo aspecto en todas.

import { ArrowRight } from "lucide-react";

const COLORES = {
  azul: { arco: "#3b82f6", fondo: "bg-blue-50", icono: "text-blue-500", boton: "bg-blue-50 text-blue-500" },
  verde: { arco: "#22c55e", fondo: "bg-green-50", icono: "text-green-600", boton: "bg-green-50 text-green-600" },
  naranja: { arco: "#f97316", fondo: "bg-orange-50", icono: "text-orange-500", boton: "bg-orange-50 text-orange-500" },
  morado: { arco: "#a855f7", fondo: "bg-purple-50", icono: "text-purple-500", boton: "bg-purple-50 text-purple-500" },
  rojo: { arco: "#ef4444", fondo: "bg-red-50", icono: "text-red-500", boton: "bg-red-50 text-red-500" },
  ambar: { arco: "#f59e0b", fondo: "bg-amber-50", icono: "text-amber-600", boton: "bg-amber-50 text-amber-600" },
};

const DashboardTileVisual = ({ icon: Icon, title, subtitle, color = "azul", extra }) => {
  const c = COLORES[color] || COLORES.azul;
  return (
    <div className="flex flex-col items-center text-center gap-1 py-1">
      <div className="relative w-16 h-16 mb-1.5">
        <svg viewBox="0 0 100 100" className="absolute inset-0 w-full h-full -rotate-90">
          <circle
            cx="50"
            cy="50"
            r="46"
            fill="none"
            stroke={c.arco}
            strokeWidth="4"
            strokeDasharray="72 400"
            strokeLinecap="round"
          />
        </svg>
        <div className={`absolute inset-[7px] rounded-full ${c.fondo} flex items-center justify-center`}>
          <Icon className={`w-7 h-7 ${c.icono}`} />
        </div>
      </div>
      <p className="font-bold text-slate-900 text-[15px] leading-tight">{title}</p>
      <p className="text-xs text-slate-400 leading-tight">{subtitle}</p>
      {extra}
      <div className={`mt-1.5 w-8 h-8 rounded-lg ${c.boton} flex items-center justify-center`}>
        <ArrowRight className="w-4 h-4" />
      </div>
    </div>
  );
};

export default DashboardTileVisual;
