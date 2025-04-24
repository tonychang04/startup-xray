'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAnalysis } from '@/hooks/useAnalysis';
import { useAuth } from '@/hooks/useAuth';
import { AnalysisResponse } from '@/lib/perplexity';

const analysisSchema = z.object({
  startupName: z.string().min(1, 'Startup name is required'),
  founderName: z.string().optional(),
});

type AnalysisFormData = z.infer<typeof analysisSchema>;

export default function AnalysisForm() {
  const { user } = useAuth();
  const { loading, error, analyzeStartup, saveAnalysis } = useAnalysis();
  const [analysisResult, setAnalysisResult] = useState<AnalysisResponse['analysis'] | null>(null);
  
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<AnalysisFormData>({
    resolver: zodResolver(analysisSchema),
  });

  const onSubmit = async (data: AnalysisFormData) => {
    try {
      // First create the startup entry
      const startupResponse = await fetch('/api/startups', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: data.startupName,
          founderName: data.founderName,
          userId: user?.id,
        }),
      });
      
      if (!startupResponse.ok) {
        throw new Error('Failed to create startup');
      }
      
      const startupData = await startupResponse.json();
      const newStartupId = startupData.data[0].id;
      
      // Then generate the analysis
      const analysis = await analyzeStartup({
        startupName: data.startupName,
        founderName: data.founderName,
      });
      
      setAnalysisResult(analysis.analysis);
      
      // Save the analysis to the database
      await saveAnalysis(newStartupId, analysis);
      
    } catch (err) {
      console.error('Error in analysis process:', err);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="text-2xl font-bold mb-6">Startup X-Ray Analysis</h1>
      
      {!analysisResult ? (
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Startup Name *
            </label>
            <input
              {...register('startupName')}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="Enter startup name"
            />
            {errors.startupName && (
              <p className="mt-1 text-sm text-red-600">{errors.startupName.message}</p>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Founder Name (Optional)
            </label>
            <input
              {...register('founderName')}
              className="w-full px-4 py-2 border rounded-md"
              placeholder="Enter founder name"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {loading ? 'Generating Analysis...' : 'Generate Analysis'}
          </button>
          
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-md">
              {error}
            </div>
          )}
        </form>
      ) : (
        <div className="bg-white shadow-md rounded-lg p-6">
          <h2 className="text-xl font-bold mb-4">{analysisResult.overview}</h2>
          
          <div className="space-y-6 mt-6">
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
          </div>
          
          <button
            onClick={() => setAnalysisResult(null)}
            className="mt-6 bg-gray-200 text-gray-800 py-2 px-4 rounded-md hover:bg-gray-300"
          >
            Analyze Another Startup
          </button>
        </div>
      )}
    </div>
  );
} 