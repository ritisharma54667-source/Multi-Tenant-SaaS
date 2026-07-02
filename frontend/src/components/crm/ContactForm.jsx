// ============================================================
// CONTACT FORM — used inside Modal for create and edit
// ============================================================
import { useState } from 'react';
import { createContact, updateContact } from '../../api/crm.js';

const STATUS_OPTIONS = ['lead', 'active', 'churned'];

const STATUS_BADGE = {
  lead:    'bg-status-warning/20 text-status-warning',
  active:  'bg-status-success/20 text-status-success',
  churned: 'bg-status-error/20 text-status-error',
};

const empty = { name: '', email: '', phone: '', company: '', status: 'lead', notes: '' };

export default function ContactForm({ initial = null, onSave, onClose }) {
  const [form, setForm] = useState(initial ? {
    name:    initial.name    || '',
    email:   initial.email   || '',
    phone:   initial.phone   || '',
    company: initial.company || '',
    status:  initial.status  || 'lead',
    notes:   initial.notes   || '',
  } : empty);

  const [error, setError]   = useState('');
  const [saving, setSaving] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const result = initial
        ? await updateContact(initial.id, form)
        : await createContact(form);
      onSave(result.contact);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save contact.');
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

      <div className="grid grid-cols-2 gap-4">
        <Field label="Full name *" value={form.name} onChange={set('name')} required />
        <Field label="Company"     value={form.company} onChange={set('company')} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Field label="Email" type="email" value={form.email} onChange={set('email')} />
        <Field label="Phone"       value={form.phone} onChange={set('phone')} />
      </div>

      <label className="block">
        <span className="text-sm text-muted-text">Status</span>
        <div className="flex gap-2 mt-2">
          {STATUS_OPTIONS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setForm((f) => ({ ...f, status: s }))}
              className={`text-xs px-3 py-1 rounded-full capitalize border transition-colors ${
                form.status === s
                  ? `${STATUS_BADGE[s]} border-transparent`
                  : 'border-white/10 text-muted-text hover:border-white/20'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </label>

      <label className="block">
        <span className="text-sm text-muted-text">Notes</span>
        <textarea
          value={form.notes}
          onChange={set('notes')}
          rows={3}
          className="mt-1 w-full bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm outline-none focus:border-brand resize-none"
        />
      </label>

      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-white/10 hover:bg-white/5">
          Cancel
        </button>
        <button type="submit" disabled={saving} className="btn-primary text-sm">
          {saving ? 'Saving...' : initial ? 'Update contact' : 'Create contact'}
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
