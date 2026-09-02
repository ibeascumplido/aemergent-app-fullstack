// Pinta un "punto de color" de usuario con una textura opcional encima
// (lunares, rayas, cuadros...). Se usa en planificación, calendarios y
// leyendas para poder distinguir dos usuarios de color parecido.
//
// La textura se dibuja con un patrón SVG en `background-image` sobre el
// color de fondo. Cada textura usa negro semitransparente para que se vea
// sobre cualquier color.

// Catálogo de texturas disponible (id + etiqueta para la UI).
export const TEXTURAS = [
  { id: "solido", label: "Liso" },
  { id: "lunares", label: "Lunares" },
  { id: "rayas", label: "Rayas diagonales" },
  { id: "rayas_horiz", label: "Rayas horizontales" },
  { id: "rayas_vert", label: "Rayas verticales" },
  { id: "cuadros", label: "Cuadros" },
  { id: "diagonal_inv", label: "Diagonal inversa" },
  { id: "puntos_grandes", label: "Topos grandes" },
];

// Devuelve el CSS background-image para una textura dada (o "" si es lisa).
export const patronTextura = (textura) => {
  const negro = "rgba(0,0,0,0.42)";
  switch (textura) {
    case "lunares":
      return `radial-gradient(${negro} 1.4px, transparent 1.5px)`;
    case "puntos_grandes":
      return `radial-gradient(${negro} 2.6px, transparent 2.7px)`;
    case "rayas":
      return `repeating-linear-gradient(45deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 5px)`;
    case "diagonal_inv":
      return `repeating-linear-gradient(-45deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 5px)`;
    case "rayas_horiz":
      return `repeating-linear-gradient(0deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 5px)`;
    case "rayas_vert":
      return `repeating-linear-gradient(90deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 5px)`;
    case "cuadros":
      return `repeating-linear-gradient(0deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 6px), repeating-linear-gradient(90deg, ${negro} 0, ${negro} 1.5px, transparent 1.5px, transparent 6px)`;
    default:
      return "";
  }
};

// Tamaño del patrón según textura (para que los lunares/topos no se corten).
const tamanoPatron = (textura) => {
  switch (textura) {
    case "lunares":
      return "6px 6px";
    case "puntos_grandes":
      return "10px 10px";
    default:
      return "auto";
  }
};

// Devuelve un objeto de estilo listo para aplicar a cualquier elemento
// (útil cuando no se puede meter un componente, p. ej. en un div existente).
export const estiloColorTextura = (color, textura) => {
  const base = { backgroundColor: color || "#3B82F6" };
  const patron = patronTextura(textura);
  if (!patron) return base;
  return {
    ...base,
    backgroundImage: patron,
    backgroundSize: tamanoPatron(textura),
  };
};

// Componente: un "chip" redondo (por defecto) con color + textura.
const FichaColor = ({ color, textura = "solido", className = "", style = {}, title, children }) => {
  return (
    <span
      className={className}
      style={{ ...estiloColorTextura(color, textura), ...style }}
      title={title}
    >
      {children}
    </span>
  );
};

export default FichaColor;
