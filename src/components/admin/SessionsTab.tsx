import { useState, useEffect } from 'react';
import { supabase, generateSessionCode, type Session, type PricingTier } from '@/lib/supabase';
import { Button, Modal, EmptyState, StatusBadge } from '@/components/ui';
import { QRCode } from '@/components/QRCode';
import { Plus, QrCode, Play, Square, Copy, Check, Camera, X, Images, Trash2 } from 'lucide-react';
import { statusLabel } from '@/lib/theme';
import { SessionPhotos } from '@/components/admin/SessionPhotos';

export function SessionsTab() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [tiers, setTiers] = useState<PricingTier[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [qrSession, setQrSession] = useState<Session | null>(null);
  const [selectedTier, setSelectedTier] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [photosSession, setPhotosSession] = useState<Session | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  async function load() {
    setLoading(true);
    const [sessRes, tierRes] = await Promise.all([
      supabase
        .from('sessions')
        .select('*, pricing_tiers(*)')
        .order('created_at', { ascending: false }),
      supabase.from('pricing_tiers').select('*').order('created_at', { ascending: true }),
    ]);
    setSessions((sessRes.data as Session[]) || []);
    setTiers((tierRes.data as PricingTier[]) || []);
    if (tierRes.data) {
      const def = tierRes.data.find((t) => t.is_default);
      setSelectedTier(def?.id || tierRes.data[0]?.id || '');
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function createSession() {
    const tier = tiers.find((t) => t.id === selectedTier);
    const code = generateSessionCode();

    // New session is active; all others become completed
    await supabase
      .from('sessions')
      .update({ status: 'completed' })
      .eq('status', 'active');

    const { data } = await supabase
      .from('sessions')
      .insert({
        code,
        pricing_tier_id: selectedTier || null,
        status: 'active',
      })
      .select('*, pricing_tiers(*)')
      .maybeSingle();

    setCreateOpen(false);
    if (data) setQrSession(data as Session);
    load();
  }

  async function activate(id: string) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('status', 'active');
    await supabase.from('sessions').update({ status: 'active' }).eq('id', id);
    load();
  }

  async function complete(id: string) {
    await supabase.from('sessions').update({ status: 'completed' }).eq('id', id);
    load();
  }

  function toggleSelect(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const sessionsToDelete = sessions.filter((s) => selectedIds.has(s.id));

  async function deleteSessions() {
    setDeleting(true);
    for (const session of sessionsToDelete) {
      // List and remove vignette files for this session
      const { data: vignetteFiles } = await supabase.storage
        .from('vignettes')
        .list(session.code);
      if (vignetteFiles && vignetteFiles.length > 0) {
        await supabase.storage
          .from('vignettes')
          .remove(vignetteFiles.map((f) => `${session.code}/${f.name}`));
      }

      // List and remove HD files for this session
      const { data: hdFiles } = await supabase.storage
        .from('hd-photos')
        .list(session.code);
      if (hdFiles && hdFiles.length > 0) {
        await supabase.storage
          .from('hd-photos')
          .remove(hdFiles.map((f) => `${session.code}/${f.name}`));
      }

      // Delete the session row — cascade removes photos and orders from DB
      await supabase.from('sessions').delete().eq('id', session.id);
    }
    setDeleting(false);
    setDeleteConfirm(false);
    setSelectedIds(new Set());
    load();
  }

  function copyLink(code: string) {
    const url = `${window.location.origin}/#/g/${code}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const galleryUrl = qrSession
    ? `${window.location.origin}/#/g/${qrSession.code}`
    : '';

  return (
    <div className="animate-fade-in">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sessions</h1>
          <p className="mt-1 text-sm text-[#9a9aa5]">Gérez vos sessions photo et QR codes</p>
        </div>
        <div className="flex items-center gap-2">
          {selectedIds.size > 0 && (
            <Button variant="danger" onClick={() => setDeleteConfirm(true)}>
              <Trash2 className="mr-1.5 inline h-4 w-4" />
              Supprimer ({selectedIds.size})
            </Button>
          )}
          {sessions.length > 0 && (
            <Button variant="danger" onClick={() => setDeleteAllConfirm(true)}>
              <Trash2 className="mr-1.5 inline h-4 w-4" />
              Tout supprimer
            </Button>
          )}
          <Button onClick={() => setCreateOpen(true)} disabled={tiers.length === 0}>
            <Plus className="mr-1.5 inline h-4 w-4" />
            Nouvelle session
          </Button>
        </div>
      </div>

      {tiers.length === 0 && !loading && (
        <div className="mb-4 rounded-xl border border-[#fbbf24]/30 bg-[#fbbf24]/10 px-4 py-3 text-sm text-[#fbbf24]">
          Créez d'abord une grille tarifaire dans l'onglet correspondant.
        </div>
      )}

      {loading ? (
        <div className="py-20 text-center text-[#6b6b75]">Chargement…</div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={<Camera className="h-10 w-10" />}
          title="Aucune session"
          subtitle="Créez votre première session pour générer un QR code"
        />
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className={`flex flex-col gap-3 rounded-2xl border bg-[#131316] p-4 transition-smooth sm:flex-row sm:items-center sm:justify-between ${
                selectedIds.has(session.id)
                  ? 'border-[#f87171]/40'
                  : 'border-[#26262e] hover:border-[#33333c]'
              }`}
            >
              <div className="flex items-center gap-4">
                <button
                  onClick={() => toggleSelect(session.id)}
                  className={`flex h-5 w-5 items-center justify-center rounded-md border transition-smooth ${
                    selectedIds.has(session.id)
                      ? 'border-[#f87171] bg-[#f87171] text-[#0a0a0b]'
                      : 'border-[#33333c] hover:border-[#6b6b75]'
                  }`}
                >
                  {selectedIds.has(session.id) && <Check className="h-3.5 w-3.5" />}
                </button>
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#0a0a0b] font-mono text-sm font-bold text-[#e8c547]">
                  {session.code.split('-')[1]?.slice(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold">{session.code}</span>
                    <StatusBadge status={session.status} label={statusLabel(session.status)} />
                  </div>
                  <p className="mt-0.5 text-sm text-[#6b6b75]">
                    {session.pricing_tiers?.name || 'Aucune grille'}
                    {' · '}
                    {new Date(session.created_at).toLocaleDateString('fr-FR', {
                      day: '2-digit',
                      month: 'short',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setPhotosSession(session)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#33333c] px-3 py-2 text-xs font-medium text-[#9a9aa5] transition-smooth hover:border-[#e8c547]/30 hover:text-[#e8c547]"
                >
                  <Images className="h-4 w-4" /> Photos
                </button>
                <button
                  onClick={() => setQrSession(session)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#33333c] px-3 py-2 text-xs font-medium text-[#9a9aa5] transition-smooth hover:border-[#e8c547]/30 hover:text-[#e8c547]"
                >
                  <QrCode className="h-4 w-4" /> QR
                </button>
                <button
                  onClick={() => copyLink(session.code)}
                  className="flex items-center gap-1.5 rounded-lg border border-[#33333c] px-3 py-2 text-xs font-medium text-[#9a9aa5] transition-smooth hover:border-[#e8c547]/30 hover:text-[#e8c547]"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  Lien
                </button>
                {session.status !== 'active' && (
                  <Button size="sm" variant="secondary" onClick={() => activate(session.id)}>
                    <Play className="mr-1 h-3.5 w-3.5" /> Activer
                  </Button>
                )}
                {session.status === 'active' && (
                  <Button size="sm" variant="danger" onClick={() => complete(session.id)}>
                    <Square className="mr-1 h-3.5 w-3.5" /> Terminer
                  </Button>
                )}
                <button
                  onClick={() => {
                    setSelectedIds(new Set([session.id]));
                    setDeleteConfirm(true);
                  }}
                  className="flex items-center gap-1.5 rounded-lg border border-[#f87171]/30 px-3 py-2 text-xs font-medium text-[#f87171] transition-smooth hover:bg-[#f87171]/10"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create modal */}
      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Nouvelle session" maxWidth="max-w-md">
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#9a9aa5]">Grille tarifaire</label>
            <select
              value={selectedTier}
              onChange={(e) => setSelectedTier(e.target.value)}
              className="w-full rounded-xl border border-[#33333c] bg-[#0a0a0b] px-4 py-2.5 text-sm text-[#f5f5f7] outline-none focus:border-[#e8c547]/50"
            >
              {tiers.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}{t.is_default ? ' (par défaut)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="rounded-lg bg-[#0a0a0b] px-4 py-3 text-sm text-[#9a9aa5]">
            Un code unique sera généré automatiquement. La session sera active immédiatement et l'ancienne session active sera terminée.
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Annuler</Button>
            <Button onClick={createSession}>Créer la session</Button>
          </div>
        </div>
      </Modal>

      {photosSession && (
        <SessionPhotos
          session={photosSession}
          onClose={() => setPhotosSession(null)}
        />
      )}

      {/* Delete confirmation modal */}
      <Modal open={deleteConfirm} onClose={() => setDeleteConfirm(false)} title="Confirmer la suppression" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]">
            Cette action est irréversible. Les sessions, leurs photos (vignettes et HD) et les commandes associées seront définitivement supprimées.
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-[#0a0a0b] p-3">
            {sessionsToDelete.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" />
                <span className="font-mono font-medium">{s.code}</span>
                <span className="text-[#6b6b75]">· {s.pricing_tiers?.name || 'Aucune grille'}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteConfirm(false)}>Annuler</Button>
            <Button variant="danger" onClick={deleteSessions} disabled={deleting}>
              {deleting ? 'Suppression…' : `Supprimer (${sessionsToDelete.length})`}
            </Button>
          </div>
        </div>
      </Modal>

      {/* Delete ALL confirmation modal */}
      <Modal open={deleteAllConfirm} onClose={() => setDeleteAllConfirm(false)} title="Supprimer toutes les sessions" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="rounded-xl border border-[#f87171]/20 bg-[#f87171]/10 px-4 py-3 text-sm text-[#f87171]">
            Vous êtes sur le point de supprimer les {sessions.length} sessions, toutes leurs photos (vignettes et HD) et toutes les commandes associées. Cette action est irréversible.
          </div>
          <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-[#0a0a0b] p-3">
            {sessions.map((s) => (
              <div key={s.id} className="flex items-center gap-2 text-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-[#f87171]" />
                <span className="font-mono font-medium">{s.code}</span>
                <span className="text-[#6b6b75]">· {s.pricing_tiers?.name || 'Aucune grille'}</span>
              </div>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDeleteAllConfirm(false)}>Annuler</Button>
            <Button variant="danger" onClick={async () => {
              setSelectedIds(new Set(sessions.map((s) => s.id)));
              setDeleteAllConfirm(false);
              setDeleteConfirm(true);
            }}>
              <Trash2 className="mr-1.5 h-4 w-4" />
              Tout supprimer ({sessions.length})
            </Button>
          </div>
        </div>
      </Modal>

      {/* QR Code modal */}
      <Modal open={!!qrSession} onClose={() => setQrSession(null)} title={`QR Code — ${qrSession?.code}`} maxWidth="max-w-sm">
        {qrSession && (
          <div className="flex flex-col items-center gap-4">
            <QRCode text={galleryUrl} size={240} />
            <div className="w-full rounded-lg bg-[#0a0a0b] px-4 py-3 text-center">
              <p className="text-xs text-[#6b6b75]">Lien client</p>
              <p className="mt-1 break-all font-mono text-sm text-[#f5f5f7]">{galleryUrl}</p>
            </div>
            <div className="flex w-full gap-2">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => copyLink(qrSession.code)}
              >
                {copied ? <Check className="mr-1.5 h-4 w-4" /> : <Copy className="mr-1.5 h-4 w-4" />}
                Copier le lien
              </Button>
              <Button
                className="flex-1"
                onClick={() => window.open(galleryUrl, '_blank')}
              >
                Ouvrir
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
