import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';

export async function POST(req: NextRequest) {
  try {
    // Get the businesses to compare from the request
    const { businessesString } = await req.json();
    
    console.log("Received businessesString:", businessesString);
    
    if (!businessesString || typeof businessesString !== 'string' || businessesString.trim() === '') {
      return NextResponse.json(
        { success: false, error: 'Please provide business names to compare' },
        { status: 400 }
      );
    }
    
    // Extract business names
    const businessNames = businessesString.split(',').map(name => name.trim());
    
    console.log("Extracted business names:", businessNames);
    
    if (businessNames.length !== 2) {
      return NextResponse.json(
        { success: false, error: 'Please provide exactly two businesses to compare (e.g., "Apple,Microsoft")' },
        { status: 400 }
      );
    }
    
    // Create the prompt for Perplexity with structured output format
    const prompt = `You are an expert business analyst. Compare these two companies: ${businessNames[0]} and ${businessNames[1]}.

    CRITICAL: Your response MUST include a machine-readable metrics section in JSON format.
    
    Begin with a brief overview of both companies (2-3 sentences each).
    
    Then include this EXACT text block:
    
    \`\`\`json
    {
      "${businessNames[0]}": {
        "foundingYear": YYYY,
        "funding": X,
        "fundingUnit": "million/billion",
        "valuation": X,
        "valuationUnit": "million/billion/trillion",
        "employees": X,
        "revenue": X,
        "revenueUnit": "million/billion",
        "growthRate": X,
        "marketShare": X,
        "marketSize": X,
        "marketSizeUnit": "billion/trillion"
      },
      "${businessNames[1]}": {
        "foundingYear": YYYY,
        "funding": X,
        "fundingUnit": "million/billion",
        "valuation": X,
        "valuationUnit": "million/billion/trillion",
        "employees": X,
        "revenue": X,
        "revenueUnit": "million/billion",
        "growthRate": X,
        "marketShare": X,
        "marketSize": X,
        "marketSizeUnit": "billion/trillion"
      }
    }
    \`\`\`
    
    Replace YYYY and X with actual numbers. If exact data is not available for any metric, provide your best estimate.
    
    After the JSON block, continue with at most 3 sentences highlighting the key differences between the two companies.`;
    
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
          content: 'You are a VC analyst expert at providing concise, insightful comparisons of businesses. You ALWAYS follow the EXACT format requested for metrics, using estimates when necessary and marking them as such.' 
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1,
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