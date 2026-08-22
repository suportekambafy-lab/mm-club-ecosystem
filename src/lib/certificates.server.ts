/**
 * Render do certificado de conclusão em PDF (A4 landscape), no estilo
 * editorial do MM Club (preto + dourado).
 */
export async function renderCertificatePdf(cert: {
  code: string;
  course_title: string;
  member_name: string;
  hours: number;
  issued_at: string;
}): Promise<Uint8Array> {
  const { PDFDocument, StandardFonts, rgb } = await import("pdf-lib");

  const pdf = await PDFDocument.create();
  const page = pdf.addPage([842, 595]);
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const signatureFont = await pdf.embedFont(StandardFonts.TimesRomanItalic);

  const gold = rgb(0.788, 0.663, 0.38);
  const ink = rgb(0.98, 0.98, 0.99);
  const muted = rgb(0.68, 0.68, 0.72);

  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: rgb(0.04, 0.04, 0.05) });
  page.drawRectangle({
    x: 28,
    y: 28,
    width: 786,
    height: 539,
    borderColor: gold,
    borderWidth: 1.2,
  });

  const center = (text: string, y: number, size: number, font = regular, color = ink) => {
    const width = font.widthOfTextAtSize(text, size);
    page.drawText(text, { x: (842 - width) / 2, y, size, font, color });
  };

  // Logotipo oficial MM Club no topo (fallback para wordmark em texto)
  let logoDrawn = false;
  try {
    const icon = await import("@/assets/mm-icon.png.asset.json");
    const pointer = icon as unknown as { url?: string; default?: { url: string } };
    const url = `https://mmclub.online${pointer.default?.url ?? pointer.url}`;
    const res = await fetch(url);
    if (res.ok) {
      const png = await pdf.embedPng(new Uint8Array(await res.arrayBuffer()));
      const height = 58;
      const width = (png.width / png.height) * height;
      page.drawImage(png, { x: (842 - width) / 2, y: 476, width, height });
      logoDrawn = true;
    }
  } catch {
    /* fallback abaixo */
  }
  if (!logoDrawn) center("MM CLUB", 496, 12, bold, gold);


  center("CERTIFICADO DE CONCLUSÃO", 452, 10, regular, muted);

  center(cert.member_name, 396, 34, bold, ink);
  center("concluiu com êxito o programa", 360, 12, regular, muted);

  const title = cert.course_title.length > 62 ? `${cert.course_title.slice(0, 59)}…` : cert.course_title;
  center(title, 316, 22, bold, gold);

  const issued = new Date(cert.issued_at);
  const dateStr = new Intl.DateTimeFormat("pt-PT", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(issued);

  const hours = Number(cert.hours ?? 0);
  const hoursStr = hours > 0 ? `${hours.toFixed(hours % 1 === 0 ? 0 : 1)}h de formação` : "Formação completa";
  center(`${hoursStr}  ·  Emitido a ${dateStr}`, 276, 11, regular, muted);

  page.drawText("Victor Muabi", { x: 140, y: 188, size: 22, font: signatureFont, color: ink });
  page.drawLine({ start: { x: 120, y: 176 }, end: { x: 340, y: 176 }, color: gold, thickness: 0.8 });
  page.drawText("CEO MM Club", { x: 120, y: 158, size: 10, font: regular, color: muted });

  page.drawText(`Código: ${cert.code}`, { x: 502, y: 158, size: 10, font: bold, color: ink });
  page.drawText("Verifica em mmclub.online/certificado/" + cert.code, {
    x: 502,
    y: 144,
    size: 8,
    font: regular,
    color: muted,
  });

  return pdf.save();
}
