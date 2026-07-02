// ============================================================
// TEAM MEMBERS PAGE
// ============================================================
import { useEffect, useState } from 'react';
import { UserPlus, Trash2, ChevronDown } from 'lucide-react';
import { getTeamMembers, inviteMember, changeMemberRole, removeMember } from '../api/team.js';
import { useApp } from '../context/AppContext.jsx';
import { usePermission } from '../hooks/usePermission.js';
import PermissionGate from '../components/PermissionGate.jsx';
import { ROLE_RANK } from '../config/permissions.js';
import { useToast } from '../context/ToastContext.jsx';

const ROLE_OPTIONS = ['viewer', 'member', 'manager', 'admin'];

// Badge colors per role
const ROLE_BADGE = {
  owner:   'bg-brand/20 text-brand border-brand/30',
  admin:   'bg-purple-500/20 text-purple-400 border-purple-500/30',
  manager: 'bg-brand-accent/20 text-brand-accent border-brand-accent/30',
  member:  'bg-status-success/20 text-status-success border-status-success/30',
  viewer:  'bg-white/10 text-muted-text border-white/10',
};

export default function TeamMembers() {
  const { user, tenant } = useApp();
  const { role: myRole, can } = usePermission();
  const toast = useToast();

  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Invite form
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [inviteError, setInviteError] = useState('');
  const [inviteNotice, setInviteNotice] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    loadMembers();
  }, [tenant.id]);

  async function loadMembers() {
    setLoading(true);
    try {
      const data = await getTeamMembers();
      setMembers(data.members);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to load team members.');
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite(e) {
    e.preventDefault();
    setInviteError('');
    setInviteNotice('');
    setInviteLoading(true);
    try {
      const result = await inviteMember({ email: inviteEmail, role: inviteRole });
      if (result.member) {
        setMembers((prev) => [...prev, result.member]);
        setShowInvite(false);
      } else if (result.message) {
        // No account yet — invite email was sent (or logged to console
        // in dev mode). Keep the form open with the notice visible.
        setInviteNotice(result.message);
      }
      setInviteEmail('');
    } catch (err) {
      setInviteError(err.response?.data?.error || 'Failed to send invite.');
    } finally {
      setInviteLoading(false);
    }
  }

  async function handleRoleChange(memberId, newRole) {
    try {
      await changeMemberRole(memberId, newRole);
      setMembers((prev) =>
        prev.map((m) => (m.id === memberId ? { ...m, role: newRole } : m))
      );
      toast.success('Role updated.');
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not change role.');
    }
  }

  async function handleRemove(memberId, memberName) {
    if (!confirm(`Remove ${memberName} from this workspace?`)) return;
    try {
      await removeMember(memberId);
      setMembers((prev) => prev.filter((m) => m.id !== memberId));
      toast.success(`${memberName} removed.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not remove member.');
    }
  }

  return (
    <div className="px-6 py-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold">Team Members</h1>
          <p className="text-sm text-muted-text mt-1">{tenant.name}</p>
        </div>
        <PermissionGate permission="invite_member">
          <button
            onClick={() => setShowInvite((v) => !v)}
            className="btn-primary flex items-center gap-2"
          >
            <UserPlus size={16} /> Invite member
          </button>
        </PermissionGate>
      </div>

      {/* Invite form */}
      {showInvite && (
        <form onSubmit={handleInvite} className="card mb-6 flex flex-col sm:flex-row gap-3">
          <input
            type="email"
            required
            placeholder="Email address"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            className="flex-1 bg-bg-dark border border-white/10 rounded-lg px-3 py-2 outline-none focus:border-brand text-sm"
          />
          <select
            value={inviteRole}
            onChange={(e) => setInviteRole(e.target.value)}
            className="bg-bg-dark border border-white/10 rounded-lg px-3 py-2 text-sm"
          >
            {ROLE_OPTIONS.filter((r) => ROLE_RANK[r] < ROLE_RANK[myRole]).map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
          <button type="submit" disabled={inviteLoading} className="btn-primary text-sm">
            {inviteLoading ? 'Inviting...' : 'Send invite'}
          </button>
          {inviteError && <p className="text-xs text-status-error mt-1">{inviteError}</p>}
          {inviteNotice && <p className="text-xs text-status-success mt-1">{inviteNotice}</p>}
        </form>
      )}

      {/* Error */}
      {error && (
        <p className="text-sm text-status-error bg-status-error/10 border border-status-error/30 rounded-lg px-4 py-3 mb-4">
          {error}
        </p>
      )}

      {/* Members table */}
      <div className="card p-0 overflow-hidden">
        {loading ? (
          <div className="p-6 text-center text-muted-text text-sm animate-pulse">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-muted-text text-xs uppercase tracking-wide">
                <th className="text-left px-6 py-3">Name</th>
                <th className="text-left px-6 py-3">Email</th>
                <th className="text-left px-6 py-3">Role</th>
                <th className="text-left px-6 py-3">Joined</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody>
              {members.map((m) => {
                const isMe = m.user_id === user?.id;
                const canChangeThisRole = can('change_role') && !isMe && ROLE_RANK[m.role] < ROLE_RANK[myRole];
                const canRemoveThis = can('remove_member') && !isMe && ROLE_RANK[m.role] < ROLE_RANK[myRole];

                return (
                  <tr key={m.id} className="border-b border-white/5 last:border-0 hover:bg-white/3 transition-colors">
                    <td className="px-6 py-4 font-medium">
                      {m.name} {isMe && <span className="text-xs text-muted-text">(you)</span>}
                    </td>
                    <td className="px-6 py-4 text-muted-text">{m.email}</td>
                    <td className="px-6 py-4">
                      {canChangeThisRole ? (
                        <RoleSelector
                          value={m.role}
                          onChange={(role) => handleRoleChange(m.id, role)}
                          myRole={myRole}
                        />
                      ) : (
                        <span className={`text-xs px-2 py-1 rounded-full border ${ROLE_BADGE[m.role]}`}>
                          {m.role}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-muted-text">
                      {new Date(m.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {canRemoveThis && (
                        <button
                          onClick={() => handleRemove(m.id, m.name)}
                          className="p-1.5 rounded hover:bg-status-error/20 text-muted-text hover:text-status-error transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* My role chip */}
      <p className="text-xs text-muted-text mt-4">
        Your role in this workspace:{' '}
        <span className={`px-2 py-0.5 rounded-full border text-xs ${ROLE_BADGE[myRole]}`}>
          {myRole}
        </span>
      </p>
    </div>
  );
}

// Inline role selector for members whose role can be changed
function RoleSelector({ value, onChange, myRole }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative inline-block">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full border ${ROLE_BADGE[value]}`}
      >
        {value} <ChevronDown size={10} />
      </button>
      {open && (
        <div className="absolute left-0 mt-1 w-32 bg-surface-dark border border-white/10 rounded-lg shadow-xl py-1 z-10">
          {ROLE_OPTIONS.filter((r) => ROLE_RANK[r] < ROLE_RANK[myRole]).map((r) => (
            <button
              key={r}
              onClick={() => { onChange(r); setOpen(false); }}
              className="w-full text-left px-3 py-1.5 text-xs hover:bg-white/5"
            >
              {r}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
