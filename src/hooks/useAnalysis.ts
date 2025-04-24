import { useState } from 'react';
import { generateStartupAnalysis, AnalysisRequest, AnalysisResponse } from '@/lib/perplexity';

export function useAnalysis() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);

  const analyzeStartup = async (request: AnalysisRequest) => {
    setLoading(true);
    setError(null);
    
    try {
      const result = await generateStartupAnalysis(request);
      setAnalysis(result);
      return result;
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to generate analysis';
      setError(errorMessage);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const saveAnalysis = async (startupId: string, analysisData: AnalysisResponse) => {
    try {
      const response = await fetch('/api/analyses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ startupId, analysisData }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to save analysis');
      }
      
      return await response.json();
    } catch (err: Error | unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to save analysis';
      setError(errorMessage);
      throw err;
    }
  };

  return {
    loading,
    error,
    analysis,
    analyzeStartup,
    saveAnalysis,
  };
} 