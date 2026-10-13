// Migração Mollie → Paddle: quantos dias já pagos o membro ainda tem.
// 0 = cobra já (período terminado ou quase). Usado como trial no Paddle para
// que a primeira cobrança caia no fim do período já pago.
//
// Quem está em dívida também verifica o cartão com 0 € no checkout: usamos
// um trial de 1 dia, e o Paddle cobra automaticamente no dia seguinte.
export const MIGRATION_DEBT_VERIFY_DAYS = 1;
export function migrationPrepaidDays(periodEnd: string | null, now = Date.now()): number {
  if (!periodEnd) return 0;
  const ms = new Date(periodEnd).getTime() - now;
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  const days = Math.floor(ms / 86_400_000);
  return days >= 1 ? Math.min(days, 365) : 0;
}
