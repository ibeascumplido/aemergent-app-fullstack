# Logos de clientes

Cada logo debe llamarse igual que el `id` del cliente y ser un **PNG** (con fondo transparente idealmente).

Los ids actuales son:

- `sanitas.png`
- `leroy-merlin.png`
- `ikea.png`
- `iberdrola.png`
- `style-outlet.png`
- `clarins.png`
- `galp.png`

## Consejos

- Tamaño recomendado: **256×256** (o cualquier proporción cuadrada), la app lo redimensiona con `object-contain`.
- Formato: **PNG con transparencia** para que el fondo blanco de la cabecera funcione.
- Si no existe el archivo, la ficha muestra automáticamente un icono `Building2` sobre un color estable.

Cuando en la Entrega 2 pasemos los clientes al backend, este directorio dejará de usarse: los logos se guardarán en S3 o en MongoDB.
