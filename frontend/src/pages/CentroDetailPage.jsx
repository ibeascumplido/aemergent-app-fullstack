import { useEffect, useState, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import {
  Building2,
  MapPin,
  ChevronLeft,
  FileText,
  AlertTriangle,
  ClipboardList,
  Camera,
  BookOpen,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import GaleriaFotos from "@/components/GaleriaFotos";
import IncidenciasCliente from "@/components/IncidenciasCliente";
import GuiaTrabajo from "@/components/GuiaTrabajo";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const ESTADO_PARTE_PILL = {
  abierto: "bg-amber-50 text-amber-700 border-amber-200",
  cerrado: "bg-slate-100 text-slate-500 border-slate-200",
};

const CentroDetailPage = () => {
  const { centroId } = useParams();
  const navigate = useNavigate();

  const [centro, setCentro] = useState(null);
  const [cliente, setCliente] = useState(null);
  const [loading, setLoading] = useState(true);

  const [presupuestos, setPresupuestos] = useState([]);
  const [partes, setPartes] = useState([]);

  const cargar = useCallback(async () => {
    setLoading(true);
    try {
      const centroRes = await axios.get(`${API}/centros/${centroId}`);
      setCentro(centroRes.data);

      // Cliente (para la cabecera y el enlace de vuelta)
      const clientId = centroRes.data.client_id;
      const clientSlug = centroRes.data.client_slug;

      const [presRes, partesRes, cliRes] = await Promise.all([
        axios.get(`${API}/budget-templates`, { params: { client_id: clientId, centro_id: centroId } }).catch(() => ({ data: [] })),
        axios.get(`${API}/work-orders`, { params: { client_id: clientId, centro_id: centroId } }).catch(() => ({ data: [] })),
        clientSlug ? axios.get(`${API}/clients/${clientSlug}`).catch(() => ({ data: null })) : Promise.resolve({ data: null }),
      ]);
      setPresupuestos(presRes.data || []);
      setPartes(partesRes.data || []);
      setCliente(cliRes.data);
    } catch (err) {
      console.error("Error cargando centro:", err);
      toast.error("No se pudo cargar el centro");
    } finally {
      setLoading(false);
    }
  }, [centroId]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (!centro) {
    return (
      <div className="p-8 text-center">
        <p className="text-slate-400 mb-3">Centro no encontrado.</p>
        <Button variant="outline" onClick={() => navigate(-1)}>Volver</Button>
      </div>
    );
  }

  return (
    <div data-testid="centro-detail-page">
      {/* Cabecera */}
      <div className="mb-6">
        {cliente && (
          <Link
            to={`/clients/${cliente.slug}`}
            className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 mb-3"
          >
            <ChevronLeft className="w-4 h-4" />
            {cliente.nombre}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center">
            <Building2 className="w-6 h-6 text-indigo-500" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight font-['Manrope']">
              {centro.nombre}
            </h1>
            {centro.direccion && (
              <p className="text-sm text-slate-500 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {centro.direccion}
              </p>
            )}
            {centro.contacto && (
              <p className="text-sm text-slate-400">{centro.contacto}</p>
            )}
          </div>
        </div>

        {centro.maps_url && (
          <a
            href={centro.maps_url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 mt-3 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors"
            data-testid="ver-ubicacion-btn"
          >
            <MapPin className="w-4 h-4" />
            Ver ubicación en Google Maps
          </a>
        )}
      </div>

      <Tabs defaultValue="presupuestos" className="w-full">
        <div className="overflow-x-auto -mx-1 px-1 mb-6 pb-1">
          <TabsList className="inline-flex w-max h-auto p-1 gap-0.5">
            <TabsTrigger value="presupuestos" className="gap-1.5" data-testid="tab-c-presupuestos">
              <FileText className="w-3.5 h-3.5" /> Presupuestos
            </TabsTrigger>
            <TabsTrigger value="incidencias" className="gap-1.5" data-testid="tab-c-incidencias">
              <AlertTriangle className="w-3.5 h-3.5" /> Incidencias
            </TabsTrigger>
            <TabsTrigger value="partes" className="gap-1.5" data-testid="tab-c-partes">
              <ClipboardList className="w-3.5 h-3.5" /> Partes
            </TabsTrigger>
            <TabsTrigger value="fotos" className="gap-1.5" data-testid="tab-c-fotos">
              <Camera className="w-3.5 h-3.5" /> Fotos
            </TabsTrigger>
            <TabsTrigger value="guia" className="gap-1.5" data-testid="tab-c-guia">
              <BookOpen className="w-3.5 h-3.5" /> Guía de trabajo
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Presupuestos */}
        <TabsContent value="presupuestos" className="mt-0">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              {presupuestos.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No hay presupuestos de este centro.
                </p>
              ) : (
                <div className="space-y-2">
                  {presupuestos.map((p) => (
                    <Link
                      key={p.id}
                      to={`/budgets/${p.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-slate-50 transition-colors"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{p.budget_number}</p>
                        <p className="text-sm text-slate-500">
                          {p.titulo || p.servicios_descripcion || "Sin título"}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Incidencias */}
        <TabsContent value="incidencias" className="mt-0">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <IncidenciasCliente clientId={centro.client_id} centroId={centroId} />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Partes */}
        <TabsContent value="partes" className="mt-0">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              {partes.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-6">
                  No hay partes de trabajo de este centro.
                </p>
              ) : (
                <div className="space-y-2">
                  {partes.map((pt) => (
                    <Link
                      key={pt.id}
                      to={`/work-orders/${pt.id}`}
                      className="flex items-center justify-between rounded-lg border border-slate-100 p-3 hover:border-indigo-200 hover:bg-slate-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 truncate">
                          {pt.titulo || "Parte de trabajo"}
                        </p>
                        <p className="text-xs text-slate-400">
                          {pt.fecha ? new Date(pt.fecha + "T00:00:00").toLocaleDateString("es-ES") : ""}
                        </p>
                      </div>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full border shrink-0 ${
                          ESTADO_PARTE_PILL[pt.estado] || ESTADO_PARTE_PILL.cerrado
                        }`}
                      >
                        {pt.estado === "abierto" ? "Abierto" : "Cerrado"}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Fotos */}
        <TabsContent value="fotos" className="mt-0">
          <GaleriaFotos clientId={centro.client_id} centroId={centroId} titulo="Fotografías" />
        </TabsContent>

        <TabsContent value="guia" className="mt-0">
          <Card className="border-slate-100 shadow-sm">
            <CardContent className="p-6">
              <GuiaTrabajo centroId={centroId} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default CentroDetailPage;
