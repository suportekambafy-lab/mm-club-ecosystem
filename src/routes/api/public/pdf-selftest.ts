import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pdf-selftest")({
  server: {
    handlers: {
      GET: async () => {
        const { PDFDocument, StandardFonts } = await import("pdf-lib");
        const doc = await PDFDocument.create();
        const page = doc.addPage([200, 100]);
        const font = await doc.embedFont(StandardFonts.Helvetica);
        page.drawText("ok", { x: 10, y: 40, size: 12, font });
        const bytes = await doc.save();
        return new Response(JSON.stringify({ ok: true, size: bytes.length }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
