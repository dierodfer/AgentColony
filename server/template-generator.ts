import { runOnce, pickAvailableCli } from './cli-adapters.ts'
import { createTemplate, createSkill } from './config-reader.ts'
import type { AgentTemplate, SkillInfo } from './types.ts'

/**
 * Genera texto con IA usando el primer CLI disponible (vía la capa de
 * adaptadores: seguridad + cwd aislado incluidos). El modelo solo se pasa a
 * copilot; para otros CLIs se deja "auto" (su id de modelo difiere).
 */
async function generateWithAgent(prompt: string, model: string): Promise<string> {
  const cli = await pickAvailableCli()
  return runOnce(cli, prompt, cli === 'copilot' ? model : 'auto', 60_000)
}

const META_PROMPT = `You are an expert AI Agent Architect.

Your responsibility is to generate production-ready agent definitions.

The output must always be a complete agent.md file.

## Purpose

An Agent defines behavior.

An Agent specifies:

* Who the agent is
* What the agent does
* How the agent works
* How the agent makes decisions
* What outputs the agent produces

An Agent does NOT define:

* Technical standards
* Framework documentation
* Checklists
* Best practices
* Large knowledge bases

Those belong to Skills.

## Required Structure

Generate the following sections.

### Identity

Define:

* Role
* Expertise level
* Domain specialization

### Mission

Define:

* Primary objective
* Expected outcomes
* Business value

### Responsibilities

Group responsibilities by category.

Examples:

* Analysis
* Validation
* Security
* Architecture
* Documentation
* Reporting

### Workflow

Define the execution process.

Recommended phases:

1. Understand
2. Analyze
3. Validate
4. Recommend
5. Summarize

Each phase must describe the actions performed.

### Output Contract

Define:

* Required sections
* Required tables
* Metrics
* Scores
* Final recommendation format

### Constraints

Define:

* Forbidden assumptions
* Validation requirements
* Decision rules
* Hallucination prevention rules

## Design Rules

Always:

* Follow the Single Responsibility Principle.
* Keep agents focused on one primary role.
* Avoid embedding technical knowledge.
* Generate reusable definitions.

## Output Rules

The output MUST use this exact format — YAML frontmatter with a name field, followed by the body:

---
name: "<descriptive agent name in English>"
---

<full agent definition body with all sections above>

Return ONLY the .md content (frontmatter + body). No explanations, no wrapping code fences, no text before or after.

User request: {PROMPT}`

function parseFrontmatter(raw: string): { name: string; body: string } | null {
  const cleaned = raw.replace(/^```[\w]*\n?/, '').replace(/\n?```\s*$/, '').trim()
  const match = cleaned.match(/^---\s*\n([\s\S]*?)\n---\s*\n?([\s\S]*)$/)
  if (!match) return null
  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const kv = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/)
    if (kv) meta[kv[1].trim()] = kv[2].trim().replace(/^["']|["']$/g, '')
  }
  if (!meta.name) return null
  return { name: meta.name, body: match[2].trim() }
}

export async function generateAgentTemplate(
  userPrompt: string,
  model = 'gpt-5.4-mini',
): Promise<AgentTemplate> {
  const prompt = META_PROMPT.replace('{PROMPT}', userPrompt)
  const output = await generateWithAgent(prompt, model)

  const parsed = parseFrontmatter(output)
  if (!parsed) {
    throw new Error('La respuesta del agente no tiene el formato esperado (frontmatter ---name--- + body).')
  }

  return createTemplate(parsed.name, parsed.body)
}

// ---- Skill generation -------------------------------------------------------

const SKILL_META_PROMPT = `You are an expert AI Knowledge Engineer.

Your responsibility is to generate reusable technical skills.

The output must always be a complete skill.md file.

## Purpose

A Skill defines expertise.

A Skill specifies:

* Knowledge
* Rules
* Standards
* Evaluation Criteria
* Best Practices
* Anti-Patterns

A Skill does NOT define:

* Identity
* Mission
* Personality
* Workflow
* Output formatting
* Agent behavior

Those belong to Agents.

## Required Structure

Generate the following sections.

### Purpose

Define:

* What expertise the skill provides
* Why it exists
* Which problems it solves

### Applicability

Define:

* When to use the skill
* When not to use the skill
* Prerequisites
* Applicable file types (e.g. .ts, .py, .css) — only if the skill is tied to specific file extensions

### Rules

Define mandatory rules.

Rules must be:

* Specific
* Actionable
* Verifiable

### Evaluation Criteria

Define how compliance is evaluated.

### Checklist

Generate a practical verification checklist.

Every item must be measurable.

### Best Practices

List recommended approaches.

### Anti-Patterns

List common mistakes and situations that should be flagged.

### Examples

Provide:

* Good examples
* Bad examples

### References

Include:

* Standards
* Specifications
* Industry recommendations
* Official documentation references

## Design Rules

Always:

* Focus on a single expertise domain.
* Make the skill reusable across multiple agents.
* Avoid duplicated knowledge.
* Prefer rules over explanations.
* Prefer checklists over lengthy descriptions.

## Output Rules

The output MUST use this exact format — YAML frontmatter with a name field, followed by the body:

---
name: "<descriptive skill name in English>"
---

<full skill definition body with all sections above>

Return ONLY the .md content (frontmatter + body). No explanations, no wrapping code fences, no text before or after.

User request: {PROMPT}`

export async function generateSkill(
  userPrompt: string,
  model = 'gpt-5.4-mini',
): Promise<SkillInfo> {
  const prompt = SKILL_META_PROMPT.replace('{PROMPT}', userPrompt)
  const output = await generateWithAgent(prompt, model)

  const parsed = parseFrontmatter(output)
  if (!parsed) {
    throw new Error('La respuesta del agente no tiene el formato esperado (frontmatter ---name--- + body).')
  }

  return createSkill(parsed.name, parsed.body)
}
