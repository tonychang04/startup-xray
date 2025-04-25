'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const analysisSchema = z.object({
  startupName: z.string().min(1, 'Startup name is required'),
  founderName: z.string().optional(),
});

type AnalysisFormData = z.infer<typeof analysisSchema>;

interface AnalysisResult {
  overview: string;
  marketOpportunity: string;
  competitiveLandscape: string;
  businessModel: string;
  teamAssessment: string;
  risksAndChallenges: string;
  investmentPotential: string;
}

export default function Home() {
  const { user, signInWithGoogle } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset
  } = useForm<AnalysisFormData>({
    resolver: zodResolver(analysisSchema),
  });
  
  const onSubmit = async (data: AnalysisFormData) => {
    if (!user) {
      try {
        await signInWithGoogle();
        return; // Will redirect to OAuth flow
      } catch (err: any) {
        setError('Please sign in to analyze startups');
        return;
      }
    }
    
    setIsAnalyzing(true);
    setError(null);
    
    try {
      const response = await fetch('/api/perplexity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          startupName: data.startupName,
          founderName: data.founderName,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate analysis');
      }
      
      const result = await response.json();
      
      if (result.success) {
        setAnalysisResult(result.analysis);
        
        // Save to database in the background
        try {
          const saveStartupResponse = await fetch('/api/startups', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              name: data.startupName,
              founderName: data.founderName,
              userId: user.id,
            }),
          });
          
          if (saveStartupResponse.ok) {
            const startupData = await saveStartupResponse.json();
            
            if (startupData.success && startupData.data?.[0]?.id) {
              // Save analysis
              await fetch('/api/analyses', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  startupId: startupData.data[0].id,
                  analysisData: result.analysis,
                }),
              });
            }
          }
        } catch (err) {
          console.error('Error saving analysis:', err);
          // Don't show error to user, this is background saving
        }
      } else {
        throw new Error(result.error || 'Failed to generate analysis');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred while analyzing the startup');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const handleReset = () => {
    setAnalysisResult(null);
    reset();
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
            Enter any startup or founder name and get a comprehensive venture capital style analysis instantly.
          </p>
        </div>
        
        {!analysisResult ? (
          <div className="bg-white shadow rounded-lg p-6 md:p-8">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="bg-red-50 p-4 rounded-md text-red-700">
                  {error}
                </div>
              )}
              
              <div>
                <label htmlFor="startupName" className="block text-sm font-medium text-gray-700">
                  Startup Name *
                </label>
                <div className="mt-1">
                  <input
                    id="startupName"
                    type="text"
                    {...register('startupName')}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g., Stripe, Airbnb, etc."
                  />
                  {errors.startupName && (
                    <p className="mt-1 text-sm text-red-600">{errors.startupName.message}</p>
                  )}
                </div>
              </div>
              
              <div>
                <label htmlFor="founderName" className="block text-sm font-medium text-gray-700">
                  Founder Name (Optional)
                </label>
                <div className="mt-1">
                  <input
                    id="founderName"
                    type="text"
                    {...register('founderName')}
                    className="shadow-sm focus:ring-blue-500 focus:border-blue-500 block w-full sm:text-sm border-gray-300 rounded-md"
                    placeholder="e.g., Elon Musk, Sam Altman, etc."
                  />
                </div>
              </div>
              
              <div>
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${
                    isAnalyzing ? 'opacity-75 cursor-not-allowed' : ''
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
                    'Generate Analysis'
                  )}
                </button>
              </div>
              
              {!user && (
                <div className="text-center text-sm text-gray-500">
                  <p>Sign in with Google to save your analyses</p>
                </div>
              )}
            </form>
          </div>
        ) : (
          <div className="bg-white shadow rounded-lg overflow-hidden">
            <div className="px-4 py-5 sm:px-6 bg-gray-50 border-b border-gray-200">
              <h3 className="text-lg leading-6 font-medium text-gray-900">
                Analysis Results
              </h3>
            </div>
            
            <div className="px-4 py-5 sm:p-6 space-y-6">
              <section>
                <h3 className="text-lg font-semibold mb-2">Overview</h3>
                <p className="text-gray-700">{analysisResult.overview}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Market Opportunity</h3>
                <p className="text-gray-700">{analysisResult.marketOpportunity}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Competitive Landscape</h3>
                <p className="text-gray-700">{analysisResult.competitiveLandscape}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Business Model</h3>
                <p className="text-gray-700">{analysisResult.businessModel}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Team Assessment</h3>
                <p className="text-gray-700">{analysisResult.teamAssessment}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Risks and Challenges</h3>
                <p className="text-gray-700">{analysisResult.risksAndChallenges}</p>
              </section>
              
              <section>
                <h3 className="text-lg font-semibold mb-2">Investment Potential</h3>
                <p className="text-gray-700">{analysisResult.investmentPotential}</p>
              </section>
              
              <div className="mt-6">
                <button
                  onClick={handleReset}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Analyze Another Startup
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
