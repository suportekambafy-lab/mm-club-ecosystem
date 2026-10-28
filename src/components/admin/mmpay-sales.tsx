import type { FinanceOverview } from '@/lib/admin/finance-types';
import { dt, money, Panel } from './finance-ui';

export function MmpaySales({ data }: { data: FinanceOverview }) {
  return <Panel title={`Vendas MMpay · ${data.period.label}`}>
    <div className="mb-4 flex flex-wrap items-baseline gap-3">
      <strong className="text-2xl tabular-nums text-primary">{money(data.mmpay.cents)}</strong>
      <span className="text-sm text-muted-foreground">{data.mmpay.count} pagamento(s) confirmado(s)</span>
    </div>
    {!data.mmpay.sales.length ? <p className="text-sm text-muted-foreground">Sem vendas MMpay neste período.</p> :
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr>
            <th className="p-3">Cliente</th><th className="p-3">Produto</th><th className="p-3">Pagamento</th><th className="p-3">Acesso MM Club</th><th className="p-3 text-right">Valor</th>
          </tr></thead>
          <tbody>{data.mmpay.sales.map(s => <tr key={s.id} className="border-t border-border">
            <td className="p-3"><div className="font-medium">{s.name ?? 'Cliente'}</div><div className="text-xs text-muted-foreground">{s.email}</div></td>
            <td className="p-3">{s.product}{s.recurringCharge && <div className="text-xs text-muted-foreground">Prestação automática</div>}</td>
            <td className="whitespace-nowrap p-3">{dt(s.at)}</td>
            <td className="p-3">{s.recurringCharge ? 'Associado ao pagamento inicial' : s.accessActive ? <><span className="text-primary">Ativo · 6 meses</span><div className="text-xs text-muted-foreground">Até {dt(s.accessUntil)}</div></> : s.accessUntil ? 'Acesso terminado / revogado' : 'Sem acesso automático'}</td>
            <td className="whitespace-nowrap p-3 text-right font-medium tabular-nums">{money(s.cents)}</td>
          </tr>)}</tbody>
        </table>
      </div>}
  </Panel>;
}