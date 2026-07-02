import { useCallback, useEffect, useState } from 'react'
import { api } from '../api'
import type { AgentConfig, AgentTemplate, ModelOption, SkillInfo } from '../types'

/**
 * Carga los catálogos (modelos, skills, plantillas) y el equipo de agentes,
 * y expone operaciones CRUD que persisten en el backend y refrescan el estado.
 */
export function useOfficeData() {
  const [models, setModels] = useState<ModelOption[]>([])
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const reloadAgents = useCallback(async () => {
    setAgents(await api.getAgents())
  }, [])

  // Refresca skills y plantillas desde el disco (para verlas en tiempo real).
  const reloadCatalogs = useCallback(async () => {
    const [s, t] = await Promise.all([api.getSkills(), api.getTemplates()])
    setSkills(s)
    setTemplates(t)
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const [m, s, t, a] = await Promise.all([
          api.getModels(),
          api.getSkills(),
          api.getTemplates(),
          api.getAgents(),
        ])
        if (cancelled) return
        setModels(m)
        setSkills(s)
        setTemplates(t)
        setAgents(a)
      } catch (err) {
        if (!cancelled) setError((err as Error).message)
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const createAgent = useCallback(
    async (data: Omit<AgentConfig, 'id'>) => {
      await api.createAgent(data)
      await reloadAgents()
    },
    [reloadAgents],
  )

  const updateAgent = useCallback(
    async (id: string, data: Omit<AgentConfig, 'id'>) => {
      await api.updateAgent(id, data)
      await reloadAgents()
    },
    [reloadAgents],
  )

  const deleteAgent = useCallback(
    async (id: string) => {
      await api.deleteAgent(id)
      await reloadAgents()
    },
    [reloadAgents],
  )

  // Recarga la lista de modelos desde Copilot (bajo demanda, no automático).
  const refreshModels = useCallback(async () => {
    const list = await api.refreshModels()
    setModels(list)
    return list
  }, [])

  const createSkill = useCallback(
    async (data: { name: string; body?: string }) => {
      const skill = await api.createSkill(data)
      await reloadCatalogs()
      return skill
    },
    [reloadCatalogs],
  )

  const createTemplate = useCallback(
    async (data: { name: string; body?: string }) => {
      const template = await api.createTemplate(data)
      await reloadCatalogs()
      return template
    },
    [reloadCatalogs],
  )

  return {
    models,
    skills,
    templates,
    agents,
    loading,
    error,
    reloadCatalogs,
    refreshModels,
    createAgent,
    updateAgent,
    deleteAgent,
    createSkill,
    createTemplate,
  }
}
