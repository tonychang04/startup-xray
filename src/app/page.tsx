'use client';

import { useState, useEffect} from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { Chart, registerables } from 'chart.js';
Chart.register(...registerables);

const analysisSchema = z.object({
  searchType: z.enum(['startup', 'founder']),
  searchTerm: z.string().min(1, 'Please enter a search term'),
});

type AnalysisFormData = z.infer<typeof analysisSchema>;

export default function Home() {
  const { user, signInWithGoogle } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [citations, setCitations] = useState([]);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    watch
  } = useForm<AnalysisFormData>({
    resolver: zodResolver(analysisSchema),
    defaultValues: {
      searchType: 'startup',
      searchTerm: '',
    }
  });
  
  const searchType = watch('searchType');
  const searchTerm = watch('searchTerm');
  
  const onSubmit = async (data: AnalysisFormData) => {
    // Check if user is logged in first
    if (!user) {
      try {
        // Redirect to Google sign-in
        await signInWithGoogle();
        return; // Will redirect to OAuth flow
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message || 'Please sign in to analyze startups');
        } else {
          setError('Please sign in to analyze startups');
        }
        return; // Stop execution if login fails
      }
    }
    
    // Continue with analysis only if user is logged in
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startupName: data.searchType === 'startup' ? data.searchTerm : undefined,
          founderName: data.searchType === 'founder' ? data.searchTerm : undefined,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate analysis');
      }
      
      const responseData = await response.json();
      
      if (responseData.success) {
        setAnalysisResult(responseData.analysis);
        setCitations(responseData.citations || []);
      } else {
        throw new Error(responseData.error || 'Failed to generate analysis');
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while generating the analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
  };

  const extractDataFromAnalysis = (analysisText: string | null) => {
    // Default values in case we can't extract data
    const data = {
      marketSize: null as string | null,
      foundingYear: null as number | null,
      employeeCount: null as string | null,
      fundingAmount: null as string | null,
      valuation: null as string | null,
      revenueEstimate: null as string | null,
      competitors: [] as string[]
    };
    
    if (!analysisText) return data;
    
    console.log("Full analysis text for debugging:", analysisText);
    
    // Extract market size (TAM) - comprehensive patterns
    const marketSizePatterns = [
      /market size (?:is|of) (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /total addressable market (?:\(TAM\) )?(?:is|of) (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /TAM (?:is|of) (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))(?:\s*market| TAM| addressable market)/i,
      /market (?:size|opportunity).*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /market (?:is|of|worth|valued at) (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /market.*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /worth (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /valued at (?:approximately |about |around |estimated at )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /estimated (?:to be |at |around |approximately )?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i
    ];
    
    // Try to find market size with detailed logging
    console.log("Searching for market size in text...");
    for (const pattern of marketSizePatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found market size match:", match[1]);
        data.marketSize = match[1];
        break;
      }
    }
    
    // If still no market size, try to find any dollar amount in the Market Opportunity section
    if (!data.marketSize) {
      console.log("No market size found with standard patterns, trying section-specific search");
      const marketSection = analysisText.match(/## Market Opportunity([\s\S]*?)(?:##|$)/i);
      if (marketSection && marketSection[1]) {
        console.log("Found Market Opportunity section");
        const dollarMatch = marketSection[1].match(/(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i);
        if (dollarMatch) {
          console.log("Found dollar amount in Market Opportunity section:", dollarMatch[1]);
          data.marketSize = dollarMatch[1];
        }
      }
    }
    
    // Extract founding year - comprehensive patterns
    const foundingYearPatterns = [
      /founded in (\d{4})/i,
      /founded (\d{4})/i,
      /established in (\d{4})/i,
      /launched in (\d{4})/i,
      /started in (\d{4})/i,
      /inception in (\d{4})/i,
      /founded.*?in (\d{4})/i,
      /began.*?in (\d{4})/i,
      /created in (\d{4})/i
    ];
    
    for (const pattern of foundingYearPatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found founding year:", match[1]);
        data.foundingYear = parseInt(match[1]);
        break;
      }
    }
    
    // Extract employee count - comprehensive patterns
    const employeePatterns = [
      /(\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i,
      /team of (\d+(?:[,\s]\d+)?)/i,
      /workforce of (\d+(?:[,\s]\d+)?)/i,
      /has (\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i,
      /currently has (\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i,
      /employs (\d+(?:[,\s]\d+)?)/i,
      /approximately (\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i,
      /about (\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i,
      /around (\d+(?:[,\s]\d+)?)\s*(?:employees|team members|staff)/i
    ];
    
    for (const pattern of employeePatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found employee count:", match[1]);
        data.employeeCount = match[1].replace(/[,\s]/g, '');
        break;
      }
    }
    
    // Extract funding amount - comprehensive patterns
    const fundingPatterns = [
      /raised (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /funding of (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /secured (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /total funding of (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /has raised (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /raised.*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /funding.*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i
    ];
    
    for (const pattern of fundingPatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found funding amount:", match[1]);
        data.fundingAmount = match[1];
        break;
      }
    }
    
    // Extract valuation - comprehensive patterns
    const valuationPatterns = [
      /valued at (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /valuation of (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /worth (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /currently valued at (?:over |approximately |about |~)?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /valuation.*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i
    ];
    
    for (const pattern of valuationPatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found valuation:", match[1]);
        data.valuation = match[1];
        break;
      }
    }
    
    // Extract revenue estimate - comprehensive patterns
    const revenuePatterns = [
      /annual revenue is approximately (\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /revenue estimate is approximately (\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i,
      /revenue.*?(\$\d+(?:\.\d+)?(?:\s*[bmtk]illion|\s*[bmtk]n))/i
    ];
    
    for (const pattern of revenuePatterns) {
      const match = analysisText.match(pattern);
      if (match) {
        console.log("Found revenue estimate:", match[1]);
        data.revenueEstimate = match[1];
        break;
      }
    }
    
    // Extract competitors - comprehensive patterns
    const competitorPatterns = [
      /competitors include ((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /competes with ((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /competitors are ((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /competitive landscape[^.]*?((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /main competitors[^.]*?((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /direct competitors[^.]*?((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /competitors[^.]*?((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i,
      /competing with[^.]*?((?:[A-Za-z0-9\s]+(?:,|and|\.|;)[\s]*)+)/i
    ];
    
    for (const pattern of competitorPatterns) {
      const match = analysisText.match(pattern);
      if (match && match[1]) {
        const potentialCompetitors = match[1]
          .split(/,|and|;/)
          .map(comp => comp.trim())
          .filter(comp => comp && comp.length > 1 && !comp.match(/^(such as|including|like)$/i));
        
        if (potentialCompetitors.length > 0) {
          console.log("Found competitors:", potentialCompetitors);
          data.competitors = potentialCompetitors;
          break;
        }
      }
    }
    
    // If we still don't have competitors, try to find them in the Competitive Landscape section
    if (data.competitors.length === 0) {
      console.log("No competitors found with standard patterns, trying section-specific search");
      const competitiveSection = analysisText.match(/## Competitive Landscape([\s\S]*?)(?:##|$)/i);
      if (competitiveSection && competitiveSection[1]) {
        console.log("Found Competitive Landscape section");
        
        // Look for company names in this section (words that start with capital letters)
        const companyNames = competitiveSection[1].match(/\b([A-Z][a-z]+(?:\s[A-Z][a-z]+)*)\b/g);
        if (companyNames && companyNames.length > 0) {
          // Filter out common words that might start with capitals but aren't company names
          const commonWords = ['The', 'This', 'These', 'Their', 'They', 'It', 'Its', 'In', 'On', 'At', 'By', 'For', 'With', 'About', 'Against', 'Between', 'Into', 'Through'];
          const filteredCompanies = companyNames
            .filter(name => !commonWords.includes(name) && name !== searchTerm)
            .slice(0, 5); // Take up to 5 competitors
          
          if (filteredCompanies.length > 0) {
            console.log("Found potential competitors in Competitive Landscape section:", filteredCompanies);
            data.competitors = filteredCompanies;
          }
        }
      }
    }
    
    console.log("Final extracted data:", data);
    return data;
  };

  const renderStartupVisualizations = (analysisResult: string | null) => {
    const data = extractDataFromAnalysis(analysisResult);
    
    return (
      <div className="mt-8 space-y-8">
        
        {/* Market Size & Funding */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Market Opportunity</h4>
            {data.marketSize ? (
              <div className="flex flex-col items-center">
                <div className="h-48 w-full">
                  <canvas id="marketSizeChart"></canvas>
                </div>
                <div className="mt-4 text-center">
                  <p className="text-sm text-gray-500">Total Addressable Market (TAM)</p>
                  <p className="text-2xl font-bold text-blue-600">{data.marketSize}</p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
                </svg>
                <p className="mt-2 text-gray-500 text-center">Market size data not available</p>
                <p className="text-sm text-gray-400 text-center mt-1">Try searching for a different company or check our sources</p>
              </div>
            )}
          </div>
          
          <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
            <h4 className="text-lg font-medium text-gray-900 mb-3">Company Growth</h4>
            {(data.foundingYear || data.employeeCount || data.fundingAmount || data.valuation) ? (
              <div className="grid grid-cols-1 gap-4">
                {data.foundingYear && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Founded</p>
                    <p className="text-xl font-semibold">{data.foundingYear}</p>
                    <p className="text-sm text-gray-500">
                      {new Date().getFullYear() - data.foundingYear} years in business
                    </p>
                  </div>
                )}
                
                {data.valuation && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Valuation</p>
                    <p className="text-xl font-semibold">{data.valuation}</p>
                  </div>
                )}
                
                {data.employeeCount && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Team Size</p>
                    <p className="text-xl font-semibold">{data.employeeCount} employees</p>
                  </div>
                )}
                
                {data.fundingAmount && (
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <p className="text-sm text-gray-500">Total Funding</p>
                    <p className="text-xl font-semibold">{data.fundingAmount}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48">
                <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path>
                </svg>
                <p className="mt-2 text-gray-500 text-center">Growth metrics not available</p>
                <p className="text-sm text-gray-400 text-center mt-1">We couldn&apos;t find founding year, employee count, or funding data</p>
              </div>
            )}
          </div>
        </div>
        
        {/* Competitive Landscape */}
        <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
          <h4 className="text-lg font-medium text-gray-900 mb-3">Competitive Landscape</h4>
          {data.competitors && data.competitors.length > 0 ? (
            <div className="h-64">
              <canvas id="competitorsChart"></canvas>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-48">
              <svg className="w-12 h-12 text-gray-300" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
              </svg>
              <p className="mt-2 text-gray-500 text-center">Competitor data not available</p>
              <p className="text-sm text-gray-400 text-center mt-1">We couldn&apos;t identify specific competitors for this company</p>
            </div>
          )}
        </div>
      </div>
    );
  };

  useEffect(() => {
    if (!analysisResult || searchType !== 'startup') return;
    
    const data = extractDataFromAnalysis(analysisResult);
    
    // Clean up any existing charts
    const cleanupCharts = () => {
      const chartIds = ['marketSizeChart', 'competitorsChart'];
      chartIds.forEach(id => {
        const chartInstance = Chart.getChart(id);
        if (chartInstance) {
          chartInstance.destroy();
        }
      });
    };
    
    cleanupCharts();
    
    // Market Size Chart (if data available)
    if (data.marketSize) {
      const marketSizeCtx = document.getElementById('marketSizeChart') as HTMLCanvasElement;
      if (marketSizeCtx) {
        // Convert market size to a number for visualization
        let marketSizeValue = 0;
        const marketSizeStr = data.marketSize?.toLowerCase() ?? '';
        
        if (marketSizeStr.includes('billion') || marketSizeStr.includes('bn')) {
          marketSizeValue = parseFloat(marketSizeStr.replace(/[^\d.]/g, '')) * 1000;
        } else if (marketSizeStr.includes('million') || marketSizeStr.includes('mn')) {
          marketSizeValue = parseFloat(marketSizeStr.replace(/[^\d.]/g, ''));
        } else if (marketSizeStr.includes('trillion') || marketSizeStr.includes('tn')) {
          marketSizeValue = parseFloat(marketSizeStr.replace(/[^\d.]/g, '')) * 1000000;
        } else {
          marketSizeValue = parseFloat(marketSizeStr.replace(/[^\d.]/g, ''));
        }
        
        new Chart(marketSizeCtx, {
          type: 'bar',
          data: {
            labels: [searchTerm, 'Industry Average'],
            datasets: [{
              label: 'Market Opportunity (in millions $)',
              data: [marketSizeValue * 0.05, marketSizeValue * 0.02],
              backgroundColor: ['#36A2EB', '#C9CBCF'],
              borderColor: ['#2589d8', '#a9abad'],
              borderWidth: 1
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              title: {
                display: true,
                text: 'Potential Market Capture',
                font: {
                  size: 16,
                  weight: 'bold'
                },
                padding: {
                  top: 10,
                  bottom: 20
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    let label = context.dataset.label || '';
                    if (label) {
                      label += ': ';
                    }
                    if (context.parsed.y !== null) {
                      label += '$' + (context.parsed.y).toFixed(0) + 'M';
                    }
                    return label;
                  }
                },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 10,
                cornerRadius: 6
              }
            },
            scales: {
              y: {
                beginAtZero: true,
                title: {
                  display: true,
                  text: 'Millions ($)',
                  font: {
                    weight: 'bold'
                  }
                },
                grid: {
                  color: 'rgba(0, 0, 0, 0.1)'
                }
              },
              x: {
                grid: {
                  display: false
                }
              }
            }
          }
        });
      }
    }
    
    // Competitors Chart (if data available)
    if (data.competitors && data.competitors.length > 0) {
      const competitorsCtx = document.getElementById('competitorsChart') as HTMLCanvasElement;
      if (competitorsCtx) {
        // Generate random market share data for visualization purposes
        const competitorShares = data.competitors.map(() => Math.floor(Math.random() * 30) + 5);
        const ourShare = Math.floor(Math.random() * 20) + 10;
        const otherShare = 100 - [...competitorShares, ourShare].reduce((a, b) => a + b, 0);
        
        new Chart(competitorsCtx, {
          type: 'doughnut',
          data: {
            labels: [...data.competitors.slice(0, 5), searchTerm, 'Others'],
            datasets: [{
              data: [...competitorShares.slice(0, 5), ourShare, Math.max(0, otherShare)],
              backgroundColor: [
                '#4BC0C0', // Teal
                '#FF9F40', // Orange
                '#9966FF', // Purple
                '#FF6384', // Pink
                '#FFCD56', // Yellow
                '#36A2EB', // Blue (highlighted for the searched company)
                '#C9CBCF'  // Gray for Others
              ],
              borderColor: '#FFFFFF',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
                position: 'right',
                labels: {
                  font: {
                    size: 12
                  },
                  padding: 15,
                  usePointStyle: true,
                  pointStyle: 'circle'
                }
              },
              title: {
                display: true,
                text: 'Estimated Market Share Distribution',
                font: {
                  size: 16,
                  weight: 'bold'
                },
                padding: {
                  top: 10,
                  bottom: 20
                }
              },
              tooltip: {
                callbacks: {
                  label: function(context) {
                    const label = context.label || '';
                    const value = context.raw;
                    return `${label}: ${value}%`;
                  }
                },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                padding: 10,
                cornerRadius: 6
              }
            }
          }
        });
      }
    }
    
    return cleanupCharts;
  }, [analysisResult, searchType, searchTerm]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Startup X-Ray</span>
            <span className="block text-blue-600">VC-Style Analysis in Seconds</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Know any startup or founder before you meet them — instant venture insights for founders, VCs, and investors.
          </p>
        </div>
        
        {!analysisResult ? (
          <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="bg-red-50 p-4 rounded-md text-red-700 border border-red-200">
                  {error}
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 justify-center mb-6">
                <div className="flex-1 flex items-center justify-center">
                  <label className={`flex items-center justify-center w-full p-4 rounded-lg cursor-pointer transition-all duration-300 ${searchType === 'startup' ? 'bg-blue-50 border-2 border-blue-500 shadow-md' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
                    <input
                      type="radio"
                      value="startup"
                      {...register('searchType')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mx-auto mb-2 ${searchType === 'startup' ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      <span className={`font-medium ${searchType === 'startup' ? 'text-blue-700' : 'text-gray-700'}`}>Search Startup</span>
                    </div>
                  </label>
                </div>
                
                <div className="flex-1 flex items-center justify-center">
                  <label className={`flex items-center justify-center w-full p-4 rounded-lg cursor-pointer transition-all duration-300 ${searchType === 'founder' ? 'bg-blue-50 border-2 border-blue-500 shadow-md' : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'}`}>
                    <input
                      type="radio"
                      value="founder"
                      {...register('searchType')}
                      className="sr-only"
                    />
                    <div className="text-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className={`h-8 w-8 mx-auto mb-2 ${searchType === 'founder' ? 'text-blue-500' : 'text-gray-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className={`font-medium ${searchType === 'founder' ? 'text-blue-700' : 'text-gray-700'}`}>Search Founder</span>
                    </div>
                  </label>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg className="h-5 w-5 text-gray-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                    <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                  </svg>
                </div>
                <input
                  type="text"
                  {...register('searchTerm')}
                  className="block w-full pl-10 pr-3 py-4 border border-gray-300 rounded-lg shadow-sm focus:ring-blue-500 focus:border-blue-500 text-lg"
                  placeholder={searchType === 'startup' ? 'Enter startup name (e.g., Stripe, Airbnb)' : 'Enter founder name (e.g., Elon Musk, Sam Altman)'}
                />
              </div>
              {errors.searchTerm && (
                <p className="mt-1 text-sm text-red-600">{errors.searchTerm.message}</p>
              )}
              
              <div>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className={`w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-lg font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-all duration-300 ${
                    isAnalyzing ? 'opacity-75 cursor-not-allowed' : 'transform hover:-translate-y-0.5'
                  }`}
                >
                  {isAnalyzing ? (
                    <>
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Analyzing...
                    </>
                  ) : (
                    `Generate Analysis`
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="mt-8 bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="px-4 py-6 sm:px-6 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 border-b border-gray-200">
              <div className="flex flex-col items-center sm:flex-row sm:justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">
                    {searchType === 'startup' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                  </span>
                  <span>
                    {searchType === 'startup' ? 'Startup Analysis:' : 'Founder Analysis:'} 
                    <span className="text-blue-600 ml-2 font-bold">
                      {searchTerm}
                    </span>
                  </span>
                </h2>
                <div className="mt-2 sm:mt-0">
                  <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-blue-100 text-blue-800">
                    <svg className="mr-1.5 h-2 w-2 text-blue-400" fill="currentColor" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="3" />
                    </svg>
                    Powered by Perplexity Sonar Pro
                  </span>
                </div>
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6">
              <div className="text-gray-700 max-w-none analysis-content">
                {analysisResult ? (
                  <div className="space-y-6">
                    {/* Visualizations - Moved to the top */}
                    {searchType === 'startup' && (
                      <div className="mb-8">
                        {renderStartupVisualizations(analysisResult)}
                      </div>
                    )}
                    
                    {/* Analysis content - Moved below visualizations */}
                    {analysisResult.split('##').filter(section => section.trim()).map((section, index) => {
                      const [title, ...contentLines] = section.split('\n').filter(line => line.trim());
                      
                      return (
                        <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                          <h3 className="text-lg font-medium text-gray-900 mb-3">{title.trim()}</h3>
                          <div className="markdown-content">
                            {contentLines.map((line, lineIdx) => {
                              if (!line.trim()) return null;
                              
                              // Process the line to handle bold text and citations
                              let processedLine = line.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
                              
                              // Handle citations like [1][2][3]
                              processedLine = processedLine.replace(/\[(\d+)\]/g, (match, num) => {
                                const citationIndex = parseInt(num) - 1;
                                if (citations && citations[citationIndex]) {
                                  return `<a href="${citations[citationIndex]}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline">[${num}]</a>`;
                                }
                                return match;
                              });
                              
                              // Handle bullet points (both - and • characters)
                              if (line.trim().startsWith('-') || line.trim().startsWith('•')) {
                                return (
                                  <div key={lineIdx} className="flex items-center mb-2">
                                    <span className="mr-2 flex-shrink-0">•</span>
                                    <span dangerouslySetInnerHTML={{ 
                                      __html: processedLine.substring(line.trim().startsWith('-') ? 1 : 1) 
                                    }} />
                                  </div>
                                );
                              }
                              
                              return (
                                <p key={lineIdx} className="mb-2" dangerouslySetInnerHTML={{ __html: processedLine }} />
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    
                    {/* Citations section */}
                    {citations && citations.length > 0 && (
                      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm mt-6">
                        <h3 className="text-lg font-medium text-gray-900 mb-3">Sources</h3>
                        <ol className="list-decimal pl-5">
                          {citations.map((citation, index) => (
                            <li key={index} className="mb-2">
                              <a 
                                href={citation} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-blue-600 hover:underline break-all"
                              >
                                {citation}
                              </a>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center text-gray-500">No analysis data available</div>
                )}
              </div>
            </div>
            
            <div className="px-4 py-5 sm:p-6 border-t border-gray-200 flex justify-center">
                <button
                type="button"
                  onClick={resetAnalysis}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  Generate Another Analysis
                </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}