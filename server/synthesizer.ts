import { runOnce, checkAllAvailability } from './cli-adapters.ts'
import type { AgentCli } from './types.ts'

/** Respuesta individual de un especialista dentro de una ronda. */
export interface AnswerInput {
  name: string
  text: string
}

/** Orden de preferencia de CLI para la síntesis (el primero disponible gana). */
const PREFERENCE: AgentCli[] = ['copilot', 'claude', 'opencode']

/**
 * Combina las respuestas de varios especialistas en una conclusión unificada.
 * Lanza un único proceso con un meta-prompt que sintetiza lo dicho por el
 * equipo, usando el primer CLI disponible (preferencia: copilot). Devuelve el
 * texto de la conclusión.
 */
export async function synthesizeAnswers(userPrompt: string, answers: AnswerInput[]): Promise<string> {
  const status = await checkAllAvailability()
  const cli = PREFERENCE.find((c) => status[c]?.available)
  if (!cli) throw new Error('No hay ningún CLI de agente disponible para la síntesis.')

  const block = answers
    .filter((a) => a.text.trim() !== '')
    .map((a) => `- ${a.name}: ${a.text.trim()}`)
    .join('\n')

  const prompt =
    'Eres el moderador de un equipo de especialistas. A partir de la pregunta y ' +
    'de las respuestas de cada especialista, redacta UNA conclusión unificada, ' +
    'equilibrada y accionable. Integra los puntos en común, resuelve o señala los ' +
    'desacuerdos y no te limites a repetir. Responde en 3 o 4 frases, en texto ' +
    'plano, sin markdown, listas ni preámbulos.\n\n' +
    `Pregunta:\n${userPrompt}\n\nRespuestas del equipo:\n${block}`

  // Modelo específico de copilot; para otros CLIs dejamos que elijan por defecto.
  const model = cli === 'copilot' ? 'gpt-5.4-mini' : 'auto'
  return runOnce(cli, prompt, model, 60_000)
}
