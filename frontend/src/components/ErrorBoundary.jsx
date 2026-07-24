import { Component } from "react";

/**
 * Fase 12: hasta ahora, cualquier error de JavaScript durante el
 * renderizado (por ejemplo, un desajuste puntual entre una version
 * antigua del frontend en cache y el backend ya actualizado - algo mas
 * probable en moviles con la app instalada en pantalla de inicio, donde
 * "abrir" la app a veces solo reanuda un proceso en segundo plano sin
 * descargar nada nuevo) dejaba la pantalla completamente en blanco, sin
 * ningun mensaje. Este componente captura ese tipo de error y ofrece un
 * mensaje claro con un boton para recargar, en vez de dejar al usuario
 * mirando una pantalla vacia sin saber que ha pasado.
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
          <p style={{ color: "#64748b", marginBottom: 20, maxWidth: 320, lineHeight: 1.5 }}>
            Puede que tengas guardada una versión antigua de la app. Prueba a
            recargar; si sigue igual, cierra la app del todo (no solo
            minimizarla) y vuelve a abrirla.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{
              padding: "10px 28px",
              borderRadius: 8,
              backgroundColor: "#EF4444",
              color: "white",
              border: "none",
              fontWeight: 600,
              fontSize: 15,
              cursor: "pointer",
            }}
          >
            Recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
