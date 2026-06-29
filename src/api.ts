import type { AgentConfig, AgentTemplate, ModelOption, SkillInfo } from './types'

// Wrappers tipados sobre las rutas REST que expone el plugin de Vite.

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`)
  return res.json() as Promise<T>
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
  if (!res.ok) {
    const data = await res.json().catch(() => ({}))
    throw new Error((data as { error?: string }).error || `${method} ${url} → ${res.status}`)
  }
  return (res.status === 204 ? undefined : await res.json()) as T
}

export const api = {
  getModels: () => getJson<ModelOption[]>('/api/models'),
  getSkills: () => getJson<SkillInfo[]>('/api/skills'),
  getTemplates: () => getJson<AgentTemplate[]>('/api/templates'),
  getAgents: () => getJson<AgentConfig[]>('/api/agents'),

  createAgent: (data: Omit<AgentConfig, 'id'>) =>
    sendJson<AgentConfig>('/api/agents', 'POST', data),
  updateAgent: (id: string, data: Omit<AgentConfig, 'id'>) =>
    sendJson<AgentConfig>(`/api/agents/${encodeURIComponent(id)}`, 'PUT', data),
  deleteAgent: (id: string) =>
    sendJson<void>(`/api/agents/${encodeURIComponent(id)}`, 'DELETE'),

  createSkill: (data: { name: string; body?: string }) =>
    sendJson<SkillInfo>('/api/skills', 'POST', data),
  generateSkill: (data: { prompt: string; model?: string }) =>
    sendJson<SkillInfo>('/api/skills/generate', 'POST', data),
  getSkillBody: (id: string) =>
    getJson<{ body: string }>(`/api/skills/${encodeURIComponent(id)}`),
  updateSkill: (id: string, data: { name: string; body: string }) =>
    sendJson<SkillInfo>(`/api/skills/${encodeURIComponent(id)}`, 'PUT', data),
  deleteSkill: (id: string) =>
    sendJson<void>(`/api/skills/${encodeURIComponent(id)}`, 'DELETE'),

  createTemplate: (data: { name: string; body?: string }) =>
    sendJson<AgentTemplate>('/api/templates', 'POST', data),
  getTemplateBody: (file: string) =>
    getJson<{ body: string }>(`/api/templates/${encodeURIComponent(file)}`),
  updateTemplate: (file: string, data: { name: string; body: string }) =>
    sendJson<AgentTemplate>(`/api/templates/${encodeURIComponent(file)}`, 'PUT', data),
  deleteTemplate: (file: string) =>
    sendJson<void>(`/api/templates/${encodeURIComponent(file)}`, 'DELETE'),

  generateTemplate: (data: { prompt: string; model?: string }) =>
    sendJson<AgentTemplate>('/api/templates/generate', 'POST', data),
}
