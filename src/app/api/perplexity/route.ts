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
    let session;
    try {
      const cookieStore = await cookies();
      const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('Supabase auth error:', error);
        // Continue without authentication for now
      } else {
        session = data.session;
      }
    } catch (authError) {
      console.error('Error checking authentication:', authError);
      // Continue without authentication for now
    }

    // Initialize Perplexity client
    const client = new OpenAI({
      apiKey: PERPLEXITY_API_KEY,
      baseURL: 'https://api.perplexity.ai',
    });

    // Construct the prompt based on what was provided
    let prompt = '';
    if (startupName && !founderName) {
      prompt = `Analyze startup "${startupName}" in bullet points:
      1. Overview: 3 bullet points on what they do and current status
      2. Market: 3 bullet points on market size and growth
      3. Competition: 3 bullet points on key competitors and advantages
      4. Business Model: 3 bullet points on revenue streams
      5. Team: 3 bullet points on founders and key executives
      6. Risks: 3 bullet points on major challenges
      7. Investment: 3 bullet points on investment potential
      
      Keep each bullet point under 15 words. Be direct and factual.`;
    } else if (founderName && !startupName) {
      prompt = `Analyze founder "${founderName}" in bullet points:
      1. Overview: 3 bullet points on background and ventures
      2. Market: 3 bullet points on markets their startups target
      3. Competition: 3 bullet points on competitive positioning
      4. Business Model: 3 bullet points on how their ventures monetize
      5. Leadership: 3 bullet points on ${founderName}'s leadership style
      6. Risks: 3 bullet points on challenges their ventures face
      7. Investment: 3 bullet points on track record with investors
      
      Keep each bullet point under 15 words. Be direct and factual.`;
    } else {
      prompt = `Analyze startup "${startupName}" by "${founderName}" in bullet points:
      1. Overview: 3 bullet points on what they do and current status
      2. Market: 3 bullet points on market size and growth
      3. Competition: 3 bullet points on key competitors and advantages
      4. Business Model: 3 bullet points on revenue streams
      5. Team: 3 bullet points on ${founderName} and leadership
      6. Risks: 3 bullet points on major challenges
      7. Investment: 3 bullet points on investment potential
      
      Keep each bullet point under 15 words. Be direct and factual.`;
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

  } catch (error: any) {
    console.error('Error calling Perplexity API:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: error.message || 'An error occurred while generating the analysis' 
      },
      { status: 500 }
    );
  }
}

// Helper function to parse the content into sections
function parseContentIntoSections(content: string) {
  // Default structure in case parsing fails
  const defaultSections = {
    overview: '',
    marketOpportunity: '',
    competitiveLandscape: '',
    businessModel: '',
    teamAssessment: '',
    risksAndChallenges: '',
    investmentPotential: ''
  };

  try {
    // Split by common section headers
    const sections = {
      overview: extractSection(content, /(Overview|1\.?\s*Overview)/i, /(Market|2\.?\s*Market)/i),
      marketOpportunity: extractSection(content, /(Market|Market Opportunity|2\.?\s*Market)/i, /(Competition|Competitive|3\.?\s*Competition)/i),
      competitiveLandscape: extractSection(content, /(Competition|Competitive|3\.?\s*Competition)/i, /(Business|4\.?\s*Business)/i),
      businessModel: extractSection(content, /(Business|Business Model|4\.?\s*Business)/i, /(Team|Leadership|5\.?\s*Team)/i),
      teamAssessment: extractSection(content, /(Team|Leadership|5\.?\s*Team)/i, /(Risks|6\.?\s*Risks)/i),
      risksAndChallenges: extractSection(content, /(Risks|Risks and Challenges|6\.?\s*Risks)/i, /(Investment|7\.?\s*Investment)/i),
      investmentPotential: extractSection(content, /(Investment|Investment Potential|7\.?\s*Investment)/i, /$/i)
    };

    // Format each section to ensure bullet points are properly displayed
    return {
      overview: formatBulletPoints(sections.overview),
      marketOpportunity: formatBulletPoints(sections.marketOpportunity),
      competitiveLandscape: formatBulletPoints(sections.competitiveLandscape),
      businessModel: formatBulletPoints(sections.businessModel),
      teamAssessment: formatBulletPoints(sections.teamAssessment),
      risksAndChallenges: formatBulletPoints(sections.risksAndChallenges),
      investmentPotential: formatBulletPoints(sections.investmentPotential)
    };
  } catch (error) {
    console.error('Error parsing content into sections:', error);
    // If parsing fails, return the full content in the overview section
    return {
      ...defaultSections,
      overview: content.trim()
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
  let sectionContent = sectionMatch[0].replace(new RegExp(`^.*?${sectionRegex.source}[:\\s]*`, 'i'), '').trim();
  
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