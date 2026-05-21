'use client';

import { CreditCard, Lock, ShieldCheck } from 'lucide-react';
import Card from '@/components/common/Card';
import Button from '@/components/common/Button';
import Input from '@/components/common/Input';
import { formatCurrency } from '@/utils/formatters';

/**
 * PaymentPlaceholder — dummy payment card with disabled inputs.
 *
 * Props: { amount, onPay, processing }
 */
export default function PaymentPlaceholder({ amount, onPay, processing }) {
  return (
    <Card>
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          <CreditCard size={18} />
        </span>
        <div>
          <h3 className="text-sm font-semibold text-slate-800">
            Payment details
          </h3>
          <p className="text-xs text-slate-500">Secured checkout</p>
        </div>
      </div>

      <div className="mt-4 space-y-3">
        <Input
          label="Card number"
          name="card-number"
          placeholder="4242 4242 4242 4242"
          value=""
          onChange={() => {}}
          disabled
          readOnly
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Expiry"
            name="card-expiry"
            placeholder="MM / YY"
            value=""
            onChange={() => {}}
            disabled
            readOnly
          />
          <Input
            label="CVC"
            name="card-cvc"
            placeholder="123"
            value=""
            onChange={() => {}}
            disabled
            readOnly
          />
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4">
        <span className="text-sm font-medium text-slate-600">Amount due</span>
        <span className="text-lg font-bold text-slate-900">
          {formatCurrency(amount)}
        </span>
      </div>

      <Button
        variant="primary"
        size="lg"
        className="mt-4 w-full"
        onClick={onPay}
        disabled={processing}
      >
        <Lock size={16} />
        {processing ? 'Processing…' : `Pay ${formatCurrency(amount)}`}
      </Button>

      <p className="mt-3 flex items-start gap-1.5 text-xs text-slate-400">
        <ShieldCheck size={14} className="mt-0.5 shrink-0" />
        Payment gateway integration placeholder — no real charge is made.
      </p>
    </Card>
  );
}
