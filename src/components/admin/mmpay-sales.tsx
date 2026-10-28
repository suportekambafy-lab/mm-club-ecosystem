import type { FinanceOverview } from '@/lib/admin/finance-types';
import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { dt, money, Panel } from './finance-ui';

export function MmpaySales({ data }: { data: FinanceOverview }) {
  const [type, setType] = useState('one_time');
  const sales = data.mmpay.sales.filter(s => s.saleType === type);
  const count = (value: string) => data.mmpay.sales.filter(s => s.saleType === value).length;
  return <Panel title={`Vendas MMpay · ${data.period.label}`}>
    <Tabs value={type} onValueChange={setType} className="mb-4">
      <TabsList className="h-auto flex-wrap justify-start">
        <TabsTrigger value="one_time">Avulsas · {count('one_time')}</TabsTrigger>
        <TabsTrigger value="subscription">Assinaturas · {count('subscription')}</TabsTrigger>
      </TabsList>
    </Tabs>
    <div className="mb-4 flex flex-wrap items-baseline gap-3">
      <strong className="text-2xl tabular-nums text-primary">{money(sales.reduce((sum, s) => sum + s.cents, 0))}</strong>
      <span className="text-sm text-muted-foreground">{sales.length} pagamento(s) confirmado(s) · {type === 'subscription' ? 'assinaturas' : 'vendas avulsas'}</span>
    </div>
    {!sales.length ? <p className="text-sm text-muted-foreground">Sem {type === 'subscription' ? 'vendas de assinatura' : 'vendas avulsas'} MMpay neste período.</p> :
      <div className="max-h-[32rem] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-xs text-muted-foreground"><tr>
            <th className="p-3">Cliente</th><th className="p-3">Produto</th><th className="p-3">Pagamento</th><th className="p-3">Acesso MM Club</th><th className="p-3 text-right">Valor</th>
          </tr></thead>
          <tbody>{sales.map(s => <tr key={s.id} className="border-t border-border">
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