import { NextRequest, NextResponse } from 'next/server';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources';

// Environment variables
const PERPLEXITY_API_KEY = process.env.PERPLEXITY_API_KEY;

export async function POST(request: NextRequest) {
  try {
    // Parse request body first
    const body = await request.json();
    const { startupName, founderName } = body;

    if (!startupName && !founderName) {
      return NextResponse.json(
        { success: false, error: 'Either startup name or founder name is required' },
        { status: 400 }
      );
    }

    // Initialize Perplexity client
    const client = new OpenAI({
      apiKey: PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });

    // Construct the prompt based on what was provided
    let prompt = '';
    if (startupName && !founderName) {
      prompt = `You are an expert startup analyst.

      Analyze the startup "${startupName}" using sources in concise bullet points:
      
      1. Product & Value Proposition: What does the company do? What specific problem(s) do they solve?
      
      2. Market Opportunity: 
         - CRITICAL: You MUST explicitly state the total addressable market (TAM) size using this exact format: "The market size is $X billion" or "The total addressable market is $X million"
         - If exact market size data is not available, provide your best estimate and indicate it's an estimate
         - Is the market expanding rapidly? At what rate?
         - Why is this market attractive now?
      
      3. Competitive Landscape: 
         - CRITICAL: You MUST list 3-5 direct competitors by name using this exact format: "Competitors include Company A, Company B, Company C"
         - If exact competitor data is not available, list similar companies in the same space
         - What is ${startupName}'s edge over these competitors?
         - How is the market share distributed?
      
      4. Business Model: 
         - How does ${startupName} generate revenue? 
         - What is their pricing model?
         - CRITICAL: Include revenue estimates using this exact format: "Annual revenue is approximately $X million"
         - If exact revenue data is not available, provide your best estimate based on company size, funding, and industry
      
      5. Traction & Growth: 
         - CRITICAL: You MUST state the founding year using this exact format: "Founded in YYYY"
         - CRITICAL: You MUST state the current employee count using this exact format: "Currently has X employees"
         - If exact employee count is not available, provide your best estimate based on company stage and funding
         - Evidence of user growth, partnerships, or notable milestones?
      
      6. Funding History: 
         - CRITICAL: You MUST state the total funding amount using this exact format: "Has raised $X million in funding"
         - If exact funding data is not available, provide your best estimate based on company stage and size
         - List notable investors and funding rounds
      
      7. Founders & Team: Who are the founders and key leadership team members? Do they have unique skills or backgrounds?
      
      Format your response as clean markdown with bullet points. For each section:
      - Use a level 2 heading for the section title (e.g., ## Product & Value Proposition)
      - Use bullet points (- ) for each point
      - Bold key terms or phrases
      - You MUST include the CRITICAL data points in the EXACT format requested
      - If you cannot find the exact information for a CRITICAL data point, make a reasonable estimate and clearly indicate it's an estimate
      - Do not include any additional text between the heading and bullet points
      - Remember: It's better to provide an estimate with a disclaimer than to omit CRITICAL data points`;
    } else if (founderName && !startupName) {
      prompt = `You are an expert startup analyst.

          Analyze the founder "${founderName}" in concise bullet points:

          1. Background: Education, key roles, and notable accomplishments (e.g., exits, patents, publications).
          2. Founder-Market Fit: What unique insights, experiences, or skills connect ${founderName} to this industry?
          3. Track Record: Prior startups or projects — include metrics, exits, or failures with clear takeaways.
          4. Risk Signals: Any red flags, controversies, legal issues, or past execution concerns?
          5. Investment Potential: Would a top-tier VC back ${founderName}? Why or why not?

          Format your response as clean markdown with bullet points. For each section:
          - Use a level 2 heading (e.g., ## Background)
          - Use bullet points (- ) for each insight
          - **Bold** key terms or takeaways
          - Keep each bullet point under 15 words
          - Avoid generalizations; prioritize measurable achievements, facts, and signals of future success
          - Do not include extra text between the heading and bullet points`;
    }

    // Create the messages array with proper typing
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are an expert venture capital analyst with deep knowledge of startups, founders, and investment trends. Provide detailed, insightful analysis based on publicly available information. Format your response in clean markdown."
      },
      {
        role: "user",
        content: prompt
      }
    ];

    // Make the API call to Perplexity
    const response = await client.chat.completions.create({
      model: "sonar-pro",
      messages: messages,
    });
    console.log("Perplexity response:", response);

    // Get the content from the response
    const content = response.choices[0].message.content || '';
    // Extract citations if they exist in the response data
    const citations = ('citations' in response) ? response.citations : null;

    // Log the raw content for debugging
    console.log("Raw content from Perplexity:", content);
    console.log("Citations from Perplexity:", citations);

    // Return the raw markdown content and citations
    return NextResponse.json({
      success: true,
      analysis: content,
      citations: citations
    });

  } catch (error: unknown) {
    console.error('Error calling Perplexity API:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { 
          success: false, 
          error: error.message || 'An error occurred while generating the analysis' 
        },
        { status: 500 }
      );
    } else {
      return NextResponse.json(
        { 
          success: false, 
          error: 'An unknown error occurred while generating the analysis' 
        },
        { status: 500 }
      );
    }
  }
}