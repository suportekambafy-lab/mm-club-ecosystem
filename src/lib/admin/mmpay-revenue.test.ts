import { describe, expect, it } from 'vitest';
import { mmpayRevenueRows, type MmpayRevenuePayment } from './mmpay-revenue';
const payment: MmpayRevenuePayment = { id: 'p1', link_id: 'l1', email: 'buyer@example.test', name: 'Buyer', status: 'paid', amount_cents: 19700, currency: 'EUR', payment_method: 'card', paid_at: '2026-10-28T22:00:00Z', created_at: '2026-10-28T21:59:00Z' };
describe('MMpay revenue', () => {
  it('includes the paid 197 euro link sale, not unpaid orders', () => {
    const rows = mmpayRevenueRows([payment, { ...payment, id: 'pending', status: 'pending' }], [], [], [{ id: 'l1', title: 'Adesão ao MM Club' }]);
    expect(rows.reduce((sum, r) => sum + r.amount_cents, 0)).toBe(19700);
    expect(rows[0]?.product_title).toBe('Adesão ao MM Club');
  });
  it('counts the initial payment once and includes subsequent paid installments only', () => {
    const charge = { id: 'c1', subscription_id: 's1', cycle_number: 1, status: 'paid', amount_cents: 19700, finished_at: payment.paid_at, created_at: payment.created_at };
    const rows = mmpayRevenueRows([payment], [charge, { ...charge, id: 'c2', cycle_number: 2 }, { ...charge, id: 'c3', cycle_number: 3, status: 'failed' }], [{ id: 's1', customer_email: 'buyer@example.test', customer_name: 'Buyer', product_title: 'Mentoria', currency: 'EUR' }], []);
    expect(rows).toHaveLength(2);
    expect(rows.reduce((sum, r) => sum + r.amount_cents, 0)).toBe(39400);
  });
  it('does not sum other currencies into euro revenue', () => {
    expect(mmpayRevenueRows([{ ...payment, currency: 'USD' }], [], [], [])).toHaveLength(0);
  });
});