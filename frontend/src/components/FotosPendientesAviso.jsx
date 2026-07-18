import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { Camera, ChevronRight } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Aviso ligero para el dashboard del admin (Fase 8 parte 3): solo pide el
 * contador, no las fotos en si, para no recargar la pantalla de Inicio.
 * El listado completo con miniaturas vive en /fotos-por-clasificar.
 */
const FotosPendientesAviso = () => {
  const [count, setCount] = useState(null);

  useEffect(() => {
    axios
      .get(`${API}/fotos`, { params: { solo_sin_clasificar: true } })
      .then((res) => setCount(res.data.length))
      .catch(() => setCount(null));
  }, []);

  if (!count) return null;

  return (
    <Link
      to="/fotos-por-clasificar"
      className="mb-8 flex items-center justify-between gap-3 px-4 py-3 rounded-xl border border-amber-200 bg-amber-50 hover:bg-amber-100 transition-colors"
      data-testid="aviso-fotos-pendientes"
    >
      <div className="flex items-center gap-3">
        <Camera className="w-5 h-5 text-amber-600 shrink-0" />
        <span className="font-medium text-amber-900">
          {count} {count === 1 ? "foto" : "fotos"} por clasificar
        </span>
      </div>
      <ChevronRight className="w-5 h-5 text-amber-600 shrink-0" />
    </Link>
  );
};

export default FotosPendientesAviso;
