import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";

const SERVICE: Record<string, string> = { loja_pronta: "Loja pronta", consultoria_1h: "Consultoria de 1h", mentoria_individual: "Mentoria individual" };
const STATUS: Record<string, string> = { novo: "Novo", em_contacto: "Em contacto", concluido: "Concluído", descartado: "Descartado" };

export function ServiceRequestsView() {
  const qc = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["service-applications"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.from("service_applications").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });
  async function setStatus(id: string, status: string) {
    const { error } = await supabase.from("service_applications").update({ status }).eq("id", id);
    if (error) { toast.error("Não foi possível atualizar."); return; }
    toast.success("Estado atualizado");
    qc.invalidateQueries({ queryKey: ["service-applications"] });
  }
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">Serviços individuais</h1>
        <p className="text-sm text-muted-foreground">Pedidos de Loja pronta, Consultoria e Mentoria feitos pelos membros.</p>
      </div>
      {isLoading ? <p className="text-sm text-muted-foreground">A carregar…</p> : error ? <p className="text-sm text-destructive">Erro ao carregar os pedidos.</p> : !data?.length ? <p className="text-sm text-muted-foreground">Ainda não há pedidos.</p> : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground"><tr>{["Data", "Serviço", "Nome", "Email", "Contacto", "Mensagem", "Estado"].map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr></thead>
            <tbody>
              {data.map((r) => (
                <tr key={r.id} className="border-t border-border align-top">
                  <td className="whitespace-nowrap px-4 py-3">{new Date(r.created_at).toLocaleString("pt-PT", { timeZone: "Europe/Lisbon", dateStyle: "short", timeStyle: "short" })}</td>
                  <td className="px-4 py-3"><Badge variant="secondary">{SERVICE[r.service] ?? r.service}</Badge></td>
                  <td className="px-4 py-3 font-medium text-foreground">{r.full_name}</td>
                  <td className="px-4 py-3"><a className="text-primary hover:underline" href={`mailto:${r.email}`}>{r.email}</a></td>
                  <td className="whitespace-nowrap px-4 py-3"><a className="text-primary hover:underline" href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">{r.phone}</a></td>
                  <td className="max-w-xs px-4 py-3 text-muted-foreground">{r.message || "—"}</td>
                  <td className="px-4 py-3">
                    <select aria-label="Estado" className="rounded-md border border-input bg-background px-2 py-1" value={r.status} onChange={(e) => setStatus(r.id, e.target.value)}>
                      {Object.entries(STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
