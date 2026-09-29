import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type PricingTier = {
  id: string;
  name: string;
  rates: PricingRates;
  is_default: boolean;
  created_at: string;
};

export type PricingRates = {
  tiers: { qty: number; price: number }[];
  extra_per_photo: number;
  free_photos: number;
};

export type SessionStatus = 'pending' | 'active' | 'completed';

export type Session = {
  id: string;
  code: string;
  pricing_tier_id: string | null;
  status: SessionStatus;
  created_at: string;
  pricing_tiers?: PricingTier;
};

export type Photo = {
  id: string;
  session_id: string;
  filename: string;
  vignette_url: string | null;
  hd_ready: boolean;
  created_at: string;
};

export type PaymentStatus = 'pending' | 'paid';
export type DeliveryStatus = 'awaiting_hd' | 'ready' | 'delivered';

export type Order = {
  id: string;
  session_id: string;
  customer_email: string;
  selected_photos: string[];
  amount: number;
  payment_status: PaymentStatus;
  delivery_status: DeliveryStatus;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  sessions?: { code: string };
};

export function computePrice(rates: PricingRates, count: number): number {
  if (count <= 0) return 0;
  const free = rates.free_photos || 0;
  if (free > 0 && count <= free) return 0;
  const billable = count - free;
  if (billable <= 0) return 0;
  let best = { qty: 0, price: 0 };
  for (const tier of rates.tiers) {
    if (billable >= tier.qty && tier.qty > best.qty) best = tier;
  }
  if (best.qty > 0 && billable <= best.qty) return best.price;
  if (best.qty > 0 && billable > best.qty) {
    return best.price + (billable - best.qty) * rates.extra_per_photo;
  }
  return billable * rates.extra_per_photo;
}

export function generateSessionCode(): string {
  const num = Math.floor(1000 + Math.random() * 9000);
  return `DS-${num}`;
}
