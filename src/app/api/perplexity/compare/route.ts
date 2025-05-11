import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(req: NextRequest) {
  try {
    // Get the businesses to compare from the request
    const { businessesString } = await req.json();
    
    const businessNames = businessesString.split(',').map((name: string) => name.trim());
    // Create the prompt for Perplexity with CRITICAL formatting requirements
    const prompt = `You are an expert business analyst. Compare these two companies: ${businessNames[0]} and ${businessNames[1]}.

    Structure your response with 1 section:
    1. Key Metrics:
       - CRITICAL: You MUST state the founding year for each company using this exact format: "${businessNames[0]} was founded in YYYY" and "${businessNames[1]} was founded in YYYY"
       - CRITICAL: You MUST state the total funding for each company using this exact format: "${businessNames[0]} has raised $X million/billion in funding" and "${businessNames[1]} has raised $X million/billion in funding"
       - CRITICAL: You MUST state the latest valuation for each company using this exact format: "${businessNames[0]}'s latest valuation is $X million/billion" and "${businessNames[1]}'s latest valuation is $X million/billion"
       - CRITICAL: You MUST state the employee count for each company using this exact format: "${businessNames[0]} has X employees" and "${businessNames[1]} has X employees"
       - CRITICAL: You MUST state the revenue for each company using this exact format: "${businessNames[0]}'s annual revenue is approximately $X million/billion" and "${businessNames[1]}'s annual revenue is approximately $X million/billion"
       - CRITICAL: You MUST state the growth rate for each company using this exact format: "${businessNames[0]}'s growth rate is X%" and "${businessNames[1]}'s growth rate is X%"
       - CRITICAL: You MUST state the market share for each company using this exact format: "${businessNames[0]}'s market share is X%" and "${businessNames[1]}'s market share is X%"
       - CRITICAL: You MUST state the total addressable market using this exact format: "The total addressable market is $X billion"
       
       If exact data is not available for any metric, provide your best estimate and clearly indicate it's an estimate. It's better to provide an estimate with a disclaimer than to omit CRITICAL data points.
    `;
    
    // Initialize Perplexity client
    const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
    
    if (!perplexityApiKey) {
      return NextResponse.json(
        { success: false, error: 'Perplexity API key is not configured' },
        { status: 500 }
      );
    }
    
    const client = new OpenAI({
      apiKey: perplexityApiKey,
      baseURL: 'https://api.perplexity.ai',
    });
    
    const response = await client.chat.completions.create({
      model: 'sonar-pro',
      messages: [
        { 
          role: 'system', 
          content: 'You are a VC analyst expert at providing concise, insightful comparisons of businesses. You format your responses using Markdown for readability. You ALWAYS include specific metrics in the EXACT format requested, using estimates when necessary.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 2000
    });
    
    const comparison = response.choices[0].message.content;
    
    return NextResponse.json({
      success: true,
      comparison: comparison
    });
    
  } catch (error: any) {
    console.error('Error in comparison API:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 