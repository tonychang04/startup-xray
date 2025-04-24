'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnalysisResponse } from '@/lib/perplexity';

interface Startup {
  id: string;
  name: string;
  founder_name: string | null;
  created_at: string;
}

interface Analysis {
  id: string;
  startup_id: string;
  analysis_data: AnalysisResponse['analysis'];
  created_at: string;
}

export default function DashboardPage() {
  const { user, loading, signOut } = useAuth();
  const router = useRouter();
  const [startups, setStartups] = useState<Startup[]>([]);
  const [analyses, setAnalyses] = useState<Record<string, Analysis[]>>({});
  const [loadingStartups, setLoadingStartups] = useState(true);
  const [expandedStartup, setExpandedStartup] = useState<string | null>(null);
  
  useEffect(() => {
    if (!loading && !user) {
      router.push('/auth/login?redirect=/dashboard');
    }
  }, [user, loading, router]);
  
  useEffect(() => {
    if (user) {
      fetchStartups();
    }
  }, [user]);
  
  const fetchStartups = async () => {
    try {
      const response = await fetch('/api/startups');
      const data = await response.json();
      
      if (data.success) {
        setStartups(data.data);
      }
    } catch (error) {
      console.error('Error fetching startups:', error);
    } finally {
      setLoadingStartups(false);
    }
  };
  
  const fetchAnalysesForStartup = async (startupId: string) => {
    try {
      const response = await fetch(`/api/analyses?startupId=${startupId}`);
      const data = await response.json();
      
      if (data.success) {
        setAnalyses(prev => ({
          ...prev,
          [startupId]: data.data
        }));
      }
    } catch (error) {
      console.error(`Error fetching analyses for startup ${startupId}:`, error);
    }
  };
  
  const toggleExpandStartup = (startupId: string) => {
    if (expandedStartup === startupId) {
      setExpandedStartup(null);
    } else {
      setExpandedStartup(startupId);
      if (!analyses[startupId]) {
        fetchAnalysesForStartup(startupId);
      }
    }
  };
  
  const handleSignOut = async () => {
    await signOut();
    router.push('/');
  };
  
  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }
  
  if (!user) {
    return null; // Will redirect in useEffect
  }
  
  return (
    <div className="max-w-6xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Your Dashboard</h1>
        <div className="flex space-x-4">
          <Link 
            href="/analyze/new" 
            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
          >
            New Analysis
          </Link>
          <button
            onClick={handleSignOut}
            className="bg-gray-200 text-gray-800 px-4 py-2 rounded-md hover:bg-gray-300"
          >
            Sign Out
          </button>
        </div>
      </div>
      
      <div className="bg-white shadow-md rounded-lg p-6">
        <h2 className="text-xl font-semibold mb-4">Your Startup Analyses</h2>
        
        {loadingStartups ? (
          <p>Loading your startups...</p>
        ) : startups.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">You haven't analyzed any startups yet.</p>
            <Link 
              href="/analyze/new" 
              className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
            >
              Analyze Your First Startup
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {startups.map((startup) => (
              <div key={startup.id} className="border rounded-lg overflow-hidden">
                <div 
                  className="flex justify-between items-center p-4 bg-gray-50 cursor-pointer"
                  onClick={() => toggleExpandStartup(startup.id)}
                >
                  <div>
                    <h3 className="font-medium">{startup.name}</h3>
                    <p className="text-sm text-gray-500">
                      {startup.founder_name ? `Founded by ${startup.founder_name}` : 'Founder not specified'} • 
                      {new Date(startup.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center">
                    <Link
                      href={`/analyze/${startup.id}`}
                      className="text-blue-600 hover:text-blue-800 mr-4"
                      onClick={(e) => e.stopPropagation()}
                    >
                      View Details
                    </Link>
                    <svg 
                      className={`w-5 h-5 transition-transform ${expandedStartup === startup.id ? 'transform rotate-180' : ''}`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                
                {expandedStartup === startup.id && (
                  <div className="p-4 border-t">
                    {!analyses[startup.id] ? (
                      <p className="text-center py-4">Loading analyses...</p>
                    ) : analyses[startup.id].length === 0 ? (
                      <p className="text-center py-4">No analyses found for this startup.</p>
                    ) : (
                      <div className="space-y-4">
                        {analyses[startup.id].map((analysis) => (
                          <div key={analysis.id} className="bg-gray-50 p-4 rounded-md">
                            <div className="mb-2">
                              <span className="text-sm text-gray-500">
                                Analysis from {new Date(analysis.created_at).toLocaleString()}
                              </span>
                            </div>
                            
                            <div className="space-y-2">
                              <div>
                                <h4 className="font-medium">Overview</h4>
                                <p className="text-sm">{analysis.analysis_data.overview}</p>
                              </div>
                              
                              <div>
                                <h4 className="font-medium">Investment Potential</h4>
                                <p className="text-sm">{analysis.analysis_data.investmentPotential}</p>
                              </div>
                            </div>
                            
                            <div className="mt-3">
                              <Link
                                href={`/analyze/${startup.id}/${analysis.id}`}
                                className="text-blue-600 hover:text-blue-800 text-sm"
                              >
                                View Full Analysis
                              </Link>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 