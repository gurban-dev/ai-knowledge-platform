/**
 * Lightweight citation grounding / abstention helpers.
 * Production systems may swap in an NLI model; this heuristic catches the
 * common "answer claims facts absent from retrieved context" failure mode.
 */

export interface GroundingResult {
  grounded: boolean;
  confidence: number;
  unsupportedClaims: string[];
}

/** Extract simple noun-ish tokens for overlap checks. */
function tokens(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length >= 4),
  );
}

/**
 * Score how well `answer` is supported by `contexts`. Returns low confidence
 * when the answer introduces many terms absent from retrieved context —
 * a signal to abstain rather than hallucinate.
 */
export function assessGrounding(answer: string, contexts: string[]): GroundingResult {
  if (!answer.trim()) {
    return { grounded: false, confidence: 0, unsupportedClaims: ['empty answer'] };
  }
  if (contexts.length === 0) {
    return {
      grounded: false,
      confidence: 0,
      unsupportedClaims: ['no retrieved context'],
    };
  }

  const contextTokens = tokens(contexts.join(' '));
  const answerTokens = [...tokens(answer)];
  if (answerTokens.length === 0) {
    return { grounded: true, confidence: 1, unsupportedClaims: [] };
  }

  const unsupported = answerTokens.filter((t) => !contextTokens.has(t));
  const overlap = 1 - unsupported.length / answerTokens.length;
  const confidence = Number(Math.max(0, Math.min(1, overlap)).toFixed(4));
  const grounded = confidence >= 0.35;

  return {
    grounded,
    confidence,
    unsupportedClaims: grounded ? [] : unsupported.slice(0, 12),
  };
}

/** Decide whether to abstain based on retrieval + grounding confidence. */
export function shouldAbstain(params: {
  topScore: number;
  groundingConfidence: number;
  minRetrievalScore?: number;
  minGroundingConfidence?: number;
}): boolean {
  const minRetrieval = params.minRetrievalScore ?? 0.12;
  const minGrounding = params.minGroundingConfidence ?? 0.35;
  return params.topScore < minRetrieval || params.groundingConfidence < minGrounding;
}

export const ABSTENTION_MESSAGE =
  "I don't have enough grounded information in the organization's knowledge base to answer confidently. Please refine the question or add relevant documents.";
