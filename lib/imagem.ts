/**
 * Redimensiona no cliente antes de mandar para a IA (SPEC §2):
 * no máximo 1.600 px no maior lado, JPEG qualidade 0,8.
 * Foto de celular tem 4 MB; depois disso fica em ~200 KB.
 */
export const LADO_MAXIMO = 1600;
export const QUALIDADE = 0.8;

export async function prepararFoto(arquivo: File): Promise<string> {
  const bitmap = await criarBitmap(arquivo);

  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas indisponível");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  if ("close" in bitmap) bitmap.close();

  return canvas.toDataURL("image/jpeg", QUALIDADE);
}

async function criarBitmap(arquivo: File): Promise<ImageBitmap | HTMLImageElement> {
  if ("createImageBitmap" in window) {
    try {
      // imageOrientation cuida da foto tirada de lado.
      return await createImageBitmap(arquivo, { imageOrientation: "from-image" });
    } catch {
      // Safari antigo: cai no <img>.
    }
  }

  const url = URL.createObjectURL(arquivo);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
