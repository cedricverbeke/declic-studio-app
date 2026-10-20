import { useState } from 'react';
import { Aperture, Lock, Loader2 } from 'lucide-react';

const PASSWORD = '160678';
const STORAGE_KEY = 'declic_admin_auth';

export function isAuthenticated(): boolean {
  return sessionStorage.getItem(STORAGE_KEY) === 'ok';
}

export function logout(): void {
  sessionStorage.removeItem(STORAGE_KEY);
}

export function Login() {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      if (password === PASSWORD) {
        sessionStorage.setItem(STORAGE_KEY, 'ok');
        window.location.reload();
      } else {
        setError(true);
        setLoading(false);
      }
    }, 300);
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0b] px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#f5f5f7]">
            <Aperture className="h-7 w-7 text-[#0a0a0b]" />
          </div>
          <div className="text-center">
            <h1 className="text-xl font-bold">Déclic Studio</h1>
            <p className="mt-0.5 text-sm text-[#6b6b75]">Accès réservé au studio</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-2xl border border-[#26262e] bg-[#131316] p-6 space-y-4"
        >
          <div>
            <label className="mb-1.5 block text-sm font-medium text-[#9a9aa5]">
              Mot de passe
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#6b6b75]" />
              <input
                type="password"
                value={password}
                autoFocus
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(false);
                }}
                className="w-full rounded-xl border border-[#33333c] bg-[#0a0a0b] py-2.5 pl-10 pr-4 text-sm text-[#f5f5f7] placeholder:text-[#6b6b75] outline-none transition-smooth focus:border-[#e8c547]/50"
                placeholder="••••••"
              />
            </div>
            {error && (
              <p className="mt-2 text-xs text-[#f87171] animate-fade-in">
                Mot de passe incorrect
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#f5f5f7] py-2.5 text-sm font-medium text-[#0a0a0b] transition-smooth hover:bg-white disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              'Se connecter'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
