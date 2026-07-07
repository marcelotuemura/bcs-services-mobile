'use client';

import { useActionState, useState } from 'react';
import { signIn, signUp, resetPassword, type ActionState } from '@/actions/auth';

const initialState: ActionState = { ok: false, message: '' };

export function AuthForm() {
  const [mode, setMode] = useState<'signin' | 'signup' | 'reset'>('signin');
  const action = mode === 'signup' ? signUp : mode === 'reset' ? resetPassword : signIn;
  const [state, formAction, pending] = useActionState(action, initialState);

  return (
    <form key={mode} action={formAction} className="login-card glass form-stack">
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem' }}>
        <img src="/logo.jpg" alt="BCS Logo" style={{ width: '80px', height: '80px', borderRadius: '20px', objectFit: 'contain', background: '#000', border: '1px solid var(--line)' }} />
      </div>
      <div>
        <p className="kicker" style={{ textAlign: 'center', margin: 0 }}>Secure access</p>
        <h2 style={{ margin: '0.4rem 0 0.35rem', fontSize: '2rem' }}>
          {mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Create company' : 'Reset password'}
        </h2>
        <p style={{ color: 'var(--muted)', marginTop: 0 }}>
          {mode === 'signin'
            ? 'Sign in to manage service work, customers, assets, estimates, and invoices.'
            : mode === 'signup'
              ? 'Start a clean workspace for your mobile service business.'
              : 'Send yourself a reset link.'}
        </p>
      </div>

      {mode === 'signup' && (
        <div>
          <label className="label" htmlFor="companyName">Company name</label>
          <input className="input" id="companyName" name="companyName" placeholder="Best Coatings Solution" required />
        </div>
      )}

      <div>
        <label className="label" htmlFor="email">Email</label>
        <input className="input" id="email" name="email" type="email" placeholder="you@company.com" required />
      </div>

      {mode !== 'reset' && (
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input className="input" id="password" name="password" type="password" placeholder="••••••••" required minLength={6} />
        </div>
      )}

      {state.message && <div className={`notice ${state.ok ? 'success' : 'error'}`}>{state.message}</div>}

      <button className="button" disabled={pending} type="submit">
        {pending ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}
      </button>

      <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap', color: 'var(--muted)', fontSize: '.95rem' }}>
        {mode !== 'signin' && <button className="button secondary" type="button" onClick={() => setMode('signin')}>Back to sign in</button>}
        {mode !== 'signup' && <button className="button secondary" type="button" onClick={() => setMode('signup')}>Create account</button>}
        {mode !== 'reset' && <button className="button secondary" type="button" onClick={() => setMode('reset')}>Forgot password</button>}
      </div>
    </form>
  );
}
