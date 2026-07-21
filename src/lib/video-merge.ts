import { FFmpeg } from "@ffmpeg/ffmpeg";
import { fetchFile, toBlobURL } from "@ffmpeg/util";

let ffmpegInstance: FFmpeg | null = null;
let loadPromise: Promise<FFmpeg> | null = null;

async function getFFmpeg(onProgress?: (msg: string) => void) {
  if (ffmpegInstance) return ffmpegInstance;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    onProgress?.("A carregar motor de vídeo…");
    const ff = new FFmpeg();
    const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
    await ff.load({
      coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
      wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
    });
    ffmpegInstance = ff;
    return ff;
  })();
  return loadPromise;
}

/**
 * Merges multiple MP4 URLs into a single MP4 Blob using ffmpeg.wasm concat demuxer.
 * All inputs must share codec/resolution/fps — Gemini segments do.
 */
export async function mergeVideos(
  urls: string[],
  onProgress?: (msg: string, pct?: number) => void,
): Promise<Blob> {
  if (urls.length === 0) throw new Error("Sem segmentos");
  if (urls.length === 1) {
    onProgress?.("A obter…");
    const r = await fetch(urls[0]);
    return await r.blob();
  }
  const ff = await getFFmpeg((m) => onProgress?.(m));

  onProgress?.("A obter segmentos…");
  const names: string[] = [];
  for (let i = 0; i < urls.length; i++) {
    const name = `seg_${i}.mp4`;
    await ff.writeFile(name, await fetchFile(urls[i]));
    names.push(name);
    onProgress?.(`Segmento ${i + 1}/${urls.length} carregado`, ((i + 1) / (urls.length + 1)) * 100);
  }

  const listContent = names.map((n) => `file '${n}'`).join("\n");
  await ff.writeFile("list.txt", new TextEncoder().encode(listContent));

  onProgress?.("A juntar segmentos…", 90);
  // Stream copy — no re-encode. Fast and lossless.
  await ff.exec(["-f", "concat", "-safe", "0", "-i", "list.txt", "-c", "copy", "output.mp4"]);

  const data = await ff.readFile("output.mp4");
  onProgress?.("Pronto", 100);
  // Cleanup
  for (const n of names) {
    try { await ff.deleteFile(n); } catch { /* ignore */ }
  }
  try { await ff.deleteFile("list.txt"); } catch { /* ignore */ }
  try { await ff.deleteFile("output.mp4"); } catch { /* ignore */ }

  const arr = data instanceof Uint8Array ? data : new Uint8Array(data as ArrayBuffer);
  return new Blob([arr.buffer as ArrayBuffer], { type: "video/mp4" });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
}
