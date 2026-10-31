import OpenAI from 'openai'
import { z } from 'zod'
import type { ReportEvidence } from './reportValidator.js'
import { askFarmer, askFarmerInputSchema, askFarmerOutputSchema } from './tools/askFarmer.js'
import { checkSafety, checkSafetyInputSchema, checkSafetyOutputSchema } from './tools/checkSafety.js'
import {
  finalizeReport,
  finalizeReportInputSchema,
  finalizeReportOutputSchema,
} from './tools/finalizeReport.js'
import {
  inspectScan,
  inspectScanInputSchema,
  inspectScanOutputSchema,
} from './tools/inspectScan.js'
import {
  lookupGuidance,
  lookupGuidanceInputSchema,
  lookupGuidanceOutputSchema,
} from './tools/lookupGuidance.js'
import type { AgentSession, StoredScan } from './types.js'

export interface ToolContext {
  session: AgentSession
  scan: StoredScan | null
  evidence: ReportEvidence
  callId: string
}

interface RegisteredTool {
  name: string
  description: string
  inputSchema: z.ZodType
  outputSchema: z.ZodType
  execute: (rawInput: unknown, context: ToolContext) => Promise<unknown>
}

function registerTool<Input extends z.ZodType, Output extends z.ZodType>(
  name: string,
  description: string,
  inputSchema: Input,
  outputSchema: Output,
  execute: (
    input: z.infer<Input>,
    context: ToolContext,
  ) => unknown | Promise<unknown>,
): RegisteredTool {
  return {
    name,
    description,
    inputSchema,
    outputSchema,
    execute: async (rawInput, context) =>
      execute(inputSchema.parse(rawInput), context),
  }
}

const tools: RegisteredTool[] = [
  registerTool(
    'inspect_scan',
    'Read the original, validated SAM scan observations for this case. This tool cannot alter the scan.',
    inspectScanInputSchema,
    inspectScanOutputSchema,
    ({ scan_id }, { session, scan }) => inspectScan({ scan_id }, session, scan),
  ),
  registerTool(
    'ask_farmer',
    'Save and ask one focused follow-up question, then pause the investigation until the farmer answers.',
    askFarmerInputSchema,
    askFarmerOutputSchema,
    (input, { session, callId }) => askFarmer(input, session, callId),
  ),
  registerTool(
    'lookup_guidance',
    'Search the curated rice guidance records. Clearly distinguish symptom-specific evidence from institutional referral records, and return no-evidence when no relevant agronomic passage exists.',
    lookupGuidanceInputSchema,
    lookupGuidanceOutputSchema,
    (input, { session }) => lookupGuidance(input, session),
  ),
  registerTool(
    'check_safety',
    'Run deterministic checks on a proposed report against retrieved sources and the original scan.',
    checkSafetyInputSchema,
    checkSafetyOutputSchema,
    (input, { evidence }) => checkSafety(input, evidence),
  ),
  registerTool(
    'finalize_report',
    'Validate and create the structured report. The backend checks it against original scan and retrieved evidence.',
    finalizeReportInputSchema,
    finalizeReportOutputSchema,
    (input, { evidence }) => finalizeReport(input, evidence),
  ),
]

const toolsByName = new Map(tools.map((tool) => [tool.name, tool]))

export const responseTools: OpenAI.Responses.FunctionTool[] = tools.map(
  ({ name, description, inputSchema }) => ({
    type: 'function',
    name,
    description,
    parameters: z.toJSONSchema(inputSchema),
    strict: true,
  }),
)

export interface ToolExecutionResult {
  output: string
  status: 'success' | 'failure' | 'blocked'
  evidenceReferenceIds: string[]
  summary: string
}

function outputEvidenceIds(name: string, value: unknown): string[] {
  if (
    name !== 'lookup_guidance' ||
    !value ||
    typeof value !== 'object' ||
    !('results' in value) ||
    !Array.isArray(value.results)
  ) {
    return []
  }

  return value.results.flatMap((source) =>
    source &&
    typeof source === 'object' &&
    'id' in source &&
    typeof source.id === 'string'
      ? [source.id]
      : [],
  )
}

export async function executeToolCall(
  name: string,
  argumentsJson: string,
  context: ToolContext,
): Promise<ToolExecutionResult> {
  const tool = toolsByName.get(name)
  if (!tool) {
    return {
      output: JSON.stringify({ error: 'Unknown tool. Do not retry this call.' }),
      status: 'blocked',
      evidenceReferenceIds: [],
      summary: 'Rejected an unknown tool call.',
    }
  }

  let rawInput: unknown
  try {
    rawInput = JSON.parse(argumentsJson) as unknown
  } catch {
    return {
      output: JSON.stringify({ error: 'Tool arguments must be valid JSON.' }),
      status: 'failure',
      evidenceReferenceIds: [],
      summary: `Rejected invalid arguments for ${name}.`,
    }
  }

  const input = tool.inputSchema.safeParse(rawInput)
  if (!input.success) {
    return {
      output: JSON.stringify({
        error: 'Tool arguments did not match the registered schema.',
        issues: input.error.issues.slice(0, 8).map((issue) => ({
          path: issue.path.join('.'),
          code: issue.code,
        })),
      }),
      status: 'failure',
      evidenceReferenceIds: [],
      summary: `Rejected invalid arguments for ${name}.`,
    }
  }

  try {
    const result = await tool.execute(input.data, context)
    const output = tool.outputSchema.safeParse(result)
    if (!output.success) {
      return {
        output: JSON.stringify({ error: 'Tool output validation failed.' }),
        status: 'failure',
        evidenceReferenceIds: [],
        summary: `Could not validate the ${name} result.`,
      }
    }

    const evidenceReferenceIds =
      name === 'inspect_scan'
        ? ['scan-observations']
        : outputEvidenceIds(name, output.data)

    return {
      output: JSON.stringify(output.data),
      status: 'success',
      evidenceReferenceIds,
      summary: {
        inspect_scan: 'Loaded validated scan observations.',
        ask_farmer: 'Saved a focused follow-up question.',
        lookup_guidance: evidenceReferenceIds.length
          ? 'Searched curated agricultural reference records.'
          : 'Searched references; no relevant evidence was available.',
        check_safety: 'Checked report claims against available evidence.',
        finalize_report: 'Validated the structured investigation report.',
      }[name] ?? 'Completed a registered tool action.',
    }
  } catch {
    return {
      output: JSON.stringify({
        error: 'The tool could not complete using the supplied case data.',
      }),
      status: 'failure',
      evidenceReferenceIds: [],
      summary: `The ${name} action could not be completed.`,
    }
  }
}

export function getToolNames(): string[] {
  return tools.map((tool) => tool.name)
}
