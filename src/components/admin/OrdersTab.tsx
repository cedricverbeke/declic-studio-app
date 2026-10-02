import { useState, useEffect } from 'react';
import { supabase, type Order, type Session, type Photo } from '@/lib/supabase';
import { Button, EmptyState, StatusBadge, Modal } from '@/components/ui';
import { statusLabel } from '@/lib/theme';
import { Send, Package, Mail, ChevronRight, Loader2, CheckCircle2, Copy, Check, Download, Trash2 } from 'lucide-react';

type Filter = 'all' | 'awaiting_hd' | 'ready' | 'delivered';

export function OrdersTab({ sessions }: { sessions: Session[] }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [detailOrder, setDetailOrder] = useState<Order | null>(null);
  const [sending, setSending] = useState<string | null>(null);
  const [sendingBatch, setSendingBatch] = useState(false);
  const [detailPhotos, setDetailPhotos] = useState<Photo[]>([]);
  const [copiedAll, setCopiedAll] = useState(false);
  const [downloadedAll, setDownloadedAll] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('orders')
      .select('*, sessions ( code )')
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function sendDelivery(orderId: string) {
    setSending(orderId);
    try {
      const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-email`;
      const res = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ type: 'delivery', orderId }),
      });
      if (res.ok) {
        await load();
      }
    } catch {
      // network error
    }
    setSending(null);
  }

  async function openDetail(order: Order) {
    setDetailOrder(order);
    setDetailPhotos([]);
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('session_id', order.session_id);
    setDetailPhotos((data as Photo[]) || []);
  }

  async function sendBatchDelivery() {
    const readyOrders = orders.filter((o) => o.delivery_status === 'ready');
    if (readyOrders.length === 0) return;
    setSendingBatch(true);
    for (const order of readyOrders) {
      await sendDelivery(order.id);
    }
    setSendingBatch(false);
  }

  const filtered = orders.filter((o) => {
    if (filter === 'all') return o.payment_status === 'paid';
    if (filter === 'awaiting_hd') return o.payment_status === 'paid' && o.delivery_status === 'awaiting_hd';
    if (filter === 'ready') return o.delivery_status === 'ready';
    if (filter === 'delivered') return o.delivery_status === 'delivered';
    return true;
  });

  const readyCount = orders.filter((o) => o.delivery_status === 'ready').length;

  async function deleteOrder(orderId: string) {
    const { error } = await supabase.from('orders').delete().eq('id', orderId);
    if (!error) await load();
  }

  async function deleteOrders(ordersToDelete: Order[]) {
    setDeleting(true);
    for (const order of ordersToDelete) {
      await supabase.from('orders').delete().eq('id', order.id);
    }
    setDeleting(false);
    setDeleteConfirm(false);
    setOrderToDelete(null);
    await load();
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'all', label: 'Toutes', count: orders.filter((o) => o.payment_status === 'paid').length },
    { key: 'awaiting_hd', label: 'En attente HD', count: orders.filter((o) => o.payment_status === 'paid' && o.delivery_status === 'awaiting_hd').length },
    { key: 'ready', label: 'Prêt à livrer', count: readyCount },
    { key: 'delivered', label: 'Livré', count: orders.filter((o) => o.delivery_status === 'delivered').length },
  ];

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commandes</h1>
          <p className="mt-1 text-sm text-[#9a9aa5]">Suivi et livraison des commandes clients</p>
        </div>
        <div className="flex items-center gap-2">
          {orders.length > 0 && (
            <Button variant="danger" onClick={() => { setOrderToDelete(null); setDeleteConfirm(true); }}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Nettoyer ({orders.length})
            </Button>
          )}
          {readyCount > 0 && (
            <Button onClick={sendBatchDelivery} disabled={sendingBatch}>
              {sendingBatch ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-1.5 h-4 w-4" />
              )}
              Livrer tout ({readyCount})
            </Button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-2 overflow-x-auto">
        {filters.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-medium transition-smooth ${
              filter === f.key
                ? 'bg-[#f5f5f7] text-[#0a0a0b]'
                : 'bg-[#1a1a1f] text-[#9a9aa5] hover:bg-[#26262e]'
            }`}
          >
            {f.label}
            <span className={`rounded-full px-1.5 text-xs ${filter === f.key ? 'bg-[#0a0a0b]/20' : 'bg-[#33333c]'}`}>
              {f.count}
            </span>
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-[#6b6b75]">Chargement…</div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Package className="h-10 w-10" />}
          title="Aucune commande"
          subtitle="Les commandes payées apparaîtront ici"
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((order) => (
            <div
              key={order.id}
              className="flex flex-col gap-3 rounded-2xl border border-[#26262e] bg-[#131316] p-4 transition-smooth hover:border-[#33333c] sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#0a0a0b]">
                  <Mail className="h-5 w-5 text-[#9a9aa5]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{order.customer_email}</span>
                    <StatusBadge status={order.delivery_status} label={statusLabel(order.delivery_status)} />
                  </div>
                  <p className="mt-0.5 text-xs text-[#6b6b75]">
                    {order.sessions?.code} · {order.selected_photos.length} photo{order.selected_photos.length > 1 ? 's' : ''} · {Number(order.amount).toFixed(2)} €
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => openDetail(order)}
                  className="flex items-center gap-1 rounded-lg px-3 py-2 text-xs font-medium text-[#9a9aa5] transition-smooth hover:bg-[#1a1a1f] hover:text-[#f5f5f7]"
                >
                  Détails <ChevronRight className="h-3.5 w-3.5" />
                </button>
                {order.delivery_status === 'ready' && (
                  <Button size="sm" onClick={() => sendDelivery(order.id)} disabled={sending === order.id}>
                    {sending === order.id ? (
                      <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Send className="mr-1 h-3.5 w-3.5" />
                    )}
                    Livrer
                  </Button>
                )}
                {order.delivery_status === 'delivered' && (
                  <span className="flex items-center gap-1 text-xs text-[#34d399]">
                    <CheckCircle2 className="h-4 w-4" /> Livré
                  </span>
                )}
                <button
                  onClick={() => { setOrderToDelete(order); setDeleteConfirm(true); }}
                  className="flex items-center gap-1 rounded-lg border border-[#f87171]/30 px-2.5 py-2 text-xs font-medium text-[#f87171] transition-smooth hover:bg-[#f87171]/10"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Order detail modal */}
      <Modal open={!!detailOrder} onClose={() => setDetailOrder(null)} title="Détail de la commande">
        {detailOrder && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-xl bg-[#0a0a0b] p-3">
                <p className="text-xs text-[#6b6b75]">Client</p>
                <p className="mt-1 text-sm font-medium">{detailOrder.customer_email}</p>
              </div>
              <div className="rounded-xl bg-[#0a0a0b] p-3">
                <p className="text-xs text-[#6b6b75]">Session</p>
                <p className="mt-1 text-sm font-medium">{detailOrder.sessions?.code}</p>
              </div>
              <div className="rounded-xl bg-[#0a0a0b] p-3">
                <p className="text-xs text-[#6b6b75]">Montant</p>
                <p className="mt-1 text-sm font-bold text-[#e8c547]">{Number(detailOrder.amount).toFixed(2)} €</p>
              </div>
              <div className="rounded-xl bg-[#0a0a0b] p-3">
                <p className="text-xs text-[#6b6b75]">Photos</p>
                <p className="mt-1 text-sm font-medium">{detailOrder.selected_photos.length}</p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-sm text-[#9a9aa5]">Paiement:</span>
              <StatusBadge status={detailOrder.payment_status} label={statusLabel(detailOrder.payment_status)} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-[#9a9aa5]">Livraison:</span>
              <StatusBadge status={detailOrder.delivery_status} label={statusLabel(detailOrder.delivery_status)} />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm text-[#9a9aa5]">Photos commandées ({detailOrder.selected_photos.length})</p>
                {detailOrder.selected_photos.length > 0 && (
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => {
                        const filenames = (detailOrder.selected_photos as string[])
                          .map((pid) => {
                            const photo = detailPhotos.find((p) => p.id === pid);
                            return photo ? photo.filename : null;
                          })
                          .filter(Boolean);
                        navigator.clipboard.writeText(filenames.join(' '));
                        setCopiedAll(true);
                        setTimeout(() => setCopiedAll(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-[#9a9aa5] transition-smooth hover:text-[#f5f5f7]"
                    >
                      {copiedAll ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                      Copier
                    </button>
                    <button
                      onClick={() => {
                        const filenames = (detailOrder.selected_photos as string[])
                          .map((pid) => {
                            const photo = detailPhotos.find((p) => p.id === pid);
                            return photo ? photo.filename : null;
                          })
                          .filter(Boolean);
                        const text = filenames.join(' ');
                        const blob = new Blob([text], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `${detailOrder.sessions?.code || 'session'}_${detailOrder.customer_email.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
                        a.click();
                        URL.revokeObjectURL(url);
                        setDownloadedAll(true);
                        setTimeout(() => setDownloadedAll(false), 2000);
                      }}
                      className="flex items-center gap-1 text-xs font-medium text-[#9a9aa5] transition-smooth hover:text-[#f5f5f7]"
                    >
                      {downloadedAll ? <Check className="h-3.5 w-3.5" /> : <Download className="h-3.5 w-3.5" />}
                      Télécharger
                    </button>
                  </div>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg bg-[#0a0a0b] p-3">
                {(detailOrder.selected_photos as string[]).map((pid, i) => {
                  const photo = detailPhotos.find((p) => p.id === pid);
                  return (
                    <div key={pid} className="flex items-center gap-2 text-xs">
                      <span className="flex h-5 w-5 items-center justify-center rounded bg-[#1a1a1f] text-[10px] font-medium text-[#9a9aa5]">
                        {i + 1}
                      </span>
                      <span className="font-mono text-[#f5f5f7]">{photo?.filename || <span className="text-[#6b6b75]">{pid.slice(0, 8)}…</span>}</span>
                      {photo?.hd_ready && (
                        <span className="ml-auto rounded bg-[#34d399]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#34d399]">HD prêt</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {detailOrder.delivery_status === 'ready' && (
              <Button
                className="w-full"
                onClick={() => {
                  sendDelivery(detailOrder.id);
                  setDetailOrder(null);
                }}
              >
                <Send className="mr-1.5 h-4 w-4" /> Envoyer les photos HD
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal open={deleteConfirm} onClose={() => { setDeleteConfirm(false); setOrderToDelete(null); }} title="Confirmer la suppression" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]">
            {orderToDelete
              ? 'Cette commande sera définitivement supprimée.'
              : `Toutes les ${orders.length} commandes seront définitivement supprimées.`}
            {' '}Cette action est irréversible.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => { setDeleteConfirm(false); setOrderToDelete(null); }}>Annuler</Button>
            <Button variant="danger" onClick={() => deleteOrders(orderToDelete ? [orderToDelete] : orders)} disabled={deleting}>
              {deleting ? 'Suppression…' : orderToDelete ? 'Supprimer cette commande' : `Tout supprimer (${orders.length})`}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
