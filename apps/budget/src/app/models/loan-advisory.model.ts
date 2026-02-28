/**
 * Financial advisory analysis for loan comparisons
 * Provides education about lending practices and predatory tactics
 */

export interface AdvisoryInsight {
  type: 'warning' | 'alert' | 'info' | 'positive';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
}

export interface FinancialAdvisory {
  overallRating: 'poor' | 'fair' | 'marginal' | 'reasonable' | 'good';
  ratingExplanation: string;
  redFlags: AdvisoryInsight[];
  opportunities: AdvisoryInsight[];
  hiddenCosts: AdvisoryInsight[];
  executiveSummary: string;
  recommendation: string;
  educationalNotes: string[];
}
