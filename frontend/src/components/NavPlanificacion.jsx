import { useNavigate } from "react-router-dom";
import { Users, MapPin, Palmtree } from "lucide-react";
import { Button } from "@/components/ui/button";

const DESTINOS = {
  planificacion: { to: "/planificacion", label: "Planificación de operarios", Icon: Users },
  galp: { to: "/clients/galp/locations/calendar", label: "Calendario GALP", Icon: MapPin },
  vacaciones: { to: "/calendar", label: "Calendario de vacaciones", Icon: Palmtree },
};

// Accesos entre las tres pantallas hermanas; oculta la actual.
const NavPlanificacion = ({ actual }) => {
  const navigate = useNavigate();
  return (
    <div className="flex items-center gap-2 flex-wrap mb-4" data-testid="nav-planificacion">
      {Object.entries(DESTINOS)
        .filter(([k]) => k !== actual)
        .map(([k, d]) => (
          <Button key={k} variant="outline" size="sm" className="border-slate-200" onClick={() => navigate(d.to)}>
            <d.Icon className="w-4 h-4 mr-2" />
            {d.label}
          </Button>
        ))}
    </div>
  );
};

export default NavPlanificacion;
