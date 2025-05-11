'use client';
import { useState, useEffect, useRef, RefObject } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useForm, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

import { BubbleDataPoint, Chart, ChartTypeRegistry, Point, registerables } from 'chart.js';
Chart.register(...registerables);

const compareSchema = z.object({
  businesses: z.array(
    z.object({
      name: z.string().min(1, 'Please enter a business name')
    })
  ).length(2, 'Please provide exactly two businesses to compare')
});

type CompareFormData = z.infer<typeof compareSchema>;

// Define valid metric keys
type MetricKey = 'funding' | 'valuation' | 'employees' | 'revenue' | 'growthRate' | 'marketShare' | 'marketSize';

export default function Compare() {
  const { user, signInWithGoogle } = useAuth();
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [comparisonResult, setComparisonResult] = useState<string | null>(null);
  const [businessNames, setBusinessNames] = useState<string[]>([]);
  const [metrics, setMetrics] = useState<unknown | null>(null);
  const chartRefs = useRef<{[key: string]: HTMLCanvasElement | null}>({
    funding: null,
    valuation: null,
    growth: null,
    market: null,
    radar: null
  });
  const chartInstances = useRef<{[key: string]: Chart | null}>({});
  
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
  
  const { fields } = useFieldArray({
    control,
    name: "businesses"
  });
  
  // Extract metrics from the comparison result
  useEffect(() => {
    if (comparisonResult && businessNames.length === 2) {
      console.log('Raw comparison result:', comparisonResult);
      const extractedMetrics = extractMetricsFromText(comparisonResult, businessNames);
      console.log('Extracted metrics:', extractedMetrics);
      setMetrics(extractedMetrics);
    }
  }, [comparisonResult, businessNames]);
  
  // Create charts when metrics are available
  useEffect(() => {
    if (!metrics) return;
    
    // Clean up any existing charts
    Object.values(chartInstances.current).forEach(chart => {
      if (chart) chart.destroy();
    });
    
    // Create new charts
    createCharts(metrics as any, businessNames, chartRefs, chartInstances);
    
    return () => {
      // Clean up on unmount
      Object.values(chartInstances.current).forEach(chart => {
        if (chart) chart.destroy();
      });
    };
  }, [metrics, businessNames]);
  
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
    setBusinessNames(data.businesses.map(b => b.name));
    
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
          businessesString: businessNames,
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
  
  const resetComparison = () => {
    setComparisonResult(null);
    setMetrics(null);
    setBusinessNames([]);
  };
  
  const extractMetricsFromText = (text: string, businessNames: string[]) => {
    console.log('Extracting metrics for businesses:', businessNames);
    
    // Initialize metrics object
    const metrics = {
      [businessNames[0]]: {
        foundingYear: null,
        funding: null,
        valuation: null,
        employees: null,
        revenue: null,
        growthRate: null,
        marketShare: null,
        marketSize: null
      },
      [businessNames[1]]: {
        foundingYear: null,
        funding: null,
        valuation: null,
        employees: null,
        revenue: null,
        growthRate: null,
        marketShare: null,
        marketSize: null
      }
    };
    
    // Try to extract JSON data first
    try {
      // Look for JSON block with or without the ```json markers
      let jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/);
      
      // If not found with ```json, try just ```
      if (!jsonMatch) {
        jsonMatch = text.match(/```\s*([\s\S]*?)\s*```/);
      }
      
      // If still not found, try looking for a JSON object directly
      if (!jsonMatch) {
        jsonMatch = text.match(/\{\s*"[^"]+"\s*:\s*\{[\s\S]*?\}\s*,\s*"[^"]+"\s*:\s*\{[\s\S]*?\}\s*\}/);
      }
      
      if (jsonMatch) {
        const jsonStr = jsonMatch[1] || jsonMatch[0];
        console.log('Found JSON data:', jsonStr);
        
        // Clean the JSON string - remove any non-JSON characters
        const cleanJsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, "");
        
        const jsonData = JSON.parse(cleanJsonStr);
        
        // Process data for both businesses
        businessNames.forEach(name => {
          if (jsonData[name.toLowerCase()]) {
            // Try lowercase name
            processBusinessData(jsonData[name.toLowerCase()], metrics[name]);
          } else if (jsonData[name]) {
            // Try exact name
            processBusinessData(jsonData[name], metrics[name]);
          }
        });
        
        console.log('Extracted metrics from JSON:', metrics);
        return metrics;
      }
    } catch (error) {
      console.error('Error parsing JSON metrics:', error);
      // Fall back to regex extraction if JSON parsing fails
  
    }
    
    // Check if we have enough data for visualization
    const hasEnoughData = businessNames.some(name => {
      const businessMetrics = metrics[name];
      const nonNullValues = Object.values(businessMetrics).filter(value => value !== null);
      console.log(`${name} has ${nonNullValues.length} non-null metrics out of 8`);
      return nonNullValues.length >= 3; // At least 3 metrics available
    });
    
    console.log('Has enough data for visualization:', hasEnoughData);
    console.log('Final extracted metrics:', metrics);
    
    // Always return metrics for visualization, even if incomplete
    return metrics;
  };
  
  // Helper function to process business data
  const processBusinessData = (data: any, metricsObj: any) => {
    if (!data) return;
    
    metricsObj.foundingYear = data.foundingYear || null;
    
    metricsObj.funding = data.funding ? 
      (data.fundingUnit === 'billion' ? data.funding * 1000 : data.funding) : null;
    
    metricsObj.valuation = data.valuation ? 
      (data.valuationUnit === 'trillion' ? data.valuation * 1000000 : 
       data.valuationUnit === 'billion' ? data.valuation * 1000 : data.valuation) : null;
    
    metricsObj.employees = data.employees ? 
      (typeof data.employees === 'string' ? 
       parseInt(data.employees.replace(/_/g, '')) : data.employees) : null;
    
    metricsObj.revenue = data.revenue ? 
      (data.revenueUnit === 'billion' ? data.revenue * 1000 : data.revenue) : null;
    
    metricsObj.growthRate = data.growthRate ? 
      (data.growthRate <= 1 ? data.growthRate * 100 : data.growthRate) : null;
    
    metricsObj.marketShare = data.marketShare ? 
      (data.marketShare <= 1 ? data.marketShare * 100 : data.marketShare) : null;
    
    metricsObj.marketSize = data.marketSize ? 
      (data.marketSizeUnit === 'trillion' ? data.marketSize * 1000 : data.marketSize) : null;
  };
  
  const createCharts = (
    metrics: { 
      [key: string]: {
        valuation: any;
        growthRate: any;
        employees: null;
        revenue: null;
        marketSize: null;
        funding: any; 
        marketShare: any;
        foundingYear: null;
      }
    }, 
    businessNames: string[], 
    chartRefs: RefObject<{ [key: string]: HTMLCanvasElement | null; }>, 
    chartInstances: RefObject<{ [key: string]: Chart<keyof ChartTypeRegistry, (number | [number, number] | Point | BubbleDataPoint | null)[], unknown> | null; }>
  ) => {
    console.log('Creating charts with metrics:', metrics);
    
    if (!metrics || !businessNames || businessNames.length !== 2) return;
    
    const colors = [
      ['rgba(59, 130, 246, 0.5)', 'rgb(59, 130, 246)'], // blue
      ['rgba(239, 68, 68, 0.5)', 'rgb(239, 68, 68)']    // red
    ];
    
    // Helper function to filter out null values
    const filterNulls = (data: any[], labels: any[]) => {
      const validIndices: number[] = [];
      const filteredData: any[] = [];
      const filteredLabels: any[] = [];
      
      data.forEach((value, index) => {
        if (value !== null) {
          validIndices.push(index);
          filteredData.push(value);
          filteredLabels.push(labels[index]);
        }
      });
      
      return { data: filteredData, labels: filteredLabels, validIndices };
    };
    
    // Create funding chart
    if (chartRefs.current.funding) {
      const ctx = chartRefs.current.funding.getContext('2d');
      if (ctx) {
        const fundingData = businessNames.map(name => metrics[name].funding);
        const { data, labels, validIndices } = filterNulls(fundingData, businessNames);
        
        if (data.length > 0) {
          chartInstances.current.funding = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Total Funding ($M)',
                data: data,
                backgroundColor: validIndices.map(i => colors[i][0]),
                borderColor: validIndices.map(i => colors[i][1]),
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Total Funding Comparison'
                },
                legend: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Millions ($)'
                  }
                }
              }
            }
          });
        } else {
          // Display "No data available" message
          ctx.font = '16px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('No funding data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      }
    }
    
    // Create valuation chart
    if (chartRefs.current.valuation) {
      const ctx = chartRefs.current.valuation.getContext('2d');
      if (ctx) {
        const valuationData = businessNames.map(name => metrics[name].valuation);
        const { data, labels, validIndices } = filterNulls(valuationData, businessNames);
        
        if (data.length > 0) {
          chartInstances.current.valuation = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Valuation ($M)',
                data: data,
                backgroundColor: validIndices.map(i => colors[i][0]),
                borderColor: validIndices.map(i => colors[i][1]),
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Company Valuation'
                },
                legend: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Millions ($)'
                  }
                }
              }
            }
          });
        } else {
          // Display "No data available" message
          ctx.font = '16px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('No valuation data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      }
    }
    
    // Create growth rate chart
    if (chartRefs.current.growth) {
      const ctx = chartRefs.current.growth.getContext('2d');
      if (ctx) {
        const growthData = businessNames.map(name => metrics[name].growthRate);
        const { data, labels, validIndices } = filterNulls(growthData, businessNames);
        
        if (data.length > 0) {
          chartInstances.current.growth = new Chart(ctx, {
            type: 'bar',
            data: {
              labels: labels,
              datasets: [{
                label: 'Growth Rate (%)',
                data: data,
                backgroundColor: validIndices.map(i => colors[i][0]),
                borderColor: validIndices.map(i => colors[i][1]),
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Annual Growth Rate'
                },
                legend: {
                  display: false
                }
              },
              scales: {
                y: {
                  beginAtZero: true,
                  title: {
                    display: true,
                    text: 'Percentage (%)'
                  }
                }
              }
            }
          });
        } else {
          // Display "No data available" message
          ctx.font = '16px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('No growth rate data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      }
    }
    
    // Create radar chart for overall comparison
    if (chartRefs.current.radar) {
      const ctx = chartRefs.current.radar.getContext('2d');
      if (ctx) {
        // Check if we have enough data for the radar chart
        const hasEnoughData = businessNames.some(name => {
          const businessMetrics = metrics[name];
          return Object.values(businessMetrics).filter(value => value !== null).length >= 3;
        });
        
        if (hasEnoughData) {
          // Normalize values for radar chart (0-100 scale)
          const normalizeValue = (value: number | null, metric: MetricKey) => {
            if (value === null) return 0;
            
            const maxValues: Record<MetricKey, number> = {
              funding: 500,
              valuation: 2000,
              employees: 1000,
              revenue: 500,
              growthRate: 100,
              marketShare: 100,
              marketSize: 1000
            };
            
            return Math.min(100, (value / maxValues[metric]) * 100);
          };
          
          chartInstances.current.radar = new Chart(ctx, {
            type: 'radar',
            data: {
              labels: ['Funding', 'Valuation', 'Team Size', 'Revenue', 'Growth', 'Market Share'],
              datasets: businessNames.map((name, i) => ({
                label: name,
                data: [
                  metrics[name].funding !== null ? normalizeValue(metrics[name].funding, 'funding') : 0,
                  metrics[name].valuation !== null ? normalizeValue(metrics[name].valuation, 'valuation') : 0,
                  metrics[name].employees !== null ? normalizeValue(metrics[name].employees, 'employees') : 0,
                  metrics[name].revenue !== null ? normalizeValue(metrics[name].revenue, 'revenue') : 0,
                  metrics[name].growthRate !== null ? normalizeValue(metrics[name].growthRate, 'growthRate') : 0,
                  metrics[name].marketShare !== null ? normalizeValue(metrics[name].marketShare, 'marketShare') : 0
                ],
                backgroundColor: colors[i][0],
                borderColor: colors[i][1],
                borderWidth: 2,
                pointBackgroundColor: colors[i][1],
                pointRadius: 4
              }))
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Business Comparison Overview'
                },
                tooltip: {
                  callbacks: {
                    label: function(context) {
                      const label = context.label || '';
                      const value = context.raw || 0;
                      const metricName = ['funding', 'valuation', 'employees', 'revenue', 'growthRate', 'marketShare'][context.dataIndex];
                      const actualValue = (metrics as any)[label][metricName];
                      
                      if (actualValue === null) {
                        return `${label}: No data`;
                      }
                      
                      let suffix = '';
                      if (metricName === 'funding' || metricName === 'valuation' || metricName === 'revenue') {
                        suffix = 'M';
                      } else if (metricName === 'growthRate' || metricName === 'marketShare') {
                        suffix = '%';
                      } else if (metricName === 'marketSize') {
                        suffix = 'B';
                      }
                      
                      return `${label}: ${actualValue}${suffix}`;
                    }
                  }
                }
              },
              scales: {
                r: {
                  angleLines: {
                    display: true
                  },
                  suggestedMin: 0,
                  suggestedMax: 100
                }
              }
            }
          });
        } else {
          // Display "No data available" message
          ctx.font = '16px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('Insufficient data for comparison', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      }
    }
    
    // Create market size chart
    if (chartRefs.current.market) {
      const ctx = chartRefs.current.market.getContext('2d');
      if (ctx) {
        const hasMarketData = businessNames.every(name => 
          metrics[name].marketShare !== null && metrics[name].marketSize !== null
        );
        
        if (hasMarketData) {
          chartInstances.current.market = new Chart(ctx, {
            type: 'pie',
            data: {
              labels: [...businessNames, 'Rest of Market'],
              datasets: [{
                data: [
                  (metrics[businessNames[0]]?.marketSize || 0) * ((metrics[businessNames[0]]?.marketShare || 0) / 100),
                  (metrics[businessNames[1]]?.marketSize || 0) * ((metrics[businessNames[1]]?.marketShare || 0) / 100),
                  (metrics[businessNames[0]]?.marketSize || 0) * (1 - ((metrics[businessNames[0]]?.marketShare || 0) + (metrics[businessNames[1]]?.marketShare || 0)) / 100)
                ],
                backgroundColor: [colors[0][0], colors[1][0], 'rgba(203, 213, 225, 0.5)'],
                borderColor: [colors[0][1], colors[1][1], 'rgb(148, 163, 184)'],
                borderWidth: 1
              }]
            },
            options: {
              responsive: true,
              plugins: {
                title: {
                  display: true,
                  text: 'Market Share Distribution'
                }
              }
            }
          });
          
        } else {
          // Display "No data available" message
          ctx.font = '16px Arial';
          ctx.fillStyle = '#666';
          ctx.textAlign = 'center';
          ctx.fillText('No market share data available', ctx.canvas.width / 2, ctx.canvas.height / 2);
        }
      }
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white py-12">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl md:text-6xl">
            <span className="block">Startup X-Ray</span>
            <span className="block text-blue-600">Compare Businesses</span>
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
                      <div className="mb-3">
                        <label className="block text-lg font-semibold text-gray-800">Business {index + 1}</label>
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
          <div className="mt-8 bg-white shadow-lg rounded-xl overflow-hidden">
            <div className="px-4 py-6 sm:px-6 bg-gradient-to-r from-blue-50 via-purple-50 to-blue-50 border-b border-gray-200">
              <div className="flex flex-col items-center sm:flex-row sm:justify-between">
                <h2 className="text-2xl font-bold text-gray-900 flex items-center">
                  <span className="mr-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </span>
                  <span>Business Comparison: {businessNames.join(' vs. ')}</span>
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
          
            
            {/* Visualization Section - Only show if metrics exist */}
            {metrics ? (
              <div className="px-4 py-5 sm:p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                  <div className="h-64 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <canvas ref={(el) => { chartRefs.current.radar = el; }} />
                  </div>
                  <div className="h-64 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <canvas ref={(el) => { chartRefs.current.market = el; }} />
                  </div>
                  <div className="h-64 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <canvas ref={(el) => { chartRefs.current.funding = el; }} />
                  </div>
                  <div className="h-64 border border-gray-200 rounded-lg p-4 bg-white shadow-sm">
                    <canvas ref={(el) => { chartRefs.current.growth = el; }} />
                  </div>
                </div>
                
                {/* Side-by-side metrics table */}
                <div className="overflow-x-auto border border-gray-200 rounded-lg shadow-sm">
                  <table className="min-w-full divide-y divide-gray-300">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Metric</th>
                        {businessNames.map(name => (
                          <th key={name} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{name}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Founding Year</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].foundingYear !== null ? (metrics as any)[name].foundingYear : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Total Funding</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].funding !== null ? `$${(metrics as any)[name].funding}M` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Valuation</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].valuation !== null ? `$${(metrics as any)[name].valuation}M` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Employees</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].employees !== null ? (metrics as any)[name].employees : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Revenue (Est.)</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].revenue !== null ? `$${(metrics as any)[name].revenue}M` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Growth Rate</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].growthRate !== null ? `${(metrics as any)[name].growthRate}%` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Market Share</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].marketShare !== null ? `${(metrics as any)[name].marketShare}%` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">Market Size (TAM)</td>
                        {businessNames.map(name => (
                          <td key={name} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {metrics && (metrics as any)[name] && (metrics as any)[name].marketSize !== null ? `$${(metrics as any)[name].marketSize}B` : 'N/A'}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Key differences section - Add this after the metrics table */}
                <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100">
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Key Differences</h3>
                  <div className="prose prose-blue max-w-none">
                    {comparisonResult && (
                      <div>
                        {(() => {
                          // Extract the text after the JSON block
                          const jsonEndIndex = comparisonResult.lastIndexOf('```');
                          if (jsonEndIndex !== -1) {
                            const keyDifferences = comparisonResult.substring(jsonEndIndex + 3).trim();
                            return <p>{keyDifferences}</p>;
                          }
                          return <p>No key differences information available.</p>;
                        })()}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="px-4 py-5 sm:p-6 text-center">
                <p className="text-gray-500">Processing data for visualization...</p>
              </div>
            )}
            
            <div className="px-4 py-5 sm:p-6 border-t border-gray-200 flex justify-center">
              <button
                type="button"
                onClick={resetComparison}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                Generate Another Comparison
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 