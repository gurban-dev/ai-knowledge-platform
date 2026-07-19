/**
 * Heuristic prompt-injection detection (OWASP LLM01).
 *
 * The RAG pipeline ingests untrusted documents and accepts untrusted user input,
 * both of which can attempt to override system instructions or exfiltrate data.
 * This guard is a fast, explainable first line of defense: it flags high-signal
 * injection phrases so callers can score, log, quarantine, or strip suspicious
 * spans. It is intentionally conservative to keep false positives low and is
 * complemented by robust prompt construction (untrusted content is always
 * clearly delimited and never concatenated into the system role).
 */

export interface InjectionSignal {
  pattern: string;
  index: number;
}

export interface InjectionScan {
  flagged: boolean;
  /** 0..1 confidence; grows with the number and severity of signals. */
  score: number;
  signals: InjectionSignal[];
}

interface Rule {
  label: string;
  regex: RegExp;
  weight: number;
}

const RULES: Rule[] = [
  { label: 'ignore-previous', regex: /ignore\s+(?:all\s+)?(?:the\s+)?(?:previous|prior|above)\s+(?:instructions|prompts?|context)/i, weight: 0.5 },
  { label: 'disregard', regex: /disregard\s+(?:all\s+)?(?:previous|prior|the\s+above|your)\s+(?:instructions|rules|guidelines)/i, weight: 0.5 },
  { label: 'reveal-system-prompt', regex: /(?:reveal|show|print|repeat|output)\s+(?:your\s+)?(?:system\s+prompt|initial\s+instructions|hidden\s+prompt)/i, weight: 0.5 },
  { label: 'override-role', regex: /you\s+are\s+now\s+(?:a|an|the)\b|from\s+now\s+on\s+you\s+(?:are|will)/i, weight: 0.3 },
  { label: 'developer-mode', regex: /\b(?:developer|dan|jailbreak|god)\s+mode\b/i, weight: 0.4 },
  { label: 'exfiltrate', regex: /(?:send|post|exfiltrate|leak|email)\s+(?:the\s+)?(?:secrets?|api\s*keys?|credentials?|env(?:ironment)?\s+variables?)/i, weight: 0.5 },
  { label: 'end-of-context', regex: /(?:<\|?(?:im_start|im_end|system|endoftext)\|?>|\[\/?INST\])/i, weight: 0.4 },
  { label: 'act-as', regex: /(?:pretend|act)\s+(?:to\s+be|as(?:\s+if)?)\s+(?:you\s+)?(?:have\s+no|are\s+not\s+bound)/i, weight: 0.3 },
];

const FLAG_THRESHOLD = 0.45;

/** Scan text for prompt-injection signals. */
export function scanForInjection(text: string): InjectionScan {
  const signals: InjectionSignal[] = [];
  let weightSum = 0;
  for (const rule of RULES) {
    const match = rule.regex.exec(text);
    if (match) {
      signals.push({ pattern: rule.label, index: match.index });
      weightSum += rule.weight;
    }
  }
  // Saturating score so multiple weak signals can still cross the threshold.
  const score = Math.min(1, weightSum);
  return { flagged: score >= FLAG_THRESHOLD, score: Number(score.toFixed(3)), signals };
}

/** Convenience boolean check. */
export function looksLikeInjection(text: string): boolean {
  return scanForInjection(text).flagged;
}
