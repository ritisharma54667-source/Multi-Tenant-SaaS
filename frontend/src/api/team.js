// ============================================================
// TEAM API
// ============================================================
import { apiClient } from './client.js';

export const getTeamMembers = () =>
  apiClient.get('/team').then((r) => r.data);

export const inviteMember = ({ email, role }) =>
  apiClient.post('/team/invite', { email, role }).then((r) => r.data);

export const changeMemberRole = (memberId, role) =>
  apiClient.patch(`/team/${memberId}/role`, { role }).then((r) => r.data);

export const removeMember = (memberId) =>
  apiClient.delete(`/team/${memberId}`).then((r) => r.data);

export const getMyPermissions = () =>
  apiClient.get('/team/permissions').then((r) => r.data);
