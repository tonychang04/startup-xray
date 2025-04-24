import axios from 'axios';

const PERPLEXITY_API_URL = 'https://api.perplexity.ai/sonar';

export interface AnalysisRequest {
  startupName: string;
  founderName?: string;
}

export interface AnalysisResponse {
  analysis: {
    overview: string;
    marketOpportunity: string;
    competitiveLandscape: string;
    businessModel: string;
    teamAssessment: string;
    risksAndChallenges: string;
    investmentPotential: string;
  };
}

export async function generateStartupAnalysis(
  request: AnalysisRequest
): Promise<AnalysisResponse> {
  try {
    const response = await axios.post(
      '/api/perplexity',
      request
    );
    
    return response.data;
  } catch (error) {
    console.error('Error generating analysis:', error);
    throw new Error('Failed to generate startup analysis');
  }
} 