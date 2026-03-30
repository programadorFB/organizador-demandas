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
