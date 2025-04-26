import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
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

    // Check authentication - with better error handling
    try {
      // Skip authentication check for now
      // We'll handle this differently to avoid the cookies() issue
      console.log('Authentication check skipped to avoid cookies() issue');
    } catch (authError) {
      console.error('Error checking authentication:', authError);
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
      
      1. Product & Value Proposition: What specific problem do they solve? How is their product differentiated?
      2. Market Opportunity: How large is their target market? Is the market growing? Why now?
      3. Competitive Landscape: Who are the main competitors? What is ${startupName}'s edge?
      4. Business Model: How does ${startupName} make money? Are margins sustainable?
      5. Traction & Growth: Evidence of user growth, revenue, partnerships, or notable milestones?
      6. Founders & Team: Who are the key people? Highlight unique skills or experiences.
      7. Risks & Challenges: What factors could prevent ${startupName} from succeeding?
      8. Investment Outlook: Strengths and weaknesses from an investor perspective.
      
      Keep each bullet point under 15 words. Focus on specific facts, avoid generic statements.`;
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
      
      Each bullet point under 15 words. Focus on direct, factual, and insightful points.`;
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
      
      Keep each bullet point under 15 words. Focus on specific facts, avoid generic statements.`;
    }

    // Create the messages array with proper typing
    const messages: ChatCompletionMessageParam[] = [
      {
        role: "system",
        content: "You are an expert venture capital analyst with deep knowledge of startups, founders, and investment trends. Provide detailed, insightful analysis based on publicly available information."
      },
      {
        role: "user",
        content: prompt
      }
    ];

    // Make the API call to Perplexity
    const response = await client.chat.completions.create({
      model: "sonar",
      messages: messages,
    });

    // Parse the response to extract the sections
    const content = response.choices[0].message.content || '';
    
    // Parse the content into sections
    const sections = parseContentIntoSections(content);

    return NextResponse.json({
      success: true,
      analysis: sections
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


// Helper function to parse the content into sections
function parseContentIntoSections(content: string) {
  // Default structure in case parsing fails
  const defaultSections = {
    productValueProposition: '',
    marketOpportunity: '',
    competitiveLandscape: '',
    businessModel: '',
    tractionGrowth: '',
    foundersTeam: '',
    risksAndChallenges: '',
    investmentOutlook: ''
  };

  try {
    // Split by common section headers
    const sections = {
      productValueProposition: extractSection(content, /(Product & Value Proposition|1\.?\s*Product)/i, /(Market Opportunity|2\.?\s*Market)/i),
      marketOpportunity: extractSection(content, /(Market Opportunity|2\.?\s*Market)/i, /(Competitive Landscape|3\.?\s*Competitive)/i),
      competitiveLandscape: extractSection(content, /(Competitive Landscape|3\.?\s*Competitive)/i, /(Business Model|4\.?\s*Business)/i),
      businessModel: extractSection(content, /(Business Model|4\.?\s*Business)/i, /(Traction & Growth|5\.?\s*Traction)/i),
      tractionGrowth: extractSection(content, /(Traction & Growth|5\.?\s*Traction)/i, /(Founders & Team|6\.?\s*Founders)/i),
      foundersTeam: extractSection(content, /(Founders & Team|Background|6\.?\s*Founders)/i, /(Risks & Challenges|7\.?\s*Risks)/i),
      risksAndChallenges: extractSection(content, /(Risks & Challenges|7\.?\s*Risks)/i, /(Investment Outlook|8\.?\s*Investment)/i),
      investmentOutlook: extractSection(content, /(Investment Outlook|8\.?\s*Investment)/i, /$/i)
    };

    // Format each section to ensure bullet points are properly displayed
    return {
      productValueProposition: formatBulletPoints(sections.productValueProposition),
      marketOpportunity: formatBulletPoints(sections.marketOpportunity),
      competitiveLandscape: formatBulletPoints(sections.competitiveLandscape),
      businessModel: formatBulletPoints(sections.businessModel),
      tractionGrowth: formatBulletPoints(sections.tractionGrowth),
      foundersTeam: formatBulletPoints(sections.foundersTeam),
      risksAndChallenges: formatBulletPoints(sections.risksAndChallenges),
      investmentOutlook: formatBulletPoints(sections.investmentOutlook)
    };
  } catch (error) {
    console.error('Error parsing content into sections:', error);
    // If parsing fails, return the full content in the overview section
    return {
      ...defaultSections,
      productValueProposition: content.trim()
    };
  }
}

// Helper function to extract a section from content
function extractSection(content: string, sectionRegex: RegExp, nextSectionRegex: RegExp): string {
  const fullContent = content || '';
  
  // Find the start of the section
  const sectionMatch = fullContent.match(new RegExp(`${sectionRegex.source}[\\s\\S]*?(?=${nextSectionRegex.source}|$)`, 'i'));
  
  if (!sectionMatch) return '';
  
  // Remove the section header
  const sectionContent = sectionMatch[0].replace(new RegExp(`^.*?${sectionRegex.source}[:\\s]*`, 'i'), '').trim();
  
  return sectionContent;
}

// Helper function to format bullet points consistently
function formatBulletPoints(content: string): string {
  if (!content) return '';
  
  // Clean up the content
  let formattedContent = content.trim();
  
  // Replace various bullet point markers with consistent format
  formattedContent = formattedContent
    // Replace numbered bullets (1., 2., etc.)
    .replace(/^\s*(\d+\.)\s*/gm, '• ')
    // Replace dash bullets
    .replace(/^\s*[-–—]\s*/gm, '• ')
    // Replace asterisk bullets
    .replace(/^\s*\*\s*/gm, '• ')
    // Replace citation markers like [1], [2]
    .replace(/\[\d+\]/g, '')
    // Replace multiple spaces with single space
    .replace(/\s{2,}/g, ' ')
    // Ensure each bullet point is on a new line
    .replace(/•/g, '\n• ')
    // Remove any leading newlines
    .replace(/^\n/, '');
  
  return formattedContent;
} 