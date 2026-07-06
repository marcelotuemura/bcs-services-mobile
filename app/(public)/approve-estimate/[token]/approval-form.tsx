'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { approveEstimateByToken, rejectEstimateByToken } from '@/actions/estimate-approval';

interface ApprovalFormProps {
  token: string;
  customerName: string;
  customerEmail: string;
  status: string;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  approvedName?: string | null;
  approvedEmail?: string | null;
  signature?: string | null;
  notes?: string | null;
}

export default function ApprovalForm({
  token,
  customerName,
  customerEmail,
  status,
  approvedAt,
  rejectedAt,
  approvedName,
  approvedEmail,
  signature,
  notes
}: ApprovalFormProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'approve' | 'reject'>('approve');
  const [name, setName] = useState(approvedName || customerName || '');
  const [email, setEmail] = useState(approvedEmail || customerEmail || '');
  const [sig, setSig] = useState(signature || '');
  const [notesInput, setNotesInput] = useState(notes || '');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  async function handleApprove(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await approveEstimateByToken(token, name, email, sig, notesInput);

    if (res.ok) {
      setMessage({ type: 'success', text: res.message });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: res.message || 'An error occurred during approval.' });
    }
    setLoading(false);
  }

  async function handleReject(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const res = await rejectEstimateByToken(token, name, email, notesInput);

    if (res.ok) {
      setMessage({ type: 'success', text: res.message });
      router.refresh();
    } else {
      setMessage({ type: 'error', text: res.message || 'An error occurred during rejection.' });
    }
    setLoading(false);
  }

  if (status === 'approved') {
    return (
      <div className="card glass p-6 border-l-4" style={{ borderColor: 'var(--success)', borderRadius: '18px', background: 'rgba(34, 197, 94, 0.05)' }}>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--success)' }}>
          ✓ Estimate Approved
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted)', marginBottom: '1rem' }}>
          This estimate was approved by <strong>{approvedName}</strong> ({approvedEmail}) on{' '}
          {approvedAt ? new Date(approvedAt).toLocaleDateString() : 'N/A'}.
        </p>
        
        {signature && (
          <div className="mb-4">
            <span style={{ fontSize: '0.85rem', color: 'var(--muted)', display: 'block', marginBottom: '0.25rem' }}>E-Signature:</span>
            <div style={{
              fontFamily: 'cursive, "Brush Script MT", "Caveat", Georgia, serif',
              fontSize: '2rem',
              borderBottom: '2px solid var(--success)',
              display: 'inline-block',
              padding: '0.25rem 1.5rem',
              color: 'var(--success)',
              letterSpacing: '1px'
            }}>
              {signature}
            </div>
          </div>
        )}

        {notes && (
          <div className="mt-4 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>Notes left by customer:</span>
            <p className="text-sm italic mt-1" style={{ margin: 0 }}>&ldquo;{notes}&rdquo;</p>
          </div>
        )}
      </div>
    );
  }

  if (status === 'rejected') {
    return (
      <div className="card glass p-6 border-l-4" style={{ borderColor: 'var(--error)', borderRadius: '18px', background: 'rgba(239, 68, 68, 0.05)' }}>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--error)' }}>
          ✗ Estimate Rejected
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          This estimate was declined by <strong>{approvedName}</strong> ({approvedEmail}) on{' '}
          {rejectedAt ? new Date(rejectedAt).toLocaleDateString() : 'N/A'}.
        </p>

        {notes && (
          <div className="mt-4 p-3 rounded" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid var(--line)' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--muted)', display: 'block' }}>Reason for rejection:</span>
            <p className="text-sm mt-1" style={{ margin: 0 }}>{notes}</p>
          </div>
        )}
      </div>
    );
  }

  if (status === 'expired') {
    return (
      <div className="card glass p-6 border-l-4" style={{ borderColor: 'var(--warning)', borderRadius: '18px', background: 'rgba(245, 158, 11, 0.05)' }}>
        <h3 className="text-xl font-bold flex items-center gap-2 mb-2" style={{ color: 'var(--warning)' }}>
          ⚠ Estimate Expired
        </h3>
        <p className="text-sm" style={{ color: 'var(--muted)', margin: 0 }}>
          This estimate has expired and is no longer open for approval. Please contact Best Coatings Solution.
        </p>
      </div>
    );
  }

  return (
    <div className="card glass p-6" style={{ borderRadius: '18px', background: 'rgba(255,255,255,0.01)', border: '1px solid var(--line)' }}>
      {message && (
        <div className={`notice ${message.type === 'success' ? 'success' : 'error'} mb-4`}>
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-4 mb-6 border-b" style={{ borderColor: 'var(--line)' }}>
        <button
          className={`pb-2 font-semibold text-sm ${activeTab === 'approve' ? 'border-b-2 text-white' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'approve' ? 'var(--accent)' : 'transparent' }}
          onClick={() => setActiveTab('approve')}
        >
          Approve Estimate
        </button>
        <button
          className={`pb-2 font-semibold text-sm ${activeTab === 'reject' ? 'border-b-2 text-white' : 'text-gray-400'}`}
          style={{ borderColor: activeTab === 'reject' ? 'var(--error)' : 'transparent' }}
          onClick={() => setActiveTab('reject')}
        >
          Decline / Request Changes
        </button>
      </div>

      {activeTab === 'approve' ? (
        <form onSubmit={handleApprove} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Your Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder="e.g. Michael Brennan"
              />
            </div>
            <div>
              <label className="label">Your Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="mike.brennan@integrityproperty.com"
              />
            </div>
          </div>

          <div>
            <label className="label">Sign Electronically (Type Name) <span className="text-red-500">*</span></label>
            <input
              type="text"
              className="input w-full"
              value={sig}
              onChange={(e) => setSig(e.target.value)}
              required
              disabled={loading}
              placeholder="e.g. M. Brennan"
              style={{
                fontFamily: sig ? 'cursive, "Brush Script MT", "Caveat", Georgia, serif' : 'inherit',
                fontSize: sig ? '1.5rem' : 'inherit',
                letterSpacing: sig ? '1px' : 'normal'
              }}
            />
          </div>

          <div>
            <label className="label">Optional Notes or Feedback</label>
            <textarea
              className="input w-full"
              rows={3}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              disabled={loading}
              placeholder="Any comments, requests, or instructions..."
            />
          </div>

          <button
            type="submit"
            className="button success w-full py-3 text-base"
            disabled={loading}
            style={{ borderRadius: '12px' }}
          >
            {loading ? 'Submitting Approval...' : 'Approve & Authorize Work'}
          </button>
        </form>
      ) : (
        <form onSubmit={handleReject} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Your Full Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                className="input w-full"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={loading}
                placeholder="e.g. Michael Brennan"
              />
            </div>
            <div>
              <label className="label">Your Email <span className="text-red-500">*</span></label>
              <input
                type="email"
                className="input w-full"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                placeholder="mike.brennan@integrityproperty.com"
              />
            </div>
          </div>

          <div>
            <label className="label">Reason for Rejection <span className="text-red-500">*</span></label>
            <textarea
              className="input w-full"
              rows={4}
              value={notesInput}
              onChange={(e) => setNotesInput(e.target.value)}
              required
              disabled={loading}
              placeholder="Please explain why you are declining or what changes are requested..."
            />
          </div>

          <button
            type="submit"
            className="button secondary w-full py-3 text-base"
            disabled={loading}
            style={{ borderRadius: '12px', background: 'var(--error)', borderColor: 'var(--error)' }}
          >
            {loading ? 'Submitting Rejection...' : 'Submit Rejection / Request Changes'}
          </button>
        </form>
      )}
    </div>
  );
}
