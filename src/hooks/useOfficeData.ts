import { useCallback, useEffect, useState } from 'react'
import { api, type CliAvailability } from '../api'
import { CLIS } from '../lib/clis'
import type { AgentCli, AgentConfig, AgentTemplate, MemoryLink, ModelOption, SkillInfo } from '../types'

/** Catálogo de modelos por CLI (vacío hasta recargar los de ese CLI). */
export type ModelsByCli = Partial<Record<AgentCli, ModelOption[]>>

/**
 * Carga los catálogos (modelos, skills, plantillas) y el equipo de agentes,
 * y expone operaciones CRUD que persisten en el backend y refrescan el estado.
 */
export function useOfficeData() {
  const [modelsByCli, setModelsByCli] = useState<ModelsByCli>({})
  const [skills, setSkills] = useState<SkillInfo[]>([])
  const [templates, setTemplates] = useState<AgentTemplate[]>([])
  const [agents, setAgents] = useState<AgentConfig[]>([])
  const [memoryLinks, setMemoryLinks] = useState<MemoryLink[]>([])
  const [cliStatus, setCliStatus] = useState<Record<AgentCli, CliAvailability> | null>(null)
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
        const [s, t, a, links, modelLists] = await Promise.all([
          api.getSkills(),
          api.getTemplates(),
          api.getAgents(),
          api.getMemory(),
          Promise.all(CLIS.map((c) => api.getModels(c.id))),
        ])
        if (cancelled) return
        setSkills(s)
        setTemplates(t)
        setAgents(a)
        setMemoryLinks(links)
        setModelsByCli(Object.fromEntries(CLIS.map((c, i) => [c.id, modelLists[i]])))
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

  // Disponibilidad de CLIs (best-effort, no bloquea la carga inicial).
  useEffect(() => {
    let cancelled = false
    api
      .cliStatus()
      .then((s) => !cancelled && setCliStatus(s))
      .catch(() => {})
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
      // El servidor purga los enlaces del agente borrado: refrescamos.
      setMemoryLinks(await api.getMemory())
    },
    [reloadAgents],
  )

  // Guarda los enlaces de memoria (optimista + persistencia en backend).
  const saveMemoryLinks = useCallback(async (links: MemoryLink[]) => {
    setMemoryLinks(links)
    try {
      setMemoryLinks(await api.saveMemory(links))
    } catch {
      // Si falla, recargamos el estado real del servidor.
      setMemoryLinks(await api.getMemory().catch(() => links))
    }
  }, [])

  // Recarga la lista de modelos del CLI indicado (bajo demanda, no automático).
  const refreshModels = useCallback(async (cli: AgentCli) => {
    const list = await api.refreshModels(cli)
    setModelsByCli((prev) => ({ ...prev, [cli]: list }))
    return list
  }, [])

  const createSkill = useCallback(
    async (data: { name: string; body?: string; applyTo?: string }) => {
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
    modelsByCli,
    skills,
    templates,
    agents,
    memoryLinks,
    cliStatus,
    loading,
    error,
    reloadCatalogs,
    refreshModels,
    createAgent,
    updateAgent,
    deleteAgent,
    saveMemoryLinks,
    createSkill,
    createTemplate,
  }
}
