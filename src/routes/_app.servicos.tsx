import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Store, Clock, UserRound, ArrowRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/_app/servicos")({
  head: () => ({
    meta: [
      { title: "Serviços individuais — MM Club" },
      { name: "description", content: "Loja pronta, consultoria de 1h e mentoria individual com a equipa MM Club." },
      { property: "og:title", content: "Serviços individuais — MM Club" },
      { property: "og:description", content: "Loja pronta, consultoria de 1h e mentoria individual." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ServicosPage,
});

type ServiceKey = "loja_pronta" | "consultoria_1h" | "mentoria_individual";
const services: { key: ServiceKey; title: string; icon: typeof Store; desc: string; points: string[] }[] = [
  { key: "loja_pronta", title: "Loja pronta", icon: Store, desc: "A nossa equipa monta a tua loja online completa, pronta a vender, com a identidade da tua marca.", points: ["Design e estrutura da loja", "Produtos e páginas configurados", "Pronta para receber pagamentos"] },
  { key: "consultoria_1h", title: "Consultoria de 1h", icon: Clock, desc: "Uma sessão individual de 1 hora para analisar o teu negócio e sair com um plano de ação claro.", points: ["Análise do teu caso", "Respostas às tuas dúvidas", "Próximos passos definidos"] },
  { key: "mentoria_individual", title: "Mentoria individual", icon: UserRound, desc: "Acompanhamento próximo e personalizado para acelerar os resultados da tua marca.", points: ["Sessões regulares 1 para 1", "Estratégia à medida", "Acompanhamento contínuo"] },
];

const schema = z.object({
  full_name: z.string().trim().min(2, "Indica o teu nome").max(120),
  email: z.string().trim().email("Email inválido").max(255),
  phone: z.string().trim().min(6, "Contacto inválido").max(40),
  message: z.string().trim().max(1000).optional(),
});

function ServicosPage() {
  const [open, setOpen] = useState<ServiceKey | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ full_name: "", email: "", phone: "", message: "" });
  const current = services.find((s) => s.key === open);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!open) return;
    const parsed = schema.safeParse(form);
    if (!parsed.success) { toast.error(parsed.error.issues[0]?.message ?? "Dados inválidos"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("service_applications").insert({
      service: open, user_id: u.user?.id, full_name: parsed.data.full_name, email: parsed.data.email,
      phone: parsed.data.phone, message: parsed.data.message || null,
    });
    setBusy(false);
    if (error) { toast.error("Não foi possível enviar. Tenta novamente."); return; }
    setDone(true);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="text-3xl font-semibold text-foreground">Serviços individuais</h1>
      <p className="mt-2 text-muted-foreground">Escolhe o programa, aplica e a nossa equipa entra em contacto contigo.</p>
      <div className="mt-8 grid gap-6 md:grid-cols-3">
        {services.map((s) => (
          <div key={s.key} className="flex flex-col rounded-3xl border border-border bg-card p-6 shadow-sm">
            <s.icon className="h-8 w-8 text-primary" />
            <h2 className="mt-4 text-xl font-semibold text-foreground">{s.title}</h2>
            <p className="mt-2 text-sm text-muted-foreground">{s.desc}</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              {s.points.map((p) => <li key={p} className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />{p}</li>)}
            </ul>
            <Button className="mt-6 rounded-full" onClick={() => { setDone(false); setOpen(s.key); }}>
              Aplicar <ArrowRight className="ml-1 h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{done ? "Aplicação enviada!" : `Aplicar — ${current?.title ?? ""}`}</DialogTitle>
            <DialogDescription>{done ? "Recebemos os teus dados. Aguarda: a nossa equipa vai contactar-te em breve." : "Deixa os teus dados e a equipa entra em contacto."}</DialogDescription>
          </DialogHeader>
          {done ? (
            <Button className="rounded-full" onClick={() => setOpen(null)}>Fechar</Button>
          ) : (
            <form onSubmit={submit} className="space-y-3">
              <Input placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
              <Input type="email" placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
              <Input placeholder="Contacto (telemóvel / WhatsApp)" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
              <Textarea placeholder="Conta-nos um pouco sobre ti (opcional)" value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              <Button type="submit" disabled={busy} className="w-full rounded-full">{busy ? "A enviar…" : "Enviar aplicação"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
