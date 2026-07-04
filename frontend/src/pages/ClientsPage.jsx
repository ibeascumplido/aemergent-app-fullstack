import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Building2, Search, ChevronRight, Image, FileText, AlertTriangle } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import axios from "axios";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// Color de avatar derivado del nombre (estable por cliente)
const COLORES = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899"];
const colorDe = (nombre) => {
  let h = 0;
  for (let i = 0; i < nombre.length; i++) h = nombre.charCodeAt(i) + ((h << 5) - h);
  return COLORES[Math.abs(h) % COLORES.length];
};

const ClientsPage = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [clientes, setClientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const res = await axios.get(`${API}/clients`);
        if (!cancelado) setClientes(res.data);
      } catch (err) {
        console.error("Error cargando clientes:", err);
      } finally {
        if (!cancelado) setLoading(false);
      }
    })();
    return () => { cancelado = true; };
  }, []);

  const filtrados = clientes.filter((c) =>
    c.nombre.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const abrirFicha = (cliente) => {
    // Navegamos por slug (id URL-friendly, estable, coincide con el modelo de backend).
    navigate(`/clients/${cliente.slug}`);
  };

  const container = {
    hidden: { opacity: 0 },
    show: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const item = { hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0 } };

  return (
    <div data-testid="clients-page">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 tracking-tight font-['Manrope']">
          Clientes
        </h1>
        <p className="text-slate-500 mt-1">
          {filtrados.length} {filtrados.length === 1 ? "cliente" : "clientes"} · cada ficha reunirá fotos, partes de trabajo e incidencias
        </p>
      </div>

      <div className="relative mb-6 max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Buscar cliente..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10 border-slate-200"
          data-testid="search-clients"
        />
      </div>

      {loading ? (
        <div className="p-8 text-center text-slate-400" data-testid="loading-clients">
          Cargando clientes...
        </div>
      ) : filtrados.length === 0 ? (
        <div className="p-8 text-center text-slate-400" data-testid="no-clients">
          {clientes.length === 0
            ? "No hay clientes disponibles"
            : "No hay clientes que coincidan con la búsqueda"}
        </div>
      ) : (
        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          {filtrados.map((c) => (
            <motion.div key={c.slug} variants={item}>
              <Card
                className="border-slate-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
                onClick={() => abrirFicha(c)}
                data-testid={`client-card-${c.slug}`}
              >
                <CardContent className="p-5">
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0 overflow-hidden"
                      style={{ backgroundColor: c.logo_url ? "#fff" : colorDe(c.nombre) }}
                    >
                      {c.logo_url ? (
                        <img src={c.logo_url} alt={c.nombre} className="w-full h-full object-contain" />
                      ) : (
                        <Building2 className="w-6 h-6" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 truncate">{c.nombre}</p>
                      <div className="flex items-center gap-3 mt-1 text-slate-400">
                        <Image className="w-4 h-4" />
                        <FileText className="w-4 h-4" />
                        <AlertTriangle className="w-4 h-4" />
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-slate-300 group-hover:text-slate-500 transition-colors" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      )}
    </div>
  );
};

export default ClientsPage;
