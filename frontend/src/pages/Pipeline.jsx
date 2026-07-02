// ============================================================
// PIPELINE PAGE — Kanban board
// ============================================================
// Renders deals grouped by stage. Moving a card calls
// PATCH /deals/:id/stage on the backend so stage changes
// persist server-side, not just in local state.
// ============================================================
import { useEffect, useState } from 'react';
import { Plus, Pencil, Trash2, ArrowRight, DollarSign } from 'lucide-react';
import { getKanban, getContacts, moveDealStage, deleteDeal } from '../api/crm.js';
import PermissionGate from '../components/PermissionGate.jsx';
import Modal from '../components/Modal.jsx';
import DealForm from '../components/crm/DealForm.jsx';
import { useToast } from '../context/ToastContext.jsx';

const STAGES = [
  { key: 'lead',        label: 'Lead' },
  { key: 'qualified',   label: 'Qualified' },
  { key: 'proposal',    label: 'Proposal' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'won',         label: 'Won' },
  { key: 'lost',        label: 'Lost' },
];

const STAGE_COLOR = {
  lead:        'border-t-muted-text/40',
  qualified:   'border-t-brand',
  proposal:    'border-t-brand-accent',
  negotiation: 'border-t-status-warning',
  won:         'border-t-status-success',
  lost:        'border-t-status-error',
};

function fmt(n) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n);
}

export default function Pipeline() {
  const toast = useToast();
  const [board,     setBoard]     = useState({});
  const [totals,    setTotals]    = useState({});
  const [contacts,  setContacts]  = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [error,     setError]     = useState('');
  const [modal,     setModal]     = useState(null); // { mode: 'create'|'edit', deal?, defaultStage? }

  useEffect(() => {
    loadBoard();
    // load contacts for the deal form dropdown
    getContacts({ limit: 100 }).then((d) => setContacts(d.contacts)).catch(() => {});
  }, []);

  async function loadBoard() {
    setLoading(true);
    setError('');
    try {
      const data = await getKanban();
      setBoard(data.board);
      setTotals(data.totals);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load pipeline.');
    } finally {
      setLoading(false);
    }
  }

  async function handleMoveStage(deal, newStage) {
    if (deal.stage === newStage) return;
    // Optimistic update
    setBoard((prev) => {
      const next = { ...prev };
      next[deal.stage] = prev[deal.stage].filter((d) => d.id !== deal.id);
      next[newStage]   = [{ ...deal, stage: newStage }, ...(prev[newStage] || [])];
      return next;
    });
    try {
      await moveDealStage(deal.id, newStage);
    } catch (err) {
      // Rollback on failure
      loadBoard();
      toast.error(err.response?.data?.error || 'Could not move deal.');
    }
  }

  async function handleDelete(deal) {
    if (!confirm(`Delete "${deal.title}"?`)) return;
    try {
      await deleteDeal(deal.id);
      setBoard((prev) => ({
        ...prev,
        [deal.stage]: prev[deal.stage].filter((d) => d.id !== deal.id),
      }));
      toast.success(`"${deal.title}" deleted.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not delete deal.');
    }
  }

  function handleSaved(deal) {
    // If editing, swap. If creating, push to its stage column.
    setBoard((prev) => {
      const next = { ...prev };
      if (modal?.mode === 'edit') {
        const oldStage = modal.deal.stage;
        next[oldStage] = (prev[oldStage] || []).filter((d) => d.id !== deal.id);
      }
      next[deal.stage] = [deal, ...(prev[deal.stage] || [])];
      return next;
    });
    setModal(null);
  }

  return (
    <div className="px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold">Pipeline</h1>
        <PermissionGate permission="create_deal">
          <button
            onClick={() => setModal({ mode: 'create' })}
            className="btn-primary flex items-center gap-2"
          >
            <Plus size={16} /> New deal
          </button>
        </PermissionGate>
      </div>

      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {loading ? (
        <div className="text-center py-20 text-muted-text animate-pulse">Loading pipeline…</div>
      ) : (
        /* Board — horizontally scrollable */
        <div className="flex gap-4 overflow-x-auto pb-4">
          {STAGES.map(({ key, label }) => {
            const cards = board[key] || [];
            return (
              <div key={key} className={`flex-shrink-0 w-64 flex flex-col rounded-xl border-t-2 ${STAGE_COLOR[key]} bg-surface-dark border border-white/5`}>
                {/* Column header */}
                <div className="flex items-center justify-between px-3 py-3 border-b border-white/5">
                  <div>
                    <span className="text-sm font-medium">{label}</span>
                    <span className="ml-2 text-xs text-muted-text">{cards.length}</span>
                  </div>
                  <span className="text-xs text-muted-text">{fmt(totals[key] || 0)}</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 p-2 flex-1 min-h-[200px]">
                  {cards.map((deal) => (
                    <DealCard
                      key={deal.id}
                      deal={deal}
                      stages={STAGES}
                      onMove={handleMoveStage}
                      onEdit={() => setModal({ mode: 'edit', deal })}
                      onDelete={() => handleDelete(deal)}
                    />
                  ))}

                  {/* Empty state */}
                  {cards.length === 0 && (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-xs text-muted-text/50 text-center">No deals here</p>
                    </div>
                  )}
                </div>

                {/* Quick add */}
                <PermissionGate permission="create_deal">
                  <button
                    onClick={() => setModal({ mode: 'create', defaultStage: key })}
                    className="flex items-center gap-1 text-xs text-muted-text hover:text-white px-3 py-2 border-t border-white/5 hover:bg-white/3 transition-colors"
                  >
                    <Plus size={12} /> Add deal
                  </button>
                </PermissionGate>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modal && (
        <Modal
          title={modal.mode === 'create' ? 'New deal' : 'Edit deal'}
          onClose={() => setModal(null)}
          size="lg"
        >
          <DealForm
            initial={modal.mode === 'edit' ? modal.deal : (modal.defaultStage ? { stage: modal.defaultStage } : null)}
            contacts={contacts}
            onSave={handleSaved}
            onClose={() => setModal(null)}
          />
        </Modal>
      )}
    </div>
  );
}

// Individual deal card
function DealCard({ deal, stages, onMove, onEdit, onDelete }) {
  const [showMove, setShowMove] = useState(false);

  return (
    <div className="bg-bg-dark rounded-lg p-3 border border-white/5 hover:border-white/10 transition-colors group">
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{deal.title}</p>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
          <PermissionGate permission="edit_deal">
            <button onClick={onEdit} className="p-1 rounded hover:bg-white/5 text-muted-text hover:text-white">
              <Pencil size={11} />
            </button>
          </PermissionGate>
          <PermissionGate permission="delete_deal">
            <button onClick={onDelete} className="p-1 rounded hover:bg-status-error/20 text-muted-text hover:text-status-error">
              <Trash2 size={11} />
            </button>
          </PermissionGate>
        </div>
      </div>

      {deal.contact_name && (
        <p className="text-xs text-muted-text mt-1">{deal.contact_name}</p>
      )}

      <div className="flex items-center justify-between mt-2">
        <span className="text-xs font-medium text-brand-accent">
          {parseFloat(deal.value) > 0 ? fmt(deal.value) : '—'}
        </span>

        {/* Move to stage */}
        <div className="relative">
          <button
            onClick={() => setShowMove((v) => !v)}
            className="flex items-center gap-0.5 text-xs text-muted-text hover:text-white"
          >
            <ArrowRight size={11} />
          </button>
          {showMove && (
            <div className="absolute right-0 bottom-6 w-36 bg-surface-dark border border-white/10 rounded-lg shadow-xl py-1 z-10">
              {stages.filter((s) => s.key !== deal.stage).map((s) => (
                <button
                  key={s.key}
                  onClick={() => { onMove(deal, s.key); setShowMove(false); }}
                  className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5"
                >
                  → {s.label}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {deal.expected_close_date && (
        <p className="text-xs text-muted-text mt-1.5">
          Close: {new Date(deal.expected_close_date).toLocaleDateString('en-IN')}
        </p>
      )}
    </div>
  );
}
