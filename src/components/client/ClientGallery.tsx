import { useState, useEffect, useMemo } from 'react';
import { supabase, computePrice, type Session, type Photo, type PricingTier } from '@/lib/supabase';
import { navigate } from '@/lib/router';
import { Button, Input } from '@/components/ui';
import {
  Aperture,
  Check,
  Mail,
  CreditCard,
  Loader2,
  ImageIcon,
  X,
  ArrowLeft,
} from 'lucide-react';

export function ClientGallery({ code }: { code: string }) {
  const [session, setSession] = useState<Session | null>(null);
  const [tier, setTier] = useState<PricingTier | null>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [email, setEmail] = useState('');
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const { data: sess, error: sessErr } = await supabase
        .from('sessions')
        .select('*, pricing_tiers(*)')
        .eq('code', code)
        .maybeSingle();

      if (sessErr || !sess) {
        setError('Session introuvable');
        setLoading(false);
        return;
      }

      const sessionData = sess as Session;
      setSession(sessionData);
      if (sessionData.pricing_tiers) setTier(sessionData.pricing_tiers);

      const { data: ph } = await supabase
        .from('photos')
        .select('*')
        .eq('session_id', sessionData.id)
        .order('created_at', { ascending: true });

      setPhotos((ph as Photo[]) || []);
      setLoading(false);
    }
    load();
  }, [code]);

  const selectedCount = selected.size;
  const totalPrice = useMemo(() => {
    if (!tier) return 0;
    return computePrice(tier.rates, selectedCount);
  }, [tier, selectedCount]);

  function togglePhoto(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function getVignetteUrl(photo: Photo): string {
    if (photo.vignette_url) return photo.vignette_url;
    const { data } = supabase.storage
      .from('vignettes')
      .getPublicUrl(`${code}/${photo.filename}`);
    return data.publicUrl;
  }

  async function handlePay() {
    if (!session || !tier || selectedCount === 0 || !email) return;
    setPaying(true);
    setPayError(null);

    try {
      // Create order
      const { data: order, error: orderErr } = await supabase
        .from('orders')
        .insert({
          session_id: session.id,
          customer_email: email,
          selected_photos: Array.from(selected),
          amount: totalPrice,
          payment_status: 'pending',
          delivery_status: 'awaiting_hd',
        })
        .select()
        .maybeSingle();

      if (orderErr || !order) {
        setPayError('Erreur lors de la création de la commande');
        setPaying(false);
        return;
      }

      // Call SumUp edge function
      const returnUrl = `${window.location.origin}/#/c/${order.id}`;
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/sumup-checkout`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId: order.id,
          amount: totalPrice,
          customerEmail: email,
          returnUrl,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setPayError(err.error || 'Erreur de paiement');
        setPaying(false);
        return;
      }

      const checkout = await res.json();

      // Send receipt email
      const emailUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      fetch(emailUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'receipt', orderId: order.id }),
      }).catch(() => {});

      // Redirect to SumUp checkout or confirmation
      if (checkout.hostedCheckoutUrl) {
        window.location.href = checkout.hostedCheckoutUrl;
      } else if (checkout.checkoutUrl) {
        window.location.href = checkout.checkoutUrl;
      } else {
        navigate(`/c/${order.id}`);
      }
    } catch {
      setPayError('Une erreur est survenue');
      setPaying(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b]">
        <Loader2 className="h-8 w-8 animate-spin text-[#6b6b75]" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] p-6 text-center">
        <Aperture className="mb-4 h-12 w-12 text-[#6b6b75]" />
        <p className="text-lg font-medium">{error}</p>
        <p className="mt-2 text-sm text-[#6b6b75]">Vérifiez le code de votre session</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#26262e] glass">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#f5f5f7]">
              <Aperture className="h-4 w-4 text-[#0a0a0b]" />
            </div>
            <div>
              <p className="text-sm font-bold leading-tight">Déclic Studio</p>
              <p className="font-mono text-xs text-[#6b6b75] leading-tight">{code}</p>
            </div>
          </div>
          {selectedCount > 0 && (
            <div className="rounded-lg bg-[#e8c547]/10 px-3 py-1.5 text-sm">
              <span className="font-bold text-[#e8c547]">{selectedCount}</span>
              <span className="text-[#9a9aa5]"> · {totalPrice.toFixed(2)} €</span>
              {tier && (tier.rates.free_photos || 0) > 0 && selectedCount <= (tier.rates.free_photos || 0) && (
                <span className="ml-1 text-[#34d399]">· offertes</span>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Hero */}
      {photos.length > 0 && (
        <div className="px-4 pt-6 pb-2">
          <h2 className="text-xl font-bold">Vos photos</h2>
          <p className="mt-1 text-sm text-[#9a9aa5]">
            Touchez une photo pour la sélectionner
            {tier && (tier.rates.free_photos || 0) > 0 && (
              <span className="block mt-0.5 text-[#34d399]">
                {tier.rates.free_photos} photo{(tier.rates.free_photos as number) > 1 ? 's' : ''} offerte{(tier.rates.free_photos as number) > 1 ? 's' : ''} !
              </span>
            )}
            {tier && tier.rates.tiers?.length > 0 && (
              <span className="block mt-1 text-[#6b6b75]">
                {tier.rates.tiers[0].qty} photo{tier.rates.tiers[0].qty > 1 ? 's' : ''} = {tier.rates.tiers[0].price}€
                {tier.rates.tiers.length > 1 && ` · ${tier.rates.tiers[1].qty} = ${tier.rates.tiers[1].price}€`}
              </span>
            )}
          </p>
        </div>
      )}

      {/* Photo grid */}
      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <ImageIcon className="mb-4 h-12 w-12 text-[#6b6b75]" />
          <p className="text-base font-medium text-[#9a9aa5]">Aucune photo pour le moment</p>
          <p className="mt-1 text-sm text-[#6b6b75]">Revenez plus tard, les photos arrivent bientôt</p>
        </div>
      ) : (
        <div className="columns-2 gap-1.5 p-4 sm:columns-3 md:columns-4 lg:columns-5 [&>*]:mb-1.5">
          {photos.map((photo) => {
            const url = getVignetteUrl(photo);
            const isSelected = selected.has(photo.id);
            const selectedIndex = Array.from(selected).indexOf(photo.id) + 1;
            return (
              <button
                key={photo.id}
                onClick={() => togglePhoto(photo.id)}
                onDoubleClick={() => setLightbox(url)}
                className={`relative block w-full overflow-hidden rounded-xl break-inside-avoid transition-smooth ${
                  isSelected ? 'ring-2 ring-[#e8c547] ring-offset-2 ring-offset-[#0a0a0b]' : ''
                }`}
              >
                <img
                  src={url}
                  alt={photo.filename}
                  loading="lazy"
                  className={`w-full h-auto transition-smooth ${
                    isSelected ? 'scale-95 opacity-60' : 'hover:scale-[1.03]'
                  }`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.opacity = '0.2';
                  }}
                />
                {isSelected && (
                  <div className="absolute left-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-[#e8c547] text-xs font-bold text-[#0a0a0b] animate-scale-in">
                    {selectedIndex}
                  </div>
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 transition-smooth hover:opacity-100" />
              </button>
            );
          })}
        </div>
      )}

      {/* Bottom payment bar */}
      {selectedCount > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#26262e] glass animate-slide-up">
          <div className="mx-auto max-w-lg space-y-3 p-4">
            <Input
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="Votre adresse e-mail (pour recevoir vos photos)"
            />
            {payError && (
              <p className="text-sm text-[#f87171]">{payError}</p>
            )}
            <Button
              size="lg"
              className="w-full"
              disabled={!email || paying || selectedCount === 0}
              onClick={handlePay}
            >
              {paying ? (
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-5 w-5" />
              )}
              Payer {totalPrice.toFixed(2)} €
            </Button>
            <button
              onClick={() => setSelected(new Set())}
              className="flex w-full items-center justify-center gap-1 text-xs text-[#6b6b75] hover:text-[#9a9aa5]"
            >
              <X className="h-3 w-3" /> Effacer la sélection
            </button>
          </div>
        </div>
      )}

      {/* Spacer for bottom bar */}
      {selectedCount > 0 && <div className="h-44" />}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 animate-fade-in"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-h-full max-w-full rounded-xl" />
          <button className="absolute right-4 top-4 rounded-full bg-[#1a1a1f] p-2 text-[#f5f5f7]">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}
    </div>
  );
}

export function ConfirmationScreen({ orderId }: { orderId: string }) {
  const [order, setOrder] = useState<{ customer_email: string; amount: number; sessions: { code: string } } | null>(null);

  useEffect(() => {
    supabase
      .from('orders')
      .select('*, sessions ( code )')
      .eq('id', orderId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setOrder(data as typeof order);
      });
  }, [orderId]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#0a0a0b] p-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#34d399]/10 animate-scale-in">
        <Check className="h-10 w-10 text-[#34d399]" />
      </div>
      <h1 className="text-2xl font-bold">Paiement confirmé</h1>
      <p className="mt-3 max-w-sm text-[#9a9aa5]">
        Merci{order ? `, ${order.customer_email}` : ''} ! Votre paiement de{' '}
        <span className="font-bold text-[#f5f5f7]">{order ? Number(order.amount).toFixed(2) : ''} €</span>{' '}
        a bien été reçu. Un reçu vous a été envoyé par e-mail.
      </p>
      {order?.sessions && (
        <p className="mt-2 text-sm text-[#6b6b75]">
          Session <span className="font-mono">{order.sessions.code}</span>
        </p>
      )}
      <div className="mt-8 flex items-center gap-2 text-sm text-[#6b6b75]">
        <Mail className="h-4 w-4" />
        Vos photos HD seront envoyées par e-mail dès qu'elles seront prêtes
      </div>
      <button
        onClick={() => navigate('/')}
        className="mt-8 flex items-center gap-1.5 text-sm text-[#9a9aa5] hover:text-[#f5f5f7]"
      >
        <ArrowLeft className="h-4 w-4" /> Retour
      </button>
    </div>
  );
}
