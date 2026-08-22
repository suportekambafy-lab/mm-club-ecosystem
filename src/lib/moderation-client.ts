import { toast } from "sonner";
import { moderateContent } from "./moderation.functions";

type Kind =
  | "community_post"
  | "community_comment"
  | "community_chat"
  | "short"
  | "short_comment"
  | "live_chat";

/**
 * Envia o item recém-publicado ao agente de moderação (fire-and-forget).
 * Se for removido, avisa o autor e deixa o chamador refrescar a lista.
 */
export function runModeration(
  args: { kind: Kind; id: string },
  onRemoved?: () => void,
): void {
  moderateContent({ data: args })
    .then((res) => {
      if (res?.removed) {
        toast.error(
          res.reason
            ? `Removido pela moderação MM Club: ${res.reason}`
            : "Conteúdo removido pela moderação MM Club.",
        );
        onRemoved?.();
      }
    })
    .catch((e) => console.error("[moderation] failed", e));
}
