'use client';

import React, { useState, useEffect } from 'react';
import { Package, BookOpen, Play, Eye, Volume2, PenTool, ChevronRight, Loader2, AlertCircle } from 'lucide-react';

interface ContentPackage {
  id: string;
  subject: string;
  skill: string;
  subskill: string;
  title: string;
  description: string[];
  difficulty_level: string;
  learning_objectives: string[];
  has_visual: boolean;
  has_audio: boolean;
  has_practice: boolean;
  created_at: string;
}

interface CurriculumSelection {
  subject: string;
  unit?: { id: string; title: string; };
  skill?: { id: string; description: string; };
  subskill?: { id: string; description: string; };
}

interface ContentPackageSelectorProps {
  curriculum: CurriculumSelection;
  ageGroup: string;
  onSelect: (packageId: string | null) => void;
  selectedPackageId?: string | null;
  apiUrl?: string;
}

const ContentPackageSelector: React.FC<ContentPackageSelectorProps> = ({
  curriculum,
  ageGroup,
  onSelect,
  selectedPackageId,
  apiUrl = '/api/gemini'
}) => {
  const [packages, setPackages] = useState<ContentPackage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedPackage, setSelectedPackage] = useState<string | null>(selectedPackageId || null);

  // Fetch content packages based on curriculum
  useEffect(() => {
    const fetchPackages = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        const params = new URLSearchParams();
        params.append('subject', curriculum.subject);
        if (curriculum.skill?.id) {
          params.append('skill', curriculum.skill.id);
        }
        if (curriculum.subskill?.id) {
          params.append('subskill', curriculum.subskill.id);
        }
        params.append('status', 'approved');
        params.append('limit', '20');

        const response = await fetch(`${apiUrl}/content-packages?${params.toString()}`);
        
        if (!response.ok) {
          throw new Error(`Failed to fetch packages: ${response.statusText}`);
        }

        const data = await response.json();
        
        if (data.status === 'success') {
          setPackages(data.packages || []);
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching content packages:', err);
        setError(err instanceof Error ? err.message : 'Failed to load content packages');
        setPackages([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPackages();
  }, [curriculum, apiUrl]);

  const handlePackageSelect = (packageId: string | null) => {
    setSelectedPackage(packageId);
    onSelect(packageId);
  };

  const getDifficultyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case 'beginner': return 'bg-green-100 text-green-700 border-green-200';
      case 'intermediate': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'advanced': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          <span className="ml-3 text-gray-600">Loading enhanced content packages...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-3 text-orange-600 mb-4">
          <AlertCircle className="w-6 h-6" />
          <h3 className="text-lg font-semibold">Content Packages Unavailable</h3>
        </div>
        <p className="text-gray-600 mb-6">{error}</p>
        <button
          onClick={() => handlePackageSelect(null)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-6 rounded-lg font-medium transition-colors"
        >
          Continue with Standard Tutoring
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-8">
      <div className="mb-6">
        <h3 className="text-2xl font-bold text-gray-800 mb-2 flex items-center gap-2">
          <Package className="w-6 h-6 text-purple-600" />
          Choose Your Learning Experience
        </h3>
        <p className="text-gray-600">
          Select enhanced content for {curriculum.subject}
          {curriculum.skill && ` - ${curriculum.skill.description}`}
        </p>
      </div>

      {/* Standard Option */}
      <div 
        onClick={() => handlePackageSelect(null)}
        className={`p-6 rounded-xl border-2 cursor-pointer transition-all mb-4 ${
          selectedPackage === null
            ? 'border-blue-300 bg-blue-50'
            : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gray-100 rounded-lg">
              <BookOpen className="w-6 h-6 text-gray-600" />
            </div>
            <div>
              <h4 className="text-lg font-semibold text-gray-800">Standard Tutoring</h4>
              <p className="text-gray-600">Regular AI tutoring session</p>
            </div>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400" />
        </div>
      </div>

      {/* Enhanced Content Packages */}
      {packages.length > 0 ? (
        <>
          <div className="mb-4">
            <h4 className="text-lg font-semibold text-gray-800 mb-2 flex items-center gap-2">
              <Package className="w-5 h-5 text-purple-600" />
              Enhanced Content Packages ({packages.length})
            </h4>
            <p className="text-sm text-gray-600">Rich multimedia content with guided learning objectives</p>
          </div>

          <div className="space-y-4 max-h-96 overflow-y-auto">
            {packages.map((pkg) => (
              <div
                key={pkg.id}
                onClick={() => handlePackageSelect(pkg.id)}
                className={`p-6 rounded-xl border-2 cursor-pointer transition-all ${
                  selectedPackage === pkg.id
                    ? 'border-purple-300 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-200 hover:bg-purple-25'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h5 className="text-lg font-semibold text-gray-800">{pkg.title}</h5>
                      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${getDifficultyColor(pkg.difficulty_level)}`}>
                        {pkg.difficulty_level || 'Standard'}
                      </span>
                    </div>
                    
                    {pkg.description && pkg.description.length > 0 && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600">
                          {pkg.description.slice(0, 2).join(' • ')}
                        </p>
                      </div>
                    )}
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 ml-4 flex-shrink-0" />
                </div>

                {/* Learning Objectives */}
                {pkg.learning_objectives && pkg.learning_objectives.length > 0 && (
                  <div className="mb-4">
                    <h6 className="text-sm font-medium text-gray-700 mb-2">Learning Objectives:</h6>
                    <ul className="text-sm text-gray-600 space-y-1">
                      {pkg.learning_objectives.slice(0, 3).map((objective, index) => (
                        <li key={index} className="flex items-start gap-2">
                          <span className="w-1 h-1 bg-purple-400 rounded-full mt-2 flex-shrink-0"></span>
                          <span>{objective}</span>
                        </li>
                      ))}
                      {pkg.learning_objectives.length > 3 && (
                        <li className="text-purple-600 text-xs">
                          +{pkg.learning_objectives.length - 3} more objectives
                        </li>
                      )}
                    </ul>
                  </div>
                )}

                {/* Resource Indicators */}
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-gray-500">Includes:</span>
                  {pkg.has_visual && (
                    <div className="flex items-center gap-1 text-blue-600">
                      <Eye className="w-4 h-4" />
                      <span>Visual</span>
                    </div>
                  )}
                  {pkg.has_audio && (
                    <div className="flex items-center gap-1 text-green-600">
                      <Volume2 className="w-4 h-4" />
                      <span>Audio</span>
                    </div>
                  )}
                  {pkg.has_practice && (
                    <div className="flex items-center gap-1 text-purple-600">
                      <PenTool className="w-4 h-4" />
                      <span>Practice</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="text-center py-8">
          <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-semibold text-gray-600 mb-2">No Enhanced Content Available</h4>
          <p className="text-gray-500 mb-4">
            No content packages found for this curriculum selection.
          </p>
          <button
            onClick={() => handlePackageSelect(null)}
            className="bg-blue-500 hover:bg-blue-600 text-white py-2 px-6 rounded-lg font-medium transition-colors"
          >
            Continue with Standard Tutoring
          </button>
        </div>
      )}

      {/* Action Buttons */}
      {packages.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200">
          <div className="flex gap-3">
            <button
              onClick={() => handlePackageSelect(selectedPackage)}
              disabled={selectedPackage === undefined}
              className={`flex-1 py-3 px-6 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${
                selectedPackage !== undefined
                  ? 'bg-purple-500 hover:bg-purple-600 text-white'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              }`}
            >
              <Play className="w-5 h-5" />
              {selectedPackage 
                ? 'Start Enhanced Session' 
                : 'Start Standard Session'
              }
            </button>
          </div>
          
          {selectedPackage && (
            <p className="text-center text-sm text-purple-600 mt-2">
              You'll have access to multimedia content and guided learning objectives
            </p>
          )}
        </div>
      )}
    </div>
  );
};

export default ContentPackageSelector;