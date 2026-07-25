import { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "sonner";
import { ArrowLeft, ChevronLeft, ChevronRight, CheckCircle, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import SignaturePad from "@/components/SignaturePad";
import { useAuth } from "@/contexts/AuthContext";

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const DocumentoFirmaPage = () => {
  const { docId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [documento, setDocumento] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pagina, setPagina] = useState(0);
  const [imagenUrl, setImagenUrl] = useState(null);
  const [cargandoImagen, setCargandoImagen] = useState(true);
  const [punto, setPunto] = useState(null); // { x_frac, y_frac }
  const [firma, setFirma] = useState(null);
  const [firmando, setFirmando] = useState(false);
  const imgRef = useRef(null);
  const objectUrlRef = useRef(null);

  const cargarDocumento = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/documentos-firma/${docId}`);
      setDocumento(res.data);
      if (res.data.firmado) {
        setPagina(res.data.firma_pagina || 0);
      }
    } catch (err) {
      console.error("Error cargando documento:", err);
      toast.error("No se pudo cargar el documento");
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    cargarDocumento();
  }, [cargarDocumento]);

  // La imagen de la pagina necesita el token de autenticacion (via el
  // interceptor de axios), asi que no se puede poner directamente en un
  // <img src>: se pide como blob y se convierte en un object URL local.
  useEffect(() => {
    if (!documento) return;
    let cancelado = false;
    setCargandoImagen(true);
    setPunto(null);
    axios
      .get(`${API}/documentos-firma/${docId}/pagina/${pagina}`, { responseType: "blob" })
      .then((res) => {
        if (cancelado) return;
        if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
        const url = URL.createObjectURL(res.data);
        objectUrlRef.current = url;
        setImagenUrl(url);
      })
      .catch((err) => {
        console.error("Error cargando página del PDF:", err);
        if (!cancelado) toast.error("No se pudo mostrar esta página");
      })
      .finally(() => {
        if (!cancelado) setCargandoImagen(false);
      });
    return () => {
      cancelado = true;
    };
  }, [documento, docId, pagina]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    };
  }, []);

  const tocarImagen = (e) => {
    if (documento?.firmado) return;
    const rect = imgRef.current.getBoundingClientRect();
    const x_frac = (e.clientX - rect.left) / rect.width;
    const y_frac = (e.clientY - rect.top) / rect.height;
    setPunto({ x_frac, y_frac });
  };

  const confirmarFirma = async () => {
    if (!punto) {
      toast.error("Toca en el documento el punto donde va la firma");
      return;
    }
    if (!firma) {
      toast.error("Dibuja tu firma");
      return;
    }
    setFirmando(true);
    try {
      await axios.post(`${API}/documentos-firma/${docId}/firmar`, {
        pagina,
        x_frac: punto.x_frac,
        y_frac: punto.y_frac,
        firma,
        nombre_firmante: user?.name || "",
      });
      toast.success("Documento firmado");
      navigate("/prevencion");
    } catch (err) {
      console.error("Error firmando documento:", err);
      toast.error(err?.response?.data?.detail || "No se pudo firmar el documento");
    } finally {
      setFirmando(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400">Cargando...</div>;
  }

  if (!documento) {
    return (
      <div>
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4" size="sm">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <Card className="border-slate-100">
          <CardContent className="p-8 text-center text-slate-500">
            No se encontró este documento.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div data-testid="documento-firma-page">
      <Button variant="ghost" onClick={() => navigate(-1)} className="mb-4 -ml-3" size="sm">
        <ArrowLeft className="w-4 h-4 mr-2" />
        Volver
      </Button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h1 className="text-xl font-bold text-slate-900 tracking-tight">{documento.nombre}</h1>
        {documento.firmado ? (
          <span className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full bg-green-50 text-green-700">
            <CheckCircle className="w-4 h-4" />
            Firmado por {documento.firmado_por_nombre}
          </span>
        ) : (
          <span className="text-sm text-slate-500">
            Toca en el documento donde quieres poner tu firma
          </span>
        )}
      </div>

      <Card className="border-slate-100 shadow-sm mb-4">
        <CardContent className="p-3">
          {documento.num_paginas > 1 && (
            <div className="flex items-center justify-between mb-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => Math.max(0, p - 1))}
                disabled={pagina === 0}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-slate-500">
                Página {pagina + 1} de {documento.num_paginas}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPagina((p) => Math.min(documento.num_paginas - 1, p + 1))}
                disabled={pagina === documento.num_paginas - 1}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          )}

          <div className="relative bg-slate-50 rounded-lg overflow-hidden flex items-center justify-center min-h-[300px]">
            {cargandoImagen ? (
              <p className="text-sm text-slate-400 py-16">Cargando página...</p>
            ) : (
              imagenUrl && (
                <div className="relative inline-block">
                  <img
                    ref={imgRef}
                    src={imagenUrl}
                    alt={`Página ${pagina + 1}`}
                    onClick={tocarImagen}
                    className={`max-w-full ${documento.firmado ? "" : "cursor-crosshair"}`}
                    data-testid="pagina-documento-img"
                  />
                  {punto && !documento.firmado && (
                    <div
                      className="absolute w-6 h-6 -ml-3 -mt-3 rounded-full bg-indigo-500/30 border-2 border-indigo-600 pointer-events-none flex items-center justify-center"
                      style={{ left: `${punto.x_frac * 100}%`, top: `${punto.y_frac * 100}%` }}
                      data-testid="marcador-firma"
                    >
                      <MapPin className="w-3.5 h-3.5 text-indigo-700" />
                    </div>
                  )}
                </div>
              )
            )}
          </div>
        </CardContent>
      </Card>

      {!documento.firmado && (
        <Card className="border-slate-100 shadow-sm">
          <CardContent className="p-4 space-y-3">
            <p className="text-sm font-medium text-slate-700">Tu firma</p>
            <SignaturePad value={firma} onChange={setFirma} />
            <Button
              onClick={confirmarFirma}
              disabled={firmando || !punto || !firma}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
              data-testid="confirmar-firma-documento-btn"
            >
              {firmando ? "Firmando..." : "Confirmar firma"}
            </Button>
            {!punto && (
              <p className="text-xs text-amber-600 text-center">
                Primero toca en el documento el punto donde va la firma.
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default DocumentoFirmaPage;
