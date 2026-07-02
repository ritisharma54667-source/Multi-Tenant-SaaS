// ============================================================
// DEAL FORM — used inside Modal for create and edit
// ============================================================
import { useState } from 'react';
import { createDeal, updateDeal } from '../../api/crm.js';

const STAGES = ['lead', 'qualified', 'proposal', 'negotiation', 'won', 'lost'];

const empty = { title: '', value: '', stage: 'lead', contact_id: '', expected_close_date: '', notes: '' };

export default function DealForm({ initial = null, contacts = [], onSave, onClose }) {
  const [form, setForm] = useState(initial ? {
    title:               initial.title               || '',
    value:               initial.value               ?? '',
    stage:               initial.stage               || 'lead',
    contact_id:          initial.contact_id          || '',
    expected_close_date: initial.expected_close_date ? initial.expected_close_date.slice(0, 10) : '',
    notes:               initial.notes               || '',
  } : empty);

  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const payload = {
        ...form,
        value:      parseFloat(form.value) || 0,
        contact_id: form.contact_id || null,
        expected_close_date: form.expected_close_date || null,
      };
      const result = initial
        ? await updateDeal(initial.id, payload)
        : await createDeal(payload);
      onSave(result.deal);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save deal.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <Field label="Deal title *" value={form.title} onChange={set('title')} required />

      <div className="grid grid-cols-2 gap-4">
        <Field label="Value (₹)" type="number" value={form.value} onChange={set('value')} />
        <Field label="Expected close" type="date" value={form.expected_close_date} onChange={set('expected_close_date')} />
      </div>

      {/* Stage picker */}
      <label className="block">
        <span className="text-sm text-muted-text">Stage</span>
        <div className="flex flex-wrap gap-2 mt-2">
          {STAGES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm((f) => ({ ...f, stage: s }))}
              className={`text-xs px-3 py-1 rounded-full capitalize border transition-colors ${
                form.stage === s
                  ? 'bg-brand/20 text-brand border-brand/40'
                  : 'border-white/10 text-muted-text hover:border-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </label>

      {/* Contact linkage */}
      {contacts.length > 0 && (
        <label className="block">
          <span className="text-sm text-muted-text">Linked contact</span>
          <select
            value={form.contact_id}
            onChange={set('contact_id')}
            className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand"
          >
            <option value="">— none —</option>
            {contacts.map((c) => (
              <option key={c.id} value={c.id}>{c.name} {c.company ? `(${c.company})` : ''}</option>
            ))}
          </select>
        </label>
      )}

      <label className="block">
        <span className="text-sm text-muted-text">Notes</span>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={2}
          className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand resize-none"
        />
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/5">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving...' : initial ? 'Update deal' : 'Create deal'}
        </button>
      </div>
    </form>
  );
}

function Field({ label, value, onChange, type = 'text', required = false }) {
  return (
    <label className="block">
      <span className="text-sm text-muted-text">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        required={required}
        className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand transition-colors"
      />
    </label>
  );
}
