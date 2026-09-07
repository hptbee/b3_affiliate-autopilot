import type { OptimizationRecommendationEvidence } from '../domain/optimization.js';

export interface OptimizationReasoningItem {
  type: string;
  title: string;
  summary: string;
  priority: string;
  evidence: OptimizationRecommendationEvidence;
}

export interface OptimizationReasoningInput {
  summary: string;
  recommendations: OptimizationReasoningItem[];
}

export interface OptimizationReasoningResult {
  reasoning: string;
}

export interface OptimizationReasoningProvider {
  summarize(input: OptimizationReasoningInput): Promise<OptimizationReasoningResult>;
}
