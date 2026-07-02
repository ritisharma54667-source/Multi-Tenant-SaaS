// ============================================================
// CONTACTS PAGE
// ============================================================
import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, User } from 'lucide-react';
import { getContacts, deleteContact } from '../api/crm.js';
import { usePermission } from '../hooks/usePermission.js';
import PermissionGate from '../components/PermissionGate.jsx';
import Modal from '../components/Modal.jsx';
import ContactForm from '../components/crm/ContactForm.jsx';
import { useToast } from '../context/ToastContext.jsx';

const STATUS_BADGE = {
  lead:    'bg-status-warning/15 text-status-warning border-status-warning/30',
  active:  'bg-status-success/15 text-status-success border-status-success/30',
  churned: 'bg-status-error/15 text-status-error border-status-error/30',
};

export default function Contacts() {
  const { can } = usePermission();
  const toast = useToast();

  const [contacts,   setContacts]   = useState([]);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [search,     setSearch]     = useState('');
  const [status,     setStatus]     = useState('');
  const [loading,    setLoading]    = useState(true);
  const [error,      setError]      = useState('');

  // Modal state
  const [modal, setModal] = useState(null); // null | { mode: 'create' | 'edit', contact?: {} }

  const load = useCallback(async (page = 1) => {
    setLoading(true);
    setError('');
    try {
      const data = await getContacts({ page, limit: 20, search, status });
      setContacts(data.contacts);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load contacts.');
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => { load(1); }, [load]);

  function handleSaved(contact) {
    if (modal?.mode === 'create') {
      setContacts((prev) => [contact, ...prev]);
    } else {
      setContacts((prev) => prev.map((c) => (c.id === contact.id ? contact : c)));
    }
    setModal(null);
  }

  async function handleDelete(contact) {
    if (!confirm(`Delete ${contact.name}? This cannot be undone.`)) return;
    try {
      await deleteContact(contact.id);
      setContacts((prev) => prev.filter((c) => c.id !== contact.id));
      toast.success(`${contact.name} deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete contact.');
    }
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Contacts</h1>
          <p className="text-sm text-muted-text mt-1">{pagination.total} total</p>
        </div>
        <PermissionGate permission="create_contact">
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> New contact
          </button>
        </PermissionGate>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-5">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-text" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, company…"
            className="pl-8 pr-4 py-2 text-sm bg-surface-dark border border-white/10 rounded-lg outline-none focus:border-brand w-64"
          />
        </div>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="text-sm bg-surface-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand"
        >
          <option value="">All statuses</option>
          <option value="lead">Lead</option>
          <option value="active">Active</option>
          <option value="churned">Churned</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {/* Table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-muted-text text-sm animate-pulse">Loading contacts…</div>
        ) : contacts.length === 0 ? (
          <div className="p-12 text-center text-muted-text">
            <User size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No contacts yet. Add your first one.</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-muted-text text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Company</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Owner</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {contacts.map((c) => (
                <tr key={c.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                  <td className="px-6 py-4 font-medium">{c.name}</td>
                  <td className="px-6 py-4 text-muted-text">{c.company || '—'}</td>
                  <td className="px-6 py-4 text-muted-text">{c.email || '—'}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_BADGE[c.status]}`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-muted-text">{c.owner_name || '—'}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-2">
                      <PermissionGate permission="edit_contact">
                        <button
                          onClick={() => setModal({ mode: 'edit', contact: c })}
                          className="p-1.5 rounded hover:bg-white/5 text-muted-text hover:text-white transition-colors"
                        >
                          <Pencil size={13} />
                        </button>
                      </PermissionGate>
                      <PermissionGate permission="delete_contact">
                        <button
                          onClick={() => handleDelete(c)}
                          className="p-1.5 rounded hover:bg-status-error/20 text-muted-text hover:text-status-error transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </PermissionGate>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.pages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm text-muted-text">
          <span>Page {pagination.page} of {pagination.pages}</span>
          <div className="flex gap-2">
            <button
              disabled={pagination.page <= 1}
              onClick={() => load(pagination.page - 1)}
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30"
            >
              Prev
            </button>
            <button
              disabled={pagination.page >= pagination.pages}
              onClick={() => load(pagination.page + 1)}
              className="px-3 py-1 rounded border border-white/10 hover:bg-white/5 disabled:opacity-30"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'New contact' : 'Edit contact'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <ContactForm
            initial={modal.contact || null}
            onSave={handleSaved}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}
