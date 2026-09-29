import { useState, useCallback, useRef } from 'react';
import { supabase, type Session, type Photo } from '@/lib/supabase';
import { Button } from '@/components/ui';
import { UploadCloud, FileCheck2, AlertTriangle, Loader2, X } from 'lucide-react';

type MatchResult = {
  filename: string;
  matched: boolean;
  sessionCode?: string;
  photoId?: string;
  error?: string;
};

type Progress = {
  total: number;
  processed: number;
  matched: number;
  unmatched: number;
  results: MatchResult[];
  done: boolean;
};

export function DropZone({ sessions }: { sessions: Session[] }) {
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [allPhotos, setAllPhotos] = useState<Photo[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadPhotos = useCallback(async () => {
    const { data } = await supabase.from('photos').select('*');
    setAllPhotos((data as Photo[]) || []);
    return (data as Photo[]) || [];
  }, []);

  async function handleFiles(files: File[]) {
    if (files.length === 0) return;
    setProgress({ total: files.length, processed: 0, matched: 0, unmatched: 0, results: [], done: false });

    const photos = await loadPhotos();

    // Build a lookup: map of lowercase filename -> photo (with session)
    const photoByFilename = new Map<string, Photo>();
    for (const p of photos) {
      photoByFilename.set(p.filename.toLowerCase(), p);
    }

    // Build session lookup by code
    const sessionByCode = new Map<string, Session>();
    for (const s of sessions) {
      sessionByCode.set(s.code.toLowerCase(), s);
    }

    // Build session lookup by id
    const sessionById = new Map<string, Session>();
    for (const s of sessions) {
      sessionById.set(s.id, s);
    }

    const results: MatchResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const result: MatchResult = { filename: file.name, matched: false };

      // Try to match by filename against known photos
      // Filename could be "IMG_1042.jpg" or "DS-8493/IMG_1042.jpg"
      const parts = file.webkitRelativePath?.split('/') || file.name.split('/');
      const bareFilename = parts[parts.length - 1];
      const pathPrefix = parts.length > 1 ? parts[0] : '';

      const matchedPhoto = photoByFilename.get(bareFilename.toLowerCase());

      if (matchedPhoto) {
        const session = sessionById.get(matchedPhoto.session_id);
        result.matched = true;
        result.sessionCode = session?.code;
        result.photoId = matchedPhoto.id;

        // Upload to hd-photos bucket
        const sessionCode = session?.code || 'unknown';
        const uploadPath = `${sessionCode}/${bareFilename}`;

        const { error: uploadError } = await supabase.storage
          .from('hd-photos')
          .upload(uploadPath, file, { upsert: true });

        if (uploadError) {
          result.error = uploadError.message;
        } else {
          // Mark photo as hd_ready
          await supabase
            .from('photos')
            .update({ hd_ready: true })
            .eq('id', matchedPhoto.id);

          // Check if all photos in related orders are ready -> mark orders as ready
          await checkOrdersReady(matchedPhoto.session_id);
        }
      } else if (pathPrefix && sessionByCode.has(pathPrefix.toLowerCase())) {
        // Match by folder name (session code)
        const session = sessionByCode.get(pathPrefix.toLowerCase())!;
        result.matched = true;
        result.sessionCode = session.code;

        const uploadPath = `${session.code}/${bareFilename}`;
        const { error: uploadError } = await supabase.storage
          .from('hd-photos')
          .upload(uploadPath, file, { upsert: true });

        if (uploadError) {
          result.error = uploadError.message;
        }
      } else {
        result.matched = false;
      }

      results.push(result);
      setProgress((prev) => ({
        ...prev!,
        processed: i + 1,
        matched: results.filter((r) => r.matched).length,
        unmatched: results.filter((r) => !r.matched).length,
        results: [...results],
      }));
    }

    // Final check: update all orders for sessions that had HD uploads
    setProgress((prev) => ({ ...prev!, done: true }));
  }

  async function checkOrdersReady(sessionId: string) {
    // Get all photos for this session
    const { data: sessionPhotos } = await supabase
      .from('photos')
      .select('id, hd_ready')
      .eq('session_id', sessionId);

    if (!sessionPhotos) return;

    const readyPhotoIds = new Set(
      sessionPhotos.filter((p) => p.hd_ready).map((p) => p.id),
    );

    // Get orders for this session that are awaiting_hd
    const { data: orders } = await supabase
      .from('orders')
      .select('id, selected_photos, delivery_status')
      .eq('session_id', sessionId)
      .eq('payment_status', 'paid')
      .eq('delivery_status', 'awaiting_hd');

    if (!orders) return;

    for (const order of orders) {
      const allReady = (order.selected_photos as string[]).every((pid) => readyPhotoIds.has(pid));
      if (allReady && (order.selected_photos as string[]).length > 0) {
        await supabase
          .from('orders')
          .update({ delivery_status: 'ready' })
          .eq('id', order.id);
      }
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const items = e.dataTransfer.items;
    const files: File[] = [];

    if (items && items.length > 0 && typeof items[0].webkitGetAsEntry === 'function') {
      // Directory drop
      const entries: FileSystemEntry[] = [];
      for (let i = 0; i < items.length; i++) {
        const entry = items[i].webkitGetAsEntry();
        if (entry) entries.push(entry);
      }
      traverseEntries(entries, files).then(() => handleFiles(files));
    } else {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        files.push(e.dataTransfer.files[i]);
      }
      handleFiles(files);
    }
  }

  function onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) handleFiles(files);
  }

  function traverseEntries(entries: FileSystemEntry[], files: File[]): Promise<void> {
    const promises = entries.map((entry) => readEntry(entry, files));
    return Promise.all(promises).then(() => {});
  }

  function readEntry(entry: FileSystemEntry, files: File[]): Promise<void> {
    return new Promise((resolve) => {
      if (entry.isFile) {
        (entry as FileSystemFileEntry).file((file) => {
          files.push(file);
          resolve();
        });
      } else if (entry.isDirectory) {
        const reader = (entry as FileSystemDirectoryEntry).createReader();
        const readAll = () => {
          reader.readEntries(async (children) => {
            if (children.length === 0) {
              resolve();
            } else {
              await traverseEntries(children, files);
              readAll();
            }
          });
        };
        readAll();
      } else {
        resolve();
      }
    });
  }

  function reset() {
    setProgress(null);
  }

  const pct = progress ? Math.round((progress.processed / progress.total) * 100) : 0;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Dépôt HD</h1>
        <p className="mt-1 text-sm text-[#9a9aa5]">
          Glissez un dossier de photos HD — l'association est automatique
        </p>
      </div>

      {!progress && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed p-16 transition-smooth ${
            dragging
              ? 'border-[#e8c547] bg-[#e8c547]/5'
              : 'border-[#33333c] bg-[#131316] hover:border-[#404048] hover:bg-[#1a1a1f]'
          }`}
        >
          <UploadCloud className={`mb-4 h-12 w-12 ${dragging ? 'text-[#e8c547]' : 'text-[#6b6b75]'}`} />
          <p className="text-lg font-medium">{dragging ? 'Déposez vos fichiers ici' : 'Glissez-déposez un dossier'}</p>
          <p className="mt-1 text-sm text-[#6b6b75]">ou cliquez pour parcourir — fichiers JPG, PNG, HEIC</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept="image/*"
            // @ts-expect-error webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            directory=""
            className="hidden"
            onChange={onInputChange}
          />
        </div>
      )}

      {progress && (
        <div className="rounded-2xl border border-[#26262e] bg-[#131316] p-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!progress.done ? (
                <Loader2 className="h-5 w-5 animate-spin text-[#e8c547]" />
              ) : (
                <FileCheck2 className="h-5 w-5 text-[#34d399]" />
              )}
              <span className="font-medium">
                {progress.done ? 'Traitement terminé' : 'Traitement en cours…'}
              </span>
            </div>
            {progress.done && (
              <button onClick={reset} className="text-[#6b6b75] hover:text-[#f5f5f7]">
                <X className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="mb-4">
            <div className="mb-2 flex justify-between text-sm">
              <span className="text-[#9a9aa5]">{progress.processed} / {progress.total} fichiers</span>
              <span className="font-semibold">{pct}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-[#0a0a0b]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#e8c547] to-[#34d399] transition-smooth"
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-[#0a0a0b] p-4 text-center">
              <p className="text-2xl font-bold text-[#34d399]">{progress.matched}</p>
              <p className="text-xs text-[#9a9aa5]">Associées</p>
            </div>
            <div className="rounded-xl bg-[#0a0a0b] p-4 text-center">
              <p className="text-2xl font-bold text-[#fbbf24]">{progress.unmatched}</p>
              <p className="text-xs text-[#9a9aa5]">Non reconnues</p>
            </div>
            <div className="rounded-xl bg-[#0a0a0b] p-4 text-center">
              <p className="text-2xl font-bold text-[#f5f5f7]">{progress.total}</p>
              <p className="text-xs text-[#9a9aa5]">Total</p>
            </div>
          </div>

          {progress.unmatched > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-medium text-[#fbbf24]">
                <AlertTriangle className="h-4 w-4" /> Fichiers non reconnus
              </div>
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg bg-[#0a0a0b] p-3">
                {progress.results.filter((r) => !r.matched).map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-[#9a9aa5]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#fbbf24]" />
                    {r.filename}
                  </div>
                ))}
              </div>
            </div>
          )}

          {progress.done && progress.matched > 0 && (
            <div className="mt-4 rounded-xl border border-[#34d399]/20 bg-[#34d399]/10 px-4 py-3 text-sm text-[#34d399]">
              {progress.matched} photo{progress.matched > 1 ? 's' : ''} HD associée{progress.matched > 1 ? 's' : ''} et téléversée{progress.matched > 1 ? 's' : ''}. Les commandes complètes sont marquées « Prêt à livrer ».
            </div>
          )}

          {progress.done && (
            <div className="mt-4 flex gap-2">
              <Button variant="secondary" onClick={reset}>Nouveau dépôt</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
