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

      Analyze the startup "${startupName}" in concise bullet points:
      
      1. Product & Value Proposition: What does the company do? What specific problem(s) do they solve?
      2. Market Opportunity: How large is the addressable market in dollars or users?  Is the market expanding rapidly?  Why now?
      3. Competitive Landscape: List key direct and indirect competitors.? What is ${startupName}'s edge over them?
      4. Business Model: How does ${startupName} generate revenue? What is their pricing model?
      5. Traction & Growth: Evidence of user growth, revenue, partnerships, or notable milestones?
      6. Founders & Team: Who are the founders and key leadership team members? Do they have unique skills or backgrounds that give them an advantage?
      
      Format your response as clean markdown with bullet points. For each section:
      - Use a level 2 heading for the section title (e.g., ## Product & Value Proposition)
      - Use bullet points (- ) for each point, don't bold the bullet points
      - Bold key terms or phrases
      - Keep each bullet point under 20 words
      - Focus on specific facts, avoid generic statements
      - Do not include any additional text between the heading and bullet points`;
    } else if (founderName && !startupName) {
      prompt = `You are an expert startup analyst.

      Analyze the founder "${founderName}" in concise bullet points:
      
      1. Background: Brief education, past ventures, notable achievements.
      2. Founder-Market Fit: Why is ${founderName} well-suited to lead startups in their field?
      3. Track Record: Successes or failures with previous startups? Key learnings?
      4. Leadership Style: What is known about their leadership or management approach?
      5. Vision: What long-term vision or ambitions have they publicly shared?
      6. Network & Investors: Relationships with notable VCs, accelerators, or influential figures?
      7. Risks: Any controversies, execution risks, or concerns?
      8. Investment Potential: Would an investor bet on ${founderName} based on history and leadership?
      
      Format your response as clean markdown with bullet points. For each section:
      - Use a level 2 heading for the section title (e.g., ## Background)
      - Use bullet points (- ) for each point
      - Bold key terms or phrases
      - Keep each bullet point under 15 words
      - Focus on direct, factual, and insightful points
      - Do not include any additional text between the heading and bullet points`;
    } else {
      prompt = `You are an expert startup analyst.

      Analyze the startup "${startupName}" founded by "${founderName}" in concise bullet points:
      
      1. Product & Value Proposition: What specific problem do they solve? How is their product differentiated?
      2. Market Opportunity: How large is their target market? Is the market growing? Why now?
      3. Competitive Landscape: Who are the main competitors? What is ${startupName}'s edge?
      4. Business Model: How does ${startupName} make money? Are margins sustainable?
      5. Traction & Growth: Evidence of user growth, revenue, partnerships, or notable milestones?
      6. Founders & Team: Focus on ${founderName}'s background and leadership. Highlight unique skills.
      7. Risks & Challenges: What factors could prevent ${startupName} from succeeding?
      8. Investment Outlook: Strengths and weaknesses from an investor perspective.
      
      Format your response as clean markdown with bullet points. For each section:
      - Use a level 2 heading for the section title (e.g., ## Product & Value Proposition)
      - Use  at most 3 bullet points (- ) for each point
      - Bold key terms or phrases
      - Keep each bullet point under 15 words
      - Focus on specific facts, avoid generic statements
      - Do not include any additional text between the heading and bullet points`;
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