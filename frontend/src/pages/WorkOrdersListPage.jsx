import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ClipboardList, Search, ChevronRight, MapPin, Building2, FileDown, Lock, Unlock, Trash2, Archive } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import axios from "axios";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const FILTROS_ESTADO = [
  { value: "", label: "Todos" },
  { value: "abierto", label: "Abiertos" },
  { value: "cerrado", label: "Cerrados" },
  { value: "archivado", label: "Archivados" },
];

const ESTADOS = {
  abierto: { txt: "Abierto", cls: "bg-emerald-100 text-emerald-700" },
  cerrado: { txt: "Cerrado", cls: "bg-slate-200 text-slate-700" },
  archivado: { txt: "Archivado", cls: "bg-amber-100 text-amber-700" },
};

// Fila que se desliza hacia la izquierda y deja ver acciones rapidas.
// Funciona con el dedo (tablet/movil) y con el raton.
const FilaDeslizable = ({ abierta, onAbrirFila, onCerrarFila, onPulsar, acciones, children }) => {
  const ancho = acciones.length * 76;
  const [arrastre, setArrastre] = useState(null); // desplazamiento en px mientras se arrastra
  const ini = useRef(null);
  const movida = useRef(false);

  const aplicado = arrastre != null ? arrastre : abierta ? ancho : 0;

  const down = (e) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    ini.current = { x: e.clientX, y: e.clientY, base: abierta ? ancho : 0, horizontal: null };
    movida.current = false;
  };
  const move = (e) => {
    const i = ini.current;
    if (!i) return;
    const dx = e.clientX - i.x;
    const dy = e.clientY - i.y;
    if (i.horizontal == null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) i.horizontal = Math.abs(dx) > Math.abs(dy);
    if (i.horizontal) {
      movida.current = true;
      setArrastre(Math.max(0, Math.min(ancho, i.base - dx)));
    }
  };
  const up = () => {
    const i = ini.current;
    ini.current = null;
    if (!i || !i.horizontal) return;
    const final = arrastre ?? i.base;
    setArrastre(null);
    if (final > ancho / 2) onAbrirFila(); else onCerrarFila();
  };

  return (
    <div className="relative overflow-hidden">
      <div className="absolute inset-y-0 right-0 flex" style={{ width: ancho }}>
        {acciones.map((a) => (
          <button key={a.clave} type="button" onClick={a.onClick}
            className={`flex-1 flex flex-col items-center justify-center gap-1 text-white text-[11px] font-medium ${a.cls}`}>
            {a.icono}{a.etiqueta}
          </button>
        ))}
      </div>
      <div
        onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}
        onClickCapture={(e) => {
          if (movida.current) { e.preventDefault(); e.stopPropagation(); movida.current = false; return; }
          if (abierta) { e.preventDefault(); e.stopPropagation(); onCerrarFila(); }
        }}
        style={{
          transform: `translateX(-${aplicado}px)`,
          transition: arrastre == null ? "transform 180ms ease" : "none",
          touchAction: "pan-y",
        }}
        className="relative bg-white"
      >
        {children}
      </div>
    </div>
  );
};

const WorkOrdersListPage = () => {
  const [partes, setPartes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [filaAbierta, setFilaAbierta] = useState(null);
  const [aBorrar, setABorrar] = useState(null);
  const [trabajando, setTrabajando] = useState(false);

  const descargarPdf = async (wo) => {
    setFilaAbierta(null);
    const t = toast.loading("Generando PDF…");
    try {
      const res = await axios.get(`${API}/work-orders/${wo.id}/pdf`, { responseType: "blob" });
      const url = window.URL.createObjectURL(new Blob([res.data], { type: "application/pdf" }));
      const a = document.createElement("a");
      a.href = url;
      a.download = `${(wo.titulo || wo.numero || "parte").replace(/[\\/:*?"<>|\r\n\t]+/g, " ").trim().slice(0, 150)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("PDF listo", { id: t });
    } catch {
      toast.error("No se pudo generar el PDF", { id: t });
    }
  };
  const cambiarEstado = async (wo, estado) => {
    setFilaAbierta(null);
    try {
      await axios.patch(`${API}/work-orders/${wo.id}`, { estado });
      setPartes((ps) => ps.map((p) => (p.id === wo.id ? { ...p, estado } : p)));
      toast.success({ cerrado: "Parte cerrado", abierto: "Parte reabierto", archivado: "Parte archivado" }[estado]);
    } catch (e) {
      toast.error(e.response?.status === 403 ? "No tienes permisos para esta acción" : "No se pudo cambiar el estado");
    }
  };
  const borrar = async () => {
    const wo = aBorrar;
    setTrabajando(true);
    try {
      await axios.delete(`${API}/work-orders/${wo.id}`);
      setPartes((ps) => ps.filter((p) => p.id !== wo.id));
      toast.success("Parte eliminado");
    } catch (e) {
      const st = e.response?.status;
      if (st === 400) toast.error("No se puede borrar: el parte tiene sesiones registradas");
      else if (st === 403) toast.error("Solo se pueden borrar partes abiertos");
      else toast.error("No se pudo eliminar el parte");
    } finally {
      setTrabajando(false);
      setABorrar(null);
      setFilaAbierta(null);
    }
  };
  const accionesDe = (wo) => {
    const a = [{ clave: "pdf", etiqueta: "PDF", icono: <FileDown className="w-5 h-5" />, cls: "bg-indigo-600", onClick: () => descargarPdf(wo) }];
    if (isAdmin) {
      a.push(wo.estado === "abierto"
        ? { clave: "cerrar", etiqueta: "Cerrar", icono: <Lock className="w-5 h-5" />, cls: "bg-slate-600", onClick: () => cambiarEstado(wo, "cerrado") }
        : { clave: "reabrir", etiqueta: "Reabrir", icono: <Unlock className="w-5 h-5" />, cls: "bg-emerald-600", onClick: () => cambiarEstado(wo, "abierto") });
      if (wo.estado === "cerrado") {
        a.push({ clave: "archivar", etiqueta: "Archivar", icono: <Archive className="w-5 h-5" />, cls: "bg-amber-600", onClick: () => cambiarEstado(wo, "archivado") });
      }
    }
    if (wo.estado === "abierto") {
      a.push({ clave: "borrar", etiqueta: "Borrar", icono: <Trash2 className="w-5 h-5" />, cls: "bg-red-600", onClick: () => setABorrar(wo) });
    }
    return a;
  };

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    axios
      .get(`${API}/work-orders/accesibles`, {
        params: filtroEstado ? { estado: filtroEstado } : {},
      })
      .then((res) => {
        if (!cancelado) setPartes(res.data || []);
      })
      .catch((err) => console.error("Error cargando partes:", err))
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [filtroEstado]);

  const partesFiltrados = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return partes;
    return partes.filter((wo) =>
      [wo.titulo, wo.client_nombre, wo.centro_nombre, wo.numero]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [partes, searchTerm]);

  return (
    <div data-testid="work-orders-list-page">
      <div className="mb-6 flex items-center gap-3">
        <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <ClipboardList className="w-6 h-6 text-indigo-500" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
            Partes de trabajo
          </h1>
          <p className="text-sm text-slate-500">
            {isAdmin ? "Todos los partes de la empresa" : "Los partes en los que participas"}
          </p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por título, número, cliente o centro..."
            className="pl-9"
            data-testid="buscador-partes"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {FILTROS_ESTADO.map((f) => (
            <button
              key={f.value || "todos"}
              type="button"
              onClick={() => setFiltroEstado(f.value)}
              data-testid={`filtro-estado-${f.value || "todos"}`}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                filtroEstado === f.value
                  ? "bg-indigo-600 border-indigo-600 text-white"
                  : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <Card className="border-slate-100 shadow-sm">
        <CardContent className="p-2 sm:p-4">
          {loading ? (
            <p className="text-sm text-slate-400 text-center py-8">Cargando partes...</p>
          ) : partesFiltrados.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8" data-testid="no-partes-accesibles">
              {partes.length === 0
                ? isAdmin
                  ? "Todavía no hay ningún parte de trabajo."
                  : "Todavía no participas en ningún parte de trabajo."
                : "No hay partes que coincidan con la búsqueda."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {partesFiltrados.map((wo) => {
                const b = ESTADOS[wo.estado] || ESTADOS.abierto;
                return (
                  <FilaDeslizable
                    key={wo.id}
                    abierta={filaAbierta === wo.id}
                    onAbrirFila={() => setFilaAbierta(wo.id)}
                    onCerrarFila={() => setFilaAbierta(null)}
                    acciones={accionesDe(wo)}
                  >
                  <button
                    type="button"
                    onClick={() => navigate(`/work-orders/${wo.id}`)}
                    className="w-full flex items-center gap-3 py-3 px-2 text-left hover:bg-slate-50 transition-colors rounded"
                    data-testid={`parte-accesible-${wo.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-900 text-sm truncate max-w-xs">
                          {wo.titulo || wo.numero || "Parte sin título"}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded ${b.cls}`}>{b.txt}</span>
                      </div>
                      {wo.numero && wo.titulo && (
                        <p className="text-xs text-slate-400 mt-0.5">{wo.numero}</p>
                      )}
                      {wo.client_nombre && (
                        <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
                          <Building2 className="w-3 h-3 shrink-0" />
                          {wo.client_nombre}
                        </p>
                      )}
                      {wo.centro_nombre && (
                        <p className="text-xs text-indigo-600 mt-0.5 flex items-center gap-1">
                          <MapPin className="w-3 h-3 shrink-0" />
                          {wo.centro_nombre}
                        </p>
                      )}
                      {wo.creado_en && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          Creado {new Date(wo.creado_en).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-300 shrink-0" />
                  </button>
                  </FilaDeslizable>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!aBorrar} onOpenChange={(o) => !o && setABorrar(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar este parte?</AlertDialogTitle>
            <AlertDialogDescription>
              «{aBorrar?.titulo || aBorrar?.numero}». Solo se pueden borrar partes abiertos y sin sesiones
              registradas. No se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={borrar} disabled={trabajando} className="bg-red-600 hover:bg-red-700">
              Sí, borrar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default WorkOrdersListPage;
