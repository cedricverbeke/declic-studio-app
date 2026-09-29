import { useState, useEffect } from 'react';
import { supabase, type Session } from '@/lib/supabase';
import { PricingTab } from '@/components/admin/PricingTab';
import { SessionsTab } from '@/components/admin/SessionsTab';
import { DropZone } from '@/components/admin/DropZone';
import { OrdersTab } from '@/components/admin/OrdersTab';
import { Tag, Camera, UploadCloud, Package, Aperture } from 'lucide-react';

type Tab = 'sessions' | 'pricing' | 'dropzone' | 'orders';

export function AdminApp() {
  const [tab, setTab] = useState<Tab>('sessions');
  const [sessions, setSessions] = useState<Session[]>([]);

  async function loadSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*, pricing_tiers(*)')
      .order('created_at', { ascending: false });
    setSessions((data as Session[]) || []);
  }

  useEffect(() => {
    loadSessions();
  }, []);

  const tabs: { key: Tab; label: string; icon: typeof Camera }[] = [
    { key: 'sessions', label: 'Sessions', icon: Camera },
    { key: 'pricing', label: 'Tarifs', icon: Tag },
    { key: 'dropzone', label: 'Dépôt HD', icon: UploadCloud },
    { key: 'orders', label: 'Commandes', icon: Package },
  ];

  const activeSession = sessions.find((s) => s.status === 'active');

  return (
    <div className="min-h-screen bg-[#0a0a0b]">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-[#26262e] glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#f5f5f7]">
              <Aperture className="h-5 w-5 text-[#0a0a0b]" />
            </div>
            <div>
              <h1 className="text-base font-bold leading-tight">Déclic Studio</h1>
              <p className="text-xs text-[#6b6b75] leading-tight">Studio Photo</p>
            </div>
          </div>
          {activeSession && (
            <div className="flex items-center gap-2 rounded-lg bg-[#34d399]/10 px-3 py-1.5 text-xs">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#34d399]" />
              <span className="font-mono font-medium text-[#34d399]">{activeSession.code}</span>
              <span className="text-[#6b6b75]">active</span>
            </div>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav className="sticky top-[57px] z-30 border-b border-[#26262e] bg-[#0a0a0b]">
        <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-4 sm:px-6">
          {tabs.map((t) => {
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-smooth ${
                  tab === t.key
                    ? 'border-[#e8c547] text-[#f5f5f7]'
                    : 'border-transparent text-[#6b6b75] hover:text-[#9a9aa5]'
                }`}
              >
                <Icon className="h-4 w-4" />
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content */}
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {tab === 'sessions' && <SessionsTab />}
        {tab === 'pricing' && <PricingTab />}
        {tab === 'dropzone' && <DropZone sessions={sessions} />}
        {tab === 'orders' && <OrdersTab sessions={sessions} />}
      </main>
    </div>
  );
}
