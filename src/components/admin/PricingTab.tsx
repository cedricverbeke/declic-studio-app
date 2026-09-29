import { useState, useEffect } from 'react';
import { supabase, type PricingTier, type PricingRates } from '@/lib/supabase';
import { Button, Modal, Input, EmptyState } from '@/components/ui';
import { Plus, Pencil, Trash2, Check, Star, Tag, Gift } from 'lucide-react';

export function PricingTab() {
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<PricingTier | null>(null);
  const [name, setName] = useState('');
  const [extraPerPhoto, setExtraPerPhoto] = useState('5');
  const [freePhotos, setFreePhotos] = useState('0');
  const [tierRows, setTierRows] = useState<{ qty: string; price: string }[]>([
    { qty: '1', price: '10' },
    { qty: '3', price: '25' },
    { qty: '5', price: '35' },
  ]);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from('pricing_tiers').select('*').order('created_at', { ascending: true });
    setTiers((data as PricingTier[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function openCreate() {
    setEditing(null);
    setName('');
    setExtraPerPhoto('5');
    setFreePhotos('0');
    setTierRows([
      { qty: '1', price: '10' },
      { qty: '3', price: '25' },
      { qty: '5', price: '35' },
    ]);
    setModalOpen(true);
  }

  function openEdit(tier: PricingTier) {
    setEditing(tier);
    setName(tier.name);
    setExtraPerPhoto(String(tier.rates.extra_per_photo || 5));
    setFreePhotos(String(tier.rates.free_photos || 0));
    setTierRows(
      tier.rates.tiers?.length
        ? tier.rates.tiers.map((t) => ({ qty: String(t.qty), price: String(t.price) }))
        : [{ qty: '1', price: '10' }],
    );
    setModalOpen(true);
  }

  async function save() {
    const rates: PricingRates = {
      tiers: tierRows
        .filter((r) => r.qty && r.price)
        .map((r) => ({ qty: parseInt(r.qty), price: parseFloat(r.price) }))
        .sort((a, b) => a.qty - b.qty),
      extra_per_photo: parseFloat(extraPerPhoto) || 0,
      free_photos: parseInt(freePhotos) || 0,
    };

    if (editing) {
      await supabase.from('pricing_tiers').update({ name, rates }).eq('id', editing.id);
    } else {
      await supabase.from('pricing_tiers').insert({ name, rates });
    }
    setModalOpen(false);
    load();
  }

  async function setDefault(tier: PricingTier) {
    await supabase.from('pricing_tiers').update({ is_default: false }).neq('id', tier.id);
    await supabase.from('pricing_tiers').update({ is_default: true }).eq('id', tier.id);
    load();
  }

  async function remove(tier: PricingTier) {
    if (!confirm(`Supprimer la grille « ${tier.name} » ?`)) return;
    await supabase.from('pricing_tiers').delete().eq('id', tier.id);
    load();
  }

  function addRow() {
    setTierRows([...tierRows, { qty: '', price: '' }]);
  }

  function updateRow(idx: number, field: 'qty' | 'price', value: string) {
    const rows = [...tierRows];
    rows[idx][field] = value;
    setTierRows(rows);
  }

  function removeRow(idx: number) {
    setTierRows(tierRows.filter((_, i) => i !== idx));
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Grilles Tarifaires</h1>
          <p className="mt-1 text-sm text-[#9a9aa5]">Définissez vos grilles de prix dégressifs</p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 inline h-4 w-4" />
          Nouvelle grille
        </Button>
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#6b6b75]">Chargement…</div>
      ) : tiers.length === 0 ? (
        <EmptyState
          icon={<Tag className="h-10 w-10" />}
          title="Aucune grille tarifaire"
          subtitle="Créez votre première grille pour commencer"
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {tiers.map((tier) => (
            <div
              key={tier.id}
              className="rounded-2xl border border-[#26262e] bg-[#131316] p-5 transition-smooth hover:border-[#33333c]"
            >
              <div className="mb-4 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold">{tier.name}</h3>
                    {tier.is_default && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#e8c547]/10 px-2 py-0.5 text-xs font-medium text-[#e8c547]">
                        <Star className="h-3 w-3" /> Par défaut
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => openEdit(tier)}
                    className="rounded-lg p-2 text-[#6b6b75] transition-smooth hover:bg-[#1a1a1f] hover:text-[#f5f5f7]"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => remove(tier)}
                    className="rounded-lg p-2 text-[#6b6b75] transition-smooth hover:bg-[#1a1a1f] hover:text-[#f87171]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                {(tier.rates.free_photos || 0) > 0 && (
                  <div className="flex items-center justify-between rounded-lg bg-[#e8c547]/5 px-3 py-2">
                    <span className="flex items-center gap-1.5 text-sm text-[#e8c547]">
                      <Gift className="h-3.5 w-3.5" />
                      {tier.rates.free_photos} photo{(tier.rates.free_photos as number) > 1 ? 's' : ''} gratuite{(tier.rates.free_photos as number) > 1 ? 's' : ''}
                    </span>
                    <span className="font-semibold text-[#e8c547]">0,00 €</span>
                  </div>
                )}
                {tier.rates.tiers?.map((t, i) => (
                  <div key={i} className="flex items-center justify-between rounded-lg bg-[#0a0a0b] px-3 py-2">
                    <span className="text-sm text-[#9a9aa5]">{t.qty} photo{t.qty > 1 ? 's' : ''}</span>
                    <span className="font-semibold">{t.price.toFixed(2)} €</span>
                  </div>
                ))}
                <div className="flex items-center justify-between rounded-lg bg-[#0a0a0b] px-3 py-2">
                  <span className="text-sm text-[#9a9aa5]">Photo suppl.</span>
                  <span className="font-semibold text-[#e8c547]">
                    {tier.rates.extra_per_photo?.toFixed(2)} €
                  </span>
                </div>
              </div>

              {!tier.is_default && (
                <button
                  onClick={() => setDefault(tier)}
                  className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-[#33333c] py-2 text-xs font-medium text-[#9a9aa5] transition-smooth hover:border-[#e8c547]/30 hover:text-[#e8c547]"
                >
                  <Check className="h-3.5 w-3.5" />
                  Définir par défaut
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Modifier la grille' : 'Nouvelle grille'}>
        <div className="space-y-4">
          <Input label="Nom de la grille" value={name} onChange={setName} placeholder="ex: Tarif Plage" />

          <div>
            <label className="mb-2 block text-sm font-medium text-[#9a9aa5]">Tranches de prix</label>
            <div className="space-y-2">
              {tierRows.map((row, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      min="1"
                      value={row.qty}
                      onChange={(e) => updateRow(idx, 'qty', e.target.value)}
                      placeholder="Nb photos"
                      className="w-full rounded-lg border border-[#33333c] bg-[#0a0a0b] px-3 py-2 text-sm outline-none focus:border-[#e8c547]/50"
                    />
                  </div>
                  <span className="text-[#6b6b75]">=</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      step="0.01"
                      value={row.price}
                      onChange={(e) => updateRow(idx, 'price', e.target.value)}
                      placeholder="Prix €"
                      className="w-full rounded-lg border border-[#33333c] bg-[#0a0a0b] px-3 py-2 text-sm outline-none focus:border-[#e8c547]/50"
                    />
                  </div>
                  <button
                    onClick={() => removeRow(idx)}
                    className="rounded-lg p-2 text-[#6b6b75] hover:text-[#f87171]"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={addRow}
              className="mt-2 flex items-center gap-1 text-xs font-medium text-[#9a9aa5] hover:text-[#f5f5f7]"
            >
              <Plus className="h-3.5 w-3.5" /> Ajouter une tranche
            </button>
          </div>

          <Input
            label="Prix par photo supplémentaire (€)"
            type="number"
            step="0.01"
            value={extraPerPhoto}
            onChange={setExtraPerPhoto}
            placeholder="5"
          />

          <Input
            label="Photos offertes (gratuites)"
            type="number"
            min="0"
            value={freePhotos}
            onChange={setFreePhotos}
            placeholder="0"
          />
          <p className="-mt-2 text-xs text-[#6b6b75]">
            Les N premières photos sont offertes. Idéal pour les séances studio avec photos incluses.
          </p>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setModalOpen(false)}>Annuler</Button>
            <Button onClick={save} disabled={!name}>{editing ? 'Enregistrer' : 'Créer'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
