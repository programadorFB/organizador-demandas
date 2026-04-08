import { isDemoMode, mockSales, mockSalesChat, mockKnowledge, mockKommo } from '../mocks/salesMock';

const API = '/api';

function headers() {
  const h = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('token');
  if (token) h['Authorization'] = `Bearer ${token}`;
  return h;
}

async function request(url, options = {}) {
  const res = await fetch(`${API}${url}`, { ...options, headers: headers() });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Erro na requisição');
  return data;
}

// Auth
export const auth = {
  login: (body) => request('/auth/login', { method: 'POST', body: JSON.stringify(body) }),
  register: (body) => request('/auth/register', { method: 'POST', body: JSON.stringify(body) }),
  me: () => request('/auth/me'),
};

// Demands
export const demands = {
  list: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/demands${qs ? `?${qs}` : ''}`);
  },
  create: (body) => request('/demands', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/demands/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  updateStatus: (id, status) => request(`/demands/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  urgentDecision: (id, approved, note) => request(`/demands/${id}/urgent-decision`, { method: 'PATCH', body: JSON.stringify({ approved, note }) }),
  queue: () => request('/demands/queue'),
  urgentPending: () => request('/demands/urgent/pending'),
  delete: (id) => request(`/demands/${id}`, { method: 'DELETE' }),
  assignSprint: (id, sprint_id) => request(`/demands/${id}/sprint`, { method: 'PATCH', body: JSON.stringify({ sprint_id }) }),
};

// Attachments
export const attachments = {
  list: (demandId) => request(`/demands/${demandId}/attachments`),
  upload: async (demandId, files) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/demands/${demandId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no upload');
    return data;
  },
  delete: (id) => request(`/attachments/${id}`, { method: 'DELETE' }),
  url: (filename) => `${API}/../uploads/${filename}`,
};

// Comments
export const comments = {
  list: (demandId) => request(`/demands/${demandId}/comments`),
  create: (demandId, content) => request(`/demands/${demandId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
};

// Sprints
export const sprints = {
  list: () => request('/sprints'),
  create: (body) => request('/sprints', { method: 'POST', body: JSON.stringify(body) }),
  activate: (id) => request(`/sprints/${id}/activate`, { method: 'PATCH' }),
};

// Users
export const users = {
  list: () => request('/users'),
  updateRole: (id, role) => request(`/users/${id}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
  toggleActive: (id) => request(`/users/${id}/toggle-active`, { method: 'PATCH' }),
};

// Stats
export const stats = {
  get: () => request('/stats'),
};

// Tools
export const tools = {
  list: () => request('/tools'),
  create: (body) => request('/tools', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/tools/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/tools/${id}`, { method: 'DELETE' }),
  summary: () => request('/tools/summary'),
};

// Dashboards
export const dashboards = {
  list: () => request('/dashboards'),
  create: (body) => request('/dashboards', { method: 'POST', body: JSON.stringify(body) }),
  update: (id, body) => request(`/dashboards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id) => request(`/dashboards/${id}`, { method: 'DELETE' }),
  containers: () => request('/infrastructure/containers'),
};

// Scrum
export const scrum = {
  sprints: () => request('/scrum/sprints'),
  createSprint: (body) => request('/scrum/sprints', { method: 'POST', body: JSON.stringify(body) }),
  startSprint: (id) => request(`/scrum/sprints/${id}/start`, { method: 'PATCH' }),
  closeSprint: (id) => request(`/scrum/sprints/${id}/close`, { method: 'PATCH' }),
  burndown: (id) => request(`/scrum/sprints/${id}/burndown`),
  velocity: () => request('/scrum/velocity'),
  notes: (sprintId, type) => request(`/scrum/sprints/${sprintId}/notes${type ? `?type=${type}` : ''}`),
  addNote: (sprintId, type, content) => request(`/scrum/sprints/${sprintId}/notes`, { method: 'POST', body: JSON.stringify({ type, content }) }),
  deleteNote: (id) => request(`/scrum/notes/${id}`, { method: 'DELETE' }),
};

// Design Board
export const design = {
  cards: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/design/cards${qs ? `?${qs}` : ''}`);
  },
  createCard: (body) => request('/design/cards', { method: 'POST', body: JSON.stringify(body) }),
  updateCard: (id, body) => request(`/design/cards/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteCard: (id) => request(`/design/cards/${id}`, { method: 'DELETE' }),
  moveCard: (id, status, comment) => request(`/design/cards/${id}/move`, { method: 'PATCH', body: JSON.stringify({ status, comment }) }),
  checklist: (cardId) => request(`/design/cards/${cardId}/checklist`),
  addCheckItem: (cardId, text, section) => request(`/design/cards/${cardId}/checklist`, { method: 'POST', body: JSON.stringify({ text, section: section || null }) }),
  toggleCheckItem: (id) => request(`/design/checklist/${id}/toggle`, { method: 'PATCH' }),
  deleteCheckItem: (id) => request(`/design/checklist/${id}`, { method: 'DELETE' }),
  reorderChecklist: (items) => request('/design/checklist/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),
  comments: (cardId) => request(`/design/cards/${cardId}/comments`),
  addComment: (cardId, content) => request(`/design/cards/${cardId}/comments`, { method: 'POST', body: JSON.stringify({ content }) }),
  history: (cardId) => request(`/design/cards/${cardId}/history`),
  stats: () => request('/design/stats'),
  analytics: () => request('/design/analytics'),
  designers: () => request('/design/designers'),
  uploadAvatar: async (file) => {
    const form = new FormData();
    form.append('avatar', file);
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/design/avatar`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro');
    return data;
  },
  removeAvatar: () => request('/design/avatar', { method: 'DELETE' }),
  createDesigner: (body) => request('/design/designers', { method: 'POST', body: JSON.stringify(body) }),
  toggleDesigner: (id) => request(`/design/designers/${id}/toggle-active`, { method: 'PATCH' }),
  notifications: () => request('/design/notifications'),
  readAllNotifications: () => request('/design/notifications/read-all', { method: 'PATCH' }),
  unreadCount: () => request('/design/notifications/unread-count'),
  attachments: (cardId) => request(`/design/cards/${cardId}/attachments`),
  uploadAttachments: async (cardId, files) => {
    const form = new FormData();
    files.forEach(f => form.append('files', f));
    const token = localStorage.getItem('token');
    const res = await fetch(`${API}/design/cards/${cardId}/attachments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Erro no upload');
    return data;
  },
  deleteAttachment: (id) => request(`/design/attachments/${id}`, { method: 'DELETE' }),
  toggleVisible: (id) => request(`/design/cards/${id}/visible`, { method: 'PATCH' }),
  links: (cardId) => request(`/design/cards/${cardId}/links`),
  addLink: (cardId, url, label) => request(`/design/cards/${cardId}/links`, { method: 'POST', body: JSON.stringify({ url, label }) }),
  deleteLink: (id) => request(`/design/links/${id}`, { method: 'DELETE' }),
  reorderLinks: (items) => request('/design/links/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),
  reorderAttachments: (items) => request('/design/attachments/reorder', { method: 'PATCH', body: JSON.stringify({ items }) }),
  videoStats: () => request('/design/video-stats'),
  expertVideoStats: () => request('/design/expert-video-stats'),
  getPreferences: () => request('/design/preferences'),
  savePreferences: (prefs) => request('/design/preferences', { method: 'PATCH', body: JSON.stringify(prefs) }),
};

// Sales Panel
const _salesReal = {
  sellers: () => request('/sales/sellers'),
  createSeller: (body) => request('/sales/sellers', { method: 'POST', body: JSON.stringify(body) }),
  toggleSeller: (id) => request(`/sales/sellers/${id}/toggle-active`, { method: 'PATCH' }),
  removeSeller: (id) => request(`/sales/sellers/${id}`, { method: 'DELETE' }),
  updateGoals: (id, body) => request(`/sales/sellers/${id}/goals`, { method: 'PATCH', body: JSON.stringify(body) }),
  stats: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/sales/stats${qs ? `?${qs}` : ''}`);
  },
  monthlySummary: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/sales/monthly-summary${qs ? `?${qs}` : ''}`);
  },
  submitReport: (body) => request('/sales/reports', { method: 'POST', body: JSON.stringify(body) }),
  dashboard: () => request('/sales/seller/dashboard'),
  myReports: (limit) => request(`/sales/my-reports${limit ? `?limit=${limit}` : ''}`),
  sellerReports: (sellerId, params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/sales/sellers/${sellerId}/reports${qs ? `?${qs}` : ''}`);
  },
};

const _salesChatReal = {
  messages: (before) => request(`/sales/chat${before ? `?before=${before}` : ''}`),
  send: (content, reply_to) => request('/sales/chat', { method: 'POST', body: JSON.stringify({ content, reply_to }) }),
  newMessages: (after) => request(`/sales/chat/new?after=${after}`),
  edit: (id, content) => request(`/sales/chat/${id}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  remove: (id) => request(`/sales/chat/${id}`, { method: 'DELETE' }),
  pin: (id) => request(`/sales/chat/${id}/pin`, { method: 'PATCH' }),
  pinned: () => request('/sales/chat/pinned'),
  unread: () => request('/sales/chat/unread'),
  markRead: () => request('/sales/chat/mark-read', { method: 'PATCH' }),
};

const _knowledgeReal = {
  categories: () => request('/knowledge/categories'),
  createCategory: (body) => request('/knowledge/categories', { method: 'POST', body: JSON.stringify(body) }),
  deleteCategory: (id) => request(`/knowledge/categories/${id}`, { method: 'DELETE' }),
  articles: (params = {}) => {
    const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
    return request(`/knowledge/articles${qs ? `?${qs}` : ''}`);
  },
  article: (id) => request(`/knowledge/articles/${id}`),
  createArticle: (body) => request('/knowledge/articles', { method: 'POST', body: JSON.stringify(body) }),
  updateArticle: (id, body) => request(`/knowledge/articles/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deleteArticle: (id) => request(`/knowledge/articles/${id}`, { method: 'DELETE' }),
};

const _kommoReal = {
  getConfig: () => request('/kommo/config'),
  saveConfig: (body) => request('/kommo/config', { method: 'POST', body: JSON.stringify(body) }),
  disconnect: () => request('/kommo/disconnect', { method: 'POST' }),
  getPipelines: () => request('/kommo/pipelines'),
  savePipelineConfig: (body) => request('/kommo/pipeline-config', { method: 'PATCH', body: JSON.stringify(body) }),
  getKommoUsers: () => request('/kommo/users'),
  getUserMap: () => request('/kommo/user-map'),
  mapUser: (kommoUserId, sellerId) => request(`/kommo/user-map/${kommoUserId}`, { method: 'PATCH', body: JSON.stringify({ seller_id: sellerId }) }),
  autoMap: () => request('/kommo/auto-map', { method: 'POST' }),
  sync: (date) => request('/kommo/sync', { method: 'POST', body: JSON.stringify({ date }) }),
  getSyncLogs: () => request('/kommo/sync-logs'),
  getCustomFields: () => request('/kommo/custom-fields'),
  getWebhookStats: () => request('/kommo/webhook-stats'),
  getWebhookEvents: (limit = 50) => request(`/kommo/webhook-events?limit=${limit}`),
};

// Proxy: usa mock se demo_mode ativo, senao usa real
function demoProxy(real, mock) {
  return new Proxy({}, {
    get(_, prop) {
      return (...args) => isDemoMode() ? mock[prop](...args) : real[prop](...args);
    }
  });
}

export const sales = demoProxy(_salesReal, mockSales);
export const kommo = demoProxy(_kommoReal, mockKommo);
export const salesChat = demoProxy(_salesChatReal, mockSalesChat);
export const knowledge = demoProxy(_knowledgeReal, mockKnowledge);
