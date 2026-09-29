import { useState, useEffect, useRef } from 'react';
import { supabase, type Session, type Photo } from '@/lib/supabase';
import { Button, Modal, EmptyState } from '@/components/ui';
import { UploadCloud, Images, Trash2, Loader2, X } from 'lucide-react';

export function SessionPhotos({ session, onClose, onBack }: { session: Session; onClose: () => void; onBack?: () => void }) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from('photos')
      .select('*')
      .eq('session_id', session.id)
      .order('created_at', { ascending: true });
    setPhotos((data as Photo[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [session.id]);

  async function handleUpload(files: FileList) {
    setUploading(true);
    for (const file of Array.from(files)) {
      const filename = file.name;
      const { error } = await supabase.storage
        .from('vignettes')
        .upload(`${session.code}/${filename}`, file, { upsert: true });
      if (!error) {
        const { data } = supabase.storage
          .from('vignettes')
          .getPublicUrl(`${session.code}/${filename}`);
        await supabase.from('photos').insert({
          session_id: session.id,
          filename,
          vignette_url: data.publicUrl,
          hd_ready: false,
        });
      }
    }
    setUploading(false);
    load();
  }

  async function removePhoto(photo: Photo) {
    if (!confirm(`Supprimer ${photo.filename} ?`)) return;
    await supabase.storage
      .from('vignettes')
      .remove([`${session.code}/${photo.filename}`]);
    await supabase.from('photos').delete().eq('id', photo.id);
    load();
  }

  function getVignetteUrl(photo: Photo): string {
    if (photo.vignette_url) return photo.vignette_url;
    const { data } = supabase.storage
      .from('vignettes')
      .getPublicUrl(`${session.code}/${photo.filename}`);
    return data.publicUrl;
  }

  return (
    <Modal open={true} onClose={onClose} title={`Photos — ${session.code}`} maxWidth="max-w-3xl">
      <div className="space-y-4">
        {onBack && (
          <button onClick={onBack} className="text-sm text-[#9a9aa5] hover:text-[#f5f5f7]">
            ← Retour aux sessions
          </button>
        )}

        <div
          onClick={() => inputRef.current?.click()}
          className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#33333c] bg-[#0a0a0b] p-8 transition-smooth hover:border-[#e8c547]/40"
        >
          {uploading ? (
            <Loader2 className="mb-2 h-8 w-8 animate-spin text-[#e8c547]" />
          ) : (
            <UploadCloud className="mb-2 h-8 w-8 text-[#6b6b75]" />
          )}
          <p className="text-sm font-medium">
            {uploading ? 'Téléversement…' : 'Ajouter des vignettes'}
          </p>
          <p className="mt-1 text-xs text-[#6b6b75]">Cliquez pour sélectionner des images</p>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
        </div>

        {loading ? (
          <div className="py-10 text-center text-[#6b6b75]">Chargement…</div>
        ) : photos.length === 0 ? (
          <EmptyState
            icon={<Images className="h-8 w-8" />}
            title="Aucune vignette"
            subtitle="Téléversez les vignettes visibles par les clients"
          />
        ) : (
          <div className="grid max-h-96 grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {photos.map((photo) => (
              <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-lg">
                <img
                  src={getVignetteUrl(photo)}
                  alt={photo.filename}
                  className="h-full w-full object-cover"
                  onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.2')}
                />
                {photo.hd_ready && (
                  <div className="absolute bottom-1 right-1 rounded bg-[#34d399] px-1.5 py-0.5 text-[10px] font-bold text-[#0a0a0b]">
                    HD
                  </div>
                )}
                <button
                  onClick={() => removePhoto(photo)}
                  className="absolute right-1 top-1 rounded-lg bg-black/60 p-1.5 text-[#f87171] opacity-0 transition-smooth group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="flex justify-end">
          <Button variant="ghost" onClick={onClose}>
            <X className="mr-1 h-4 w-4" /> Fermer
          </Button>
        </div>
      </div>
    </Modal>
  );
}
