/** Keep multipart requests below Vercel's function request limit. */
export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const MAX_UPLOAD_PHOTOS = 8;

export async function readMenuPhotos(form: FormData): Promise<{ title: string; images: string[] }> {
  const files = form.getAll("photos");
  if (files.length === 0 || files.length > MAX_UPLOAD_PHOTOS) throw new Error("Choose 1–8 menu photos.");
  let total = 0;
  const images: string[] = [];
  for (const entry of files) {
    if (typeof entry === "string" || entry.size === 0) throw new Error("Choose a non-empty menu photo.");
    total += entry.size;
    if (total > MAX_UPLOAD_BYTES) throw new Error("Photos must total 3 MB or less. Try smaller photos or fewer pages.");
    const bytes = Buffer.from(await entry.arrayBuffer());
    const type = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff ? "image/jpeg"
      : bytes.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
    if (!type) throw new Error("Use JPG, PNG or WebP photos. Export HEIC photos as JPG first.");
    images.push(`data:${type};base64,${bytes.toString("base64")}`);
  }
  return { title: String(form.get("name") ?? "").trim().slice(0, 120) || "Uploaded restaurant menu", images };
}
