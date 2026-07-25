import { Component } from "react";

/**
 * Fase 12/15: hasta ahora, cualquier error de JavaScript durante el
 * renderizado (por ejemplo, un desajuste puntual entre una version
 * antigua del frontend en cache y el backend ya actualizado, o el
 * backend estando temporalmente caido) dejaba la pantalla completamente
 * en blanco, sin ningun mensaje. Este componente captura ese tipo de
 * error y ofrece dos salidas:
 *   - "Reintentar": reinicia el arbol de React SIN recargar la pagina
 *     (no hay ninguna navegacion de por medio, asi que no puede verse
 *     afectado por comportamientos raros de apps instaladas en el
 *     movil). Suele bastar si el problema era pasajero (ej. el backend
 *     tardando en responder).
 *   - "Recargar página": recarga la pagina entera, para los casos en
 *     los que hace falta descargar una version mas reciente del codigo.
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, info) {
    console.error("Error capturado por ErrorBoundary:", error, info);
  }

  reintentar = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: 24,
            textAlign: "center",
            fontFamily:
              "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
            backgroundColor: "#f8fafc",
          }}
        >
          <h1
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginBottom: 8,
              color: "#0f172a",
            }}
          >
            Algo ha ido mal
          </h1>
          <p style={{ color: "#64748b", marginBottom: 24, maxWidth: 320, lineHeight: 1.5 }}>
            Puede haber sido un problema pasajero de conexión, o que tengas
            guardada una versión antigua de la app.
          </p>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
            <button
              type="button"
              onClick={this.reintentar}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                backgroundColor: "#EF4444",
                color: "white",
                border: "none",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 24px",
                borderRadius: 8,
                backgroundColor: "white",
                color: "#334155",
                border: "1px solid #cbd5e1",
                fontWeight: 600,
                fontSize: 15,
                cursor: "pointer",
              }}
            >
              Recargar página
            </button>
          </div>
          <p style={{ color: "#94a3b8", marginTop: 20, maxWidth: 320, fontSize: 13, lineHeight: 1.5 }}>
            Si "Recargar página" tampoco funciona, cierra la app del todo
            (no solo minimizarla) y vuelve a abrirla.
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
