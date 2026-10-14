import { useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Calendar, Building2, CalendarRange, ArrowUp, ArrowDown, GripVertical } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const ACCIONES = {
  presupuestos: { to: "/budgets", Icon: FileText, color: "text-red-500", titulo: "Presupuestos", desc: "Ver y crear presupuestos" },
  calendarios: { to: "/calendar", Icon: Calendar, color: "text-red-500", titulo: "Ver Calendarios", desc: "Gestionar vacaciones de todos" },
  clientes: { to: "/clients", Icon: Building2, color: "text-sky-500", titulo: "Clientes", desc: "Fichas, fotos, partes e incidencias" },
  planificacion: { to: "/planificacion", Icon: CalendarRange, color: "text-emerald-500", titulo: "Planificación", desc: "Operarios por cliente y día" },
};
const ORDEN_DEFECTO = ["presupuestos", "calendarios", "clientes", "planificacion"];
const CLAVE = "acciones_rapidas_orden_v1";

const leerOrden = () => {
  try {
    const g = JSON.parse(localStorage.getItem(CLAVE) || "null");
    if (Array.isArray(g) && g.length === ORDEN_DEFECTO.length && ORDEN_DEFECTO.every((k) => g.includes(k))) return g;
  } catch { /* sin almacenamiento */ }
  return ORDEN_DEFECTO;
};

const AccionesRapidas = () => {
  const [orden, setOrden] = useState(leerOrden);
  const [arrastrando, setArrastrando] = useState(null);

  const guardar = (nuevo) => {
    setOrden(nuevo);
    try { localStorage.setItem(CLAVE, JSON.stringify(nuevo)); } catch { /* ignorar */ }
  };

  const mover = (desde, hasta) => {
    if (desde === hasta || hasta < 0 || hasta >= orden.length) return;
    const n = [...orden];
    const [x] = n.splice(desde, 1);
    n.splice(hasta, 0, x);
    guardar(n);
  };

  return (
    <Card className="border-slate-100 shadow-sm">
      <CardHeader className="border-b border-slate-50 pb-4">
        <CardTitle className="text-lg font-semibold text-slate-900 font-['Manrope']">Acciones Rápidas</CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {orden.map((k, i) => {
          const a = ACCIONES[k];
          return (
            <div
              key={k}
              className={`flex items-center gap-1 ${arrastrando === k ? "opacity-50" : ""}`}
              draggable
              onDragStart={(e) => { setArrastrando(k); e.dataTransfer.effectAllowed = "move"; }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                if (arrastrando) mover(orden.indexOf(arrastrando), i);
                setArrastrando(null);
              }}
              onDragEnd={() => setArrastrando(null)}
            >
              <GripVertical className="w-4 h-4 text-slate-300 cursor-grab flex-shrink-0" />
              <Link to={a.to} className="flex-1 min-w-0">
                <Button variant="outline" className="w-full justify-start h-14 text-left">
                  <a.Icon className={`w-5 h-5 mr-3 ${a.color}`} />
                  <div>
                    <p className="font-medium">{a.titulo}</p>
                    <p className="text-xs text-slate-500">{a.desc}</p>
                  </div>
                </Button>
              </Link>
              <div className="flex flex-col flex-shrink-0">
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400" disabled={i === 0} onClick={() => mover(i, i - 1)} title="Subir">
                  <ArrowUp className="w-3 h-3" />
                </Button>
                <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-slate-400" disabled={i === orden.length - 1} onClick={() => mover(i, i + 1)} title="Bajar">
                  <ArrowDown className="w-3 h-3" />
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};

export default AccionesRapidas;
