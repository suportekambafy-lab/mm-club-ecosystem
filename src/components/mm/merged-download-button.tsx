import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { mergeVideos, downloadBlob } from "@/lib/video-merge";

export function MergedDownloadButton({ urls, filename }: { urls: string[]; filename: string }) {
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string>("");

  async function onDownload() {
    if (busy) return;
    setBusy(true);
    setMsg("A preparar…");
    try {
      const blob = await mergeVideos(urls, (m) => setMsg(m));
      downloadBlob(blob, filename);
      setMsg("");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha ao juntar");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={onDownload}
        disabled={busy}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-secondary px-4 py-2.5 text-sm font-semibold text-background disabled:opacity-60"
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
        {busy ? "A juntar segmentos…" : `Descarregar MP4 (${urls.length} partes unidas)`}
      </button>
      {busy && msg && <p className="text-center text-[11px] text-muted-foreground">{msg}</p>}
    </div>
  );
}
