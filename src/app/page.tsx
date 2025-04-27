'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

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
    } catch (err: any) {
      setError(err.message || 'An error occurred while generating the analysis');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const resetAnalysis = () => {
    setAnalysisResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
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
              
              {!user && (
                <div className="text-center text-sm text-gray-500 mt-4">
                  <p>Sign in with Google to save your analyses</p>
                </div>
              )}
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
                              
                              // Handle regular text
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
                      <div className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
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
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-400 transition-all duration-200"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2.101a7.002 7.002 0 0111.601 2.566 1 1 0 11-1.885.666A5.002 5.002 0 005.999 7H9a1 1 0 010 2H4a1 1 0 01-1-1V3a1 1 0 011-1zm.008 9.057a1 1 0 011.276.61A5.002 5.002 0 0014.001 13H11a1 1 0 110-2h5a1 1 0 011 1v5a1 1 0 11-2 0v-2.101a7.002 7.002 0 01-11.601-2.566 1 1 0 01.61-1.276z" clipRule="evenodd" />
                </svg>
                Generate Another Analysis
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}