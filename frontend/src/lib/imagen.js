// Lee una imagen del móvil y la reduce (lado máx. 1600px, JPEG 0.8) antes de
// usarla. Las fotos originales del móvil pesan 5-12 MB; convertirlas a base64
// y pintarlas tal cual bloquea la app. Si algo falla, cae a la lectura simple.
const leerSimple = (file) =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });

export const comprimirImagen = async (file, maxLado = 1600, calidad = 0.8) => {
  try {
    if (!file.type.startsWith("image/") || file.type === "image/gif") {
      return await leerSimple(file);
    }
    const bitmap = await (typeof createImageBitmap === "function"
      ? createImageBitmap(file, { imageOrientation: "from-image" })
      : Promise.reject(new Error("sin createImageBitmap")));
    const escala = Math.min(1, maxLado / Math.max(bitmap.width, bitmap.height));
    const w = Math.max(1, Math.round(bitmap.width * escala));
    const h = Math.max(1, Math.round(bitmap.height * escala));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    canvas.getContext("2d").drawImage(bitmap, 0, 0, w, h);
    if (bitmap.close) bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", calidad);
    canvas.width = 0;
    canvas.height = 0;
    return dataUrl;
  } catch (err) {
    console.warn("No se pudo reducir la imagen, se usa el original:", err);
    return leerSimple(file);
  }
};
