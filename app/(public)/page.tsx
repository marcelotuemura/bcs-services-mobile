import { AuthForm } from '@/components/auth-form';

export default function LoginPage() {
  return (
    <main className="shell-bg auth-layout">
      <section className="hero glass">
        <div>
          <div style={{ marginBottom: '1.5rem' }}>
            <img src="/logo.jpg" alt="BCS Logo" style={{ width: '90px', height: '90px', borderRadius: '22px', objectFit: 'contain', background: '#000', border: '1px solid var(--line)' }} />
          </div>
          <p className="kicker">BCS Services Mobile</p>
          <h1>Run your service company from the field.</h1>
          <p>
            A clean mobile-first operations platform for small mobile service companies. Manage customers,
            assets, jobs, estimates, invoices, and payments without exposing business data before login.
          </p>
        </div>
        <div className="card-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          <div className="notice">Login first</div>
          <div className="notice">Role based</div>
          <div className="notice">Mobile ready</div>
        </div>
      </section>
      <AuthForm />
    </main>
  );
}
