import { classifyGeminiCandidateFailure, type GeminiFailureCode } from './geminiErrors.ts';

export type GeminiCandidateInspection = {
  candidate: Record<string, unknown>;
  parts: Record<string, unknown>[];
  functionCall?: Record<string, unknown>;
  text: string;
  usable: boolean;
  failure: GeminiFailureCode | '';
};

export function inspectGeminiCandidate(payload: unknown, allowedToolNames: ReadonlySet<string>): GeminiCandidateInspection {
  const root = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {};
  const candidates = Array.isArray(root.candidates) ? root.candidates : [];
  const candidate = candidates[0] && typeof candidates[0] === 'object'
    ? candidates[0] as Record<string, unknown>
    : {};
  const content = candidate.content && typeof candidate.content === 'object'
    ? candidate.content as Record<string, unknown>
    : {};
  const parts = Array.isArray(content.parts)
    ? content.parts.filter((part): part is Record<string, unknown> => Boolean(part && typeof part === 'object'))
    : [];
  const functionCallPart = parts.find((part) => part.functionCall && typeof part.functionCall === 'object');
  const functionCall = functionCallPart?.functionCall as Record<string, unknown> | undefined;
  const toolName = String(functionCall?.name || '').trim();
  const text = String(parts.find((part) => typeof part.text === 'string')?.text || '').trim();
  const usable = Boolean(text || (toolName && allowedToolNames.has(toolName)));
  return {
    candidate,
    parts,
    functionCall,
    text,
    usable,
    failure: usable ? '' : classifyGeminiCandidateFailure(candidate),
  };
}
