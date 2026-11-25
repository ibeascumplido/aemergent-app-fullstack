import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import FestivosDialog from "@/components/FestivosDialog";
import SaldosVacacionesDialog from "@/components/SaldosVacacionesDialog";
import { Users, MapPin, Palmtree, CalendarRange, History } from "lucide-react";
import { Button } from "@/components/ui/button";

const DESTINOS = {
  planificacion: { to: "/planificacion", label: "Planificación de operarios", Icon: Users },
  galp: { to: "/clients/galp/locations/calendar", label: "Calendario GALP", Icon: MapPin },
  vacaciones: { to: "/calendar", label: "Calendario de vacaciones", Icon: Palmtree },
};

// Accesos entre las tres pantallas hermanas; oculta la actual.
const NavPlanificacion = ({ actual }) => {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const [festivosOpen, setFestivosOpen] = useState(false);
  const [saldosOpen, setSaldosOpen] = useState(false);
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
      {isAdmin && (
        <>
          <Button size="sm" className="bg-red-500 hover:bg-red-600" onClick={() => setFestivosOpen(true)} data-testid="calendario-laboral-btn">
            <CalendarRange className="w-4 h-4 mr-2" />
            Calendario laboral 2027
          </Button>
          <Button size="sm" variant="outline" className="border-slate-200" onClick={() => setSaldosOpen(true)} data-testid="saldos-vacaciones-btn">
            <History className="w-4 h-4 mr-2" />
            Saldos y arrastre
          </Button>
          <SaldosVacacionesDialog open={saldosOpen} onOpenChange={setSaldosOpen} />
          <FestivosDialog open={festivosOpen} onOpenChange={setFestivosOpen} year={2027} />
        </>
      )}
    </div>
  );
};

export default NavPlanificacion;
