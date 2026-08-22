/**
 * Aviso do Código do Clube: mostra ao membro sancionado o motivo, o prazo, o
 * caminho correto (suporte) e permite apresentar um recurso com contexto e anexo.
 */
import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Gavel, LifeBuoy, Paperclip, Loader2, ShieldQuestion, X } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { pt } from "date-fns/locale";
import { useServerFn } from "@tanstack/react-start";
import { submitAppeal } from "@/lib/moderation-review.functions";

export type ActiveSanction = {
  id: string;
  kind: string;
  level: number;
  reason: string;
  rule: string | null;
  expires_at: string | null;
  permanent: boolean;
  appeal_status: string | null;
};

export function useActiveSanction() {
  return useQuery({
    queryKey: ["community", "sanction"],
    staleTime: 60_000,
    queryFn: async (): Promise<ActiveSanction | null> => {
      const { data, error } = await (supabase as any).rpc("my_community_sanction");
      if (error) return null;
      const row = Array.isArray(data) ? data[0] : data;
      return (row as ActiveSanction | undefined) ?? null;
    },
  });
}

const APPEAL_LABEL: Record<string, string> = {
  pending: "Recurso em análise pela equipa.",
  rejected: "O teu recurso foi analisado e recusado.",
  accepted: "Recurso aceite.",
};

export function SanctionBanner({ sanction }: { sanction: ActiveSanction }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const send = useServerFn(submitAppeal);

  const until = sanction.permanent
    ? null
    : sanction.expires_at
      ? formatDistanceToNow(new Date(sanction.expires_at), { locale: pt, addSuffix: true })
      : null;

  const appealState = sanction.appeal_status;
  const canAppeal = !appealState || appealState === "rejected";

  const mutation = useMutation({
    mutationFn: async () => {
      let attachmentUrl: string | null = null;
      if (file) {
        setUploading(true);
        const { data: auth } = await supabase.auth.getUser();
        const uid = auth.user?.id;
        const path = `recursos/${uid}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
        const { error } = await supabase.storage.from("community-media").upload(path, file, {
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });
        setUploading(false);
        if (error) throw new Error("Não foi possível carregar o anexo.");
        const { data: signed } = await supabase.storage
          .from("community-media")
          .createSignedUrl(path, 60 * 60 * 24 * 365);
        attachmentUrl = signed?.signedUrl ?? null;
      }
      return send({
        data: { sanctionId: sanction.id, message: message.trim(), attachmentUrl },
      });
    },
    onSuccess: () => {
      toast.success("Recurso enviado. A equipa vai analisar e serás notificado.");
      setOpen(false);
      setMessage("");
      setFile(null);
      void qc.invalidateQueries({ queryKey: ["community", "sanction"] });
    },
    onError: (err: any) => {
      setUploading(false);
      toast.error(err?.message ?? "Não foi possível enviar o recurso.");
    },
  });

  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-4">
      <div className="flex items-start gap-3">
        <Gavel className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1 space-y-2">
          <p className="font-display text-sm tracking-wide text-destructive">
            {sanction.permanent
              ? "Acesso à comunidade removido"
              : `Sem poder interagir na comunidade${until ? ` — reativa ${until}` : ""}`}
          </p>
          <p className="text-sm text-muted-foreground">{sanction.reason}</p>
          {sanction.rule ? (
            <p className="text-xs text-muted-foreground/80">Regra: {sanction.rule}</p>
          ) : null}

          {appealState ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-foreground/80">
              <ShieldQuestion className="h-3.5 w-3.5" />
              {APPEAL_LABEL[appealState] ?? "Recurso registado."}
            </p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-1">
            {canAppeal && (
              <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90"
              >
                {open ? <X className="h-3.5 w-3.5" /> : <ShieldQuestion className="h-3.5 w-3.5" />}
                {open ? "Cancelar" : "Contestar decisão"}
              </button>
            )}
            <Link
              to="/codigo"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              Ver Código do Clube
            </Link>
            <a
              href="mailto:suporte@mmclub.online"
              className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
            >
              <LifeBuoy className="h-3.5 w-3.5" /> Falar com o suporte
            </a>
          </div>

          {open && canAppeal && (
            <div className="space-y-2 rounded-xl border border-border bg-surface-1 p-3">
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="appeal-msg">
                Explica o contexto da tua publicação (mínimo 20 caracteres)
              </label>
              <textarea
                id="appeal-msg"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={2000}
                placeholder="O que aconteceu, qual era a intenção e por que consideras que a decisão foi incorreta."
                className="w-full resize-none rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-foreground/40"
              />
              <div className="flex flex-wrap items-center gap-2">
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium transition hover:bg-muted"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                  {file ? "Trocar anexo" : "Anexar prova (imagem ou PDF)"}
                </button>
                {file ? (
                  <span className="truncate text-xs text-muted-foreground">{file.name}</span>
                ) : null}
                <button
                  type="button"
                  disabled={message.trim().length < 20 || mutation.isPending || uploading}
                  onClick={() => mutation.mutate()}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background transition hover:opacity-90 disabled:opacity-50"
                >
                  {mutation.isPending || uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : null}
                  Enviar recurso
                </button>
              </div>
              <p className="text-[11px] text-muted-foreground/80">
                Só é possível ter um recurso em análise de cada vez. Pagamentos, faturas e acessos
                continuam a ser tratados apenas pelo suporte.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
