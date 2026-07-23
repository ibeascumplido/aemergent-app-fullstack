import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Toaster } from "@/components/ui/sonner";
import SignaturePad from "@/components/SignaturePad";
import { ClipboardList, Calendar, Clock, Users, CheckCircle2, Loader2 } from "lucide-react";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

/**
 * Pagina publica sin autenticacion (Fase 5A.3 parte 2). Se accede via
 * /firmar/:token con un token largo e impredecible - no requiere login.
 * Muestra el parte ya filtrado por los toggles de visibilidad de cada
 * sesion y permite al cliente firmar (o volver a firmar).
 */
const PublicSignPage = () => {
  const { token } = useParams();

  const [parte, setParte] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const [nombre, setNombre] = useState("");
  const [firma, setFirma] = useState(null);
  const [enviando, setEnviando] = useState(false);

  const cargar = async () => {
    try {
      const res = await axios.get(`${API}/public/firma/${token}`);
      setParte(res.data);
      setNombre(res.data.firma_cliente_nombre || "");
    } catch (err) {
      console.error("Error cargando parte publico:", err);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const yaFirmado = !!parte?.firma_cliente;
  // Fase 11: una vez firmado, solo se puede volver a firmar si un
  // operario/admin lo ha habilitado desde el propio parte - el cliente
  // ya NO tiene un boton de "firmar de nuevo" por su cuenta.
  const puedeFirmar = !yaFirmado || parte?.firma_habilitada_de_nuevo;

  const handleFirmar = async () => {
    if (!nombre.trim()) {
      toast.error("Escribe tu nombre");
      return;
    }
    if (!firma) {
      toast.error("Falta la firma");
      return;
    }
    setEnviando(true);
    try {
      await axios.post(`${API}/public/firma/${token}`, {
        nombre: nombre.trim(),
        firma,
      });
      toast.success("Firma registrada. Gracias.");
      setFirma(null);
      await cargar();
    } catch (err) {
      console.error("Error al firmar:", err);
      toast.error("No se pudo registrar la firma. Intentalo de nuevo.");
    } finally {
      setEnviando(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="w-6 h-6 text-slate-400 animate-spin" />
      </div>
    );
  }

  if (error || !parte) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <Card className="max-w-sm w-full border-slate-100">
          <CardContent className="p-8 text-center text-slate-500 text-sm">
            Este enlace no es valido. Ponte en contacto con quien te lo envio.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8 px-4">
      <Toaster position="top-right" />
      <div className="max-w-lg mx-auto space-y-4">
        <p className="text-center text-xs uppercase tracking-wider text-slate-400 font-medium">
          Inicia Gestion
        </p>

        <Card className="border-slate-100">
          <CardContent className="p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <ClipboardList className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg font-bold text-slate-900 truncate">{parte.titulo}</h1>
                <p className="text-sm text-slate-500 truncate">{parte.cliente_nombre}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {parte.sessions.length === 0 ? (
          <Card className="border-slate-100">
            <CardContent className="p-6 text-center text-slate-400 text-sm">
              Todavia no hay sesiones registradas en este parte.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {parte.sessions.map((s, i) => (
              <Card key={i} className="border-slate-100" data-testid={`sesion-publica-${i}`}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm flex-wrap">
                    <Calendar className="w-4 h-4 text-slate-400" />
                    <span className="font-medium text-slate-900">
                      {new Date(s.fecha).toLocaleDateString("es-ES", {
                        weekday: "short",
                        day: "numeric",
                        month: "long",
                      })}
                    </span>
                    {s.hora_inicio && (
                      <>
                        <Clock className="w-4 h-4 text-slate-400 ml-2" />
                        <span className="text-slate-700">
                          {s.hora_inicio} – {s.hora_fin}
                        </span>
                      </>
                    )}
                  </div>

                  {s.operarios?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <Users className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {s.operarios.map((n) => (
                        <span
                          key={n}
                          className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full"
                        >
                          {n}
                        </span>
                      ))}
                    </div>
                  )}

                  {s.tareas?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                      <ClipboardList className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                      {s.tareas.map((t) => (
                        <span
                          key={t}
                          className="text-xs bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {s.notas && (
                    <p className="text-sm text-slate-600 mt-2 whitespace-pre-wrap">{s.notas}</p>
                  )}

                  {s.firmante && (
                    <div className="flex items-center gap-1.5 mt-2 text-xs text-emerald-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Firmado por {s.firmante} (responsable de la jornada)
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <Card className="border-slate-100">
          <CardContent className="p-5 space-y-4">
            {!puedeFirmar ? (
              <>
                <div className="flex items-center gap-2 text-emerald-600 font-medium text-sm">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  Firmado por {parte.firma_cliente_nombre} el{" "}
                  {new Date(parte.firma_cliente_en).toLocaleString("es-ES")}
                </div>
                <SignaturePad value={parte.firma_cliente} onChange={() => {}} disabled />
                <p className="text-xs text-slate-400">
                  Si hace falta corregir la firma, pide al operario o administrador que
                  habilite una nueva desde el propio parte.
                </p>
              </>
            ) : (
              <>
                {yaFirmado && (
                  <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2">
                    Se ha habilitado una nueva firma para este parte, sustituyendo a la
                    anterior.
                  </p>
                )}
                <div className="space-y-1.5">
                  <Label htmlFor="nombre-firma">Tu nombre</Label>
                  <Input
                    id="nombre-firma"
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="Nombre y apellidos"
                    data-testid="nombre-firma-input"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Tu firma</Label>
                  <SignaturePad value={null} onChange={setFirma} />
                </div>
                <Button
                  onClick={handleFirmar}
                  disabled={enviando}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  data-testid="confirmar-firma-btn"
                >
                  {enviando ? "Enviando..." : "Firmar y confirmar"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default PublicSignPage;
