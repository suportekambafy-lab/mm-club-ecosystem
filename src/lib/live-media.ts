/**
 * Pure helpers shared by the live rooms (member, guest and the egress
 * recording template). Kept free of LiveKit/DOM so they can be unit tested.
 */

/** Traduz um erro de getUserMedia numa mensagem clara em português. */
export function cameraErrorMessage(error: unknown): string {
  const msg =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  if (/NotAllowedError|Permission/i.test(msg)) {
    return "Permissão de câmara bloqueada. Autoriza no ícone da barra de endereço e tenta de novo.";
  }
  if (/NotReadableError|TrackStartError|could not start/i.test(msg)) {
    return "A câmara está a ser usada por outra aplicação. Fecha-a e tenta de novo.";
  }
  if (/NotFoundError|DevicesNotFound|OverconstrainedError/i.test(msg)) {
    return "Não encontrámos nenhuma câmara disponível neste dispositivo.";
  }
  return "Não foi possível ligar a câmara. Tenta de novo.";
}

/** Traduz um erro de partilha de ecrã numa mensagem clara. */
export function screenShareErrorMessage(error: unknown): string | null {
  const msg =
    error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  // O utilizador fechou o seletor de janelas — não é um erro a mostrar.
  if (/NotAllowedError|Permission denied by system|AbortError/i.test(msg)) return null;
  if (/insufficient permissions|permissions|unauthorized/i.test(msg)) {
    return "Ainda não tens permissão para partilhar. Pede ao anfitrião para te colocar no palco.";
  }
  return "Não foi possível partilhar o ecrã. Tenta de novo.";
}

export interface StageTileLike {
  id: string;
  isScreen?: boolean;
  isHost?: boolean;
}

/**
 * Ordem estável do palco: partilha de ecrã, depois anfitriões, depois
 * alfabética por id. Nunca depende de quem está a falar — se dependesse, a
 * grelha saltava e o vídeo piscava (sobretudo na gravação).
 */
export function sortStageTiles<T extends StageTileLike>(tiles: T[]): T[] {
  const score = (t: StageTileLike) => (t.isScreen ? 8 : 0) + (t.isHost ? 4 : 0);
  return [...tiles].sort((a, b) => {
    const diff = score(b) - score(a);
    return diff !== 0 ? diff : a.id.localeCompare(b.id);
  });
}

/** Assinatura usada para evitar re-renders (e flicker) quando nada mudou. */
export function tilesSignature(
  tiles: Array<{ id: string; name?: string; trackId?: string | null }>,
): string {
  return tiles.map((t) => `${t.id}|${t.name ?? ""}|${t.trackId ?? "-"}`).join(";");
}

/** Iniciais para o avatar de fallback (máx. 2 letras). */
export function participantInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

/** Fit the entire shared display without cropping or stretching its text. */
export function screenContainRect(sourceWidth: number, sourceHeight: number, width: number, height: number) {
  if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) return null;
  const scale = Math.min(width / sourceWidth, height / sourceHeight);
  const drawWidth = sourceWidth * scale;
  const drawHeight = sourceHeight * scale;
  return { x: (width - drawWidth) / 2, y: (height - drawHeight) / 2, width: drawWidth, height: drawHeight };
}
