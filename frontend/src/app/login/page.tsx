'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:4000';
      const res = await fetch(`${backendUrl}/api/auth`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        localStorage.setItem('auth_token', token);
        localStorage.setItem('backend_url', backendUrl);
        router.push('/');
      } else {
        const body = await res.json();
        setError(body.error || 'Token non valido');
      }
    } catch {
      setError('Errore di connessione al server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      <div
        className="w-full max-w-sm rounded-2xl p-8"
        style={{ background: 'var(--bg-surface)', border: '1px solid var(--border)' }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-semibold" style={{ color: 'var(--text)' }}>
            Claude Code Mobile
          </h1>
          <p className="text-sm mt-2" style={{ color: 'var(--text-muted)' }}>
            Inserisci il token per accedere
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="Token..."
            value={token}
            onChange={(e) => setToken(e.target.value)}
            className="w-full rounded-xl px-4 py-3 text-base outline-none transition"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
            }}
            autoFocus
          />

          {error && (
            <p className="text-sm mt-3 text-center" style={{ color: 'var(--error)' }}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full rounded-xl py-3 mt-4 font-medium text-base transition disabled:opacity-50"
            style={{
              background: token && !loading ? 'var(--accent)' : 'var(--bg-elevated)',
              color: token && !loading ? '#fff' : 'var(--text-muted)',
            }}
          >
            {loading ? 'Connessione...' : 'Accedi'}
          </button>
        </form>
      </div>
    </div>
  );
}
