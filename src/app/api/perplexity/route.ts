import { NextResponse } from 'next/server';
import axios from 'axios';

export async function POST(request: Request) {
  try {
    const { startupName, founderName } = await request.json();
    
    if (!startupName) {
      return NextResponse.json(
        { success: false, error: 'Startup name is required' },
        { status: 400 }
      );
    }

    const prompt = `Generate a comprehensive VC-style analysis for a startup called "${startupName}"${
      founderName ? ` founded by ${founderName}` : ''
    }. 
    
    Structure your response as a JSON object with the following sections:
    1. overview: A brief overview of the startup
    2. marketOpportunity: Analysis of the market opportunity
    3. competitiveLandscape: Analysis of the competitive landscape
    4. businessModel: Analysis of the business model
    5. teamAssessment: Assessment of the founding team
    6. risksAndChallenges: Key risks and challenges
    7. investmentPotential: Investment potential assessment
    
    Each section should be detailed and insightful, providing valuable information for potential investors.`;

    const perplexityResponse = await axios.post(
      'https://api.perplexity.ai/chat/completions',
      {
        model: 'sonar-medium-online',
        messages: [
          {
            role: 'system',
            content: 'You are a venture capital analyst who provides structured analysis of startups.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 2000,
        response_format: { type: 'json_object' }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.PERPLEXITY_API_KEY}`
        }
      }
    );

    // Parse the JSON response from Perplexity
    const analysisContent = JSON.parse(perplexityResponse.data.choices[0].message.content);
    
    return NextResponse.json({
      success: true,
      analysis: analysisContent
    });
  } catch (error: Error | unknown) {
    console.error('Error calling Perplexity API:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to generate analysis',
        details: errorMessage 
      },
      { status: 500 }
    );
  }
} 