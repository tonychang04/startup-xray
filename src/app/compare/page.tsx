'use client';

import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const compareSchema = z.object({
  businesses: z.array(
    z.object({
      name: z.string().min(1, 'Please enter a business name')
    })
  ).min(2, 'Please add at least two businesses to compare').max(4, 'Maximum 4 businesses can be compared')
});

type CompareFormData = z.infer<typeof compareSchema>;

export default function Compare() {
  const { user, signInWithGoogle } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  
  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CompareFormData>({
    resolver: zodResolver(compareSchema),
    defaultValues: {
      businesses: [
        { name: '' },
        { name: '' }
      ]
    }
  });
  
  const { fields, append, remove } = useFieldArray({
    control,
    name: "businesses"
  });
  
  const onSubmit = async (data: CompareFormData) => {
    // Check if user is logged in first
    if (!user) {
      try {
        await signInWithGoogle();
        return; // Will redirect to OAuth flow
      } catch (err: unknown) {
        if (err instanceof Error) {
          setError(err.message || 'Please sign in to compare businesses');
        } else {
          setError('Please sign in to compare businesses');
        }
        return;
      }
    }
    
    setIsAnalyzing(true);
    setError(null);
    setComparisonResult(null);
    
    try {
      // Get business names as a comma-separated string
      const businessNames = data.businesses.map(b => b.name).join(', ');
      
      // Create a direct comparison prompt for Perplexity
      const response = await fetch('/api/perplexity/compare', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          businesses: businessNames,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to compare businesses');
      }
      
      const responseData = await response.json();
      
      if (!responseData.success) {
        throw new Error(responseData.error || 'Failed to compare businesses');
      }
      
      setComparisonResult(responseData.comparison);
      
    } catch (err: any) {
      setError(err.message || 'An error occurred during comparison');
    } finally {
      setIsAnalyzing(false);
    }
  };
  
  const addBusiness = () => {
    if (fields.length < 4) {
      append({ name: '' });
    }
  };
  
  const removeBusiness = (index: number) => {
    if (fields.length > 2) {
      remove(index);
    }
  };
  
  const resetComparison = () => {
    setComparisonResult(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Startup X-Ray</span>
            <span className="block text-blue-600">Compare Businesses in Seconds</span>
          </h1>
          <p className="mt-3 max-w-md mx-auto text-base text-gray-500 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
            Compare multiple businesses side-by-side with detailed VC-style analysis.
          </p>
        </div>
        
        {!comparisonResult ? (
          <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-xl">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <div className="bg-red-50 p-4 rounded-md text-red-700 border border-red-200">
                  {error}
                </div>
              )}
              
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {fields.map((field, index) => (
                    <div key={field.id} className="flex flex-col p-5 border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow duration-200">
                      <div className="flex justify-between items-center mb-3">
                        <label className="block text-lg font-semibold text-gray-800">Business {index + 1}</label>
                        {fields.length > 2 && (
                          <button
                            type="button"
                            onClick={() => removeBusiness(index)}
                            className="inline-flex items-center p-1.5 border border-transparent rounded-full text-red-600 hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        {...register(`businesses.${index}.name`)}
                        placeholder="Enter business name"
                        className="block w-full px-4 py-3 border border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500 text-base"
                      />
                      {errors.businesses?.[index]?.name && (
                        <p className="mt-2 text-sm text-red-600">{errors.businesses[index].name.message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              
              {fields.length < 4 && (
                <div className="flex justify-center">
                  <button
                    type="button"
                    onClick={addBusiness}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-blue-700 bg-blue-100 hover:bg-blue-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    Add Business
                  </button>
                </div>
              )}
              
              {errors.businesses && (
                <p className="text-sm text-red-600">{errors.businesses.message}</p>
              )}
              
              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isAnalyzing}
                  className={`inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 ${isAnalyzing ? 'opacity-70 cursor-not-allowed' : ''}`}
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
                    'Compare Businesses'
                  )}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <div className="bg-white shadow-lg rounded-xl p-6 md:p-8 transition-all duration-300 hover:shadow-xl">
            <div className="mb-6 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Comparison Results</h2>
              <button
                onClick={resetComparison}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                New Comparison
              </button>
            </div>
            
            <div className="prose prose-blue max-w-none">
              <div dangerouslySetInnerHTML={{ __html: comparisonResult.replace(/\n/g, '<br />') }} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 