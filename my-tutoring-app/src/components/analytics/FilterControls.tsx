// components/analytics/FilterControls.tsx - Updated with dynamic subject fetching
'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar, Filter, X, RefreshCw, AlertCircle } from 'lucide-react'
import { authApi } from '@/lib/authApiClient'

interface AnalyticsFilters {
  subject?: string;
  startDate?: string;
  endDate?: string;
  dateRange?: 'week' | 'month' | 'quarter' | 'year' | 'all';
}

interface FilterControlsProps {
  filters: AnalyticsFilters;
  onFiltersChange: (filters: Partial<AnalyticsFilters>) => void;
  disabled?: boolean;
}

const DATE_RANGES = [
  { value: 'week', label: 'Past Week' },
  { value: 'month', label: 'Past Month' },
  { value: 'quarter', label: 'Past Quarter' },
  { value: 'year', label: 'Past Year' },
  { value: 'all', label: 'All Time' },
];

export default function FilterControls({ 
  filters, 
  onFiltersChange, 
  disabled = false 
}: FilterControlsProps) {
  
  // Dynamic subjects state
  const [availableSubjects, setAvailableSubjects] = useState<string[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  // Fetch available subjects on component mount
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setSubjectsLoading(true);
        setSubjectsError(null);
        
        console.log('🔍 FilterControls: Fetching available subjects...');
        const subjects = await authApi.getSubjects();
        
        console.log('✅ FilterControls: Subjects received:', subjects);
        setAvailableSubjects(subjects || []);
        
        // If current filter subject is not in available subjects, clear it
        if (filters.subject && subjects && !subjects.includes(filters.subject)) {
          console.log(`⚠️ FilterControls: Current filter subject "${filters.subject}" not available, clearing...`);
          onFiltersChange({ subject: undefined });
        }
        
      } catch (error) {
        console.error('❌ FilterControls: Failed to fetch subjects:', error);
        setSubjectsError(error instanceof Error ? error.message : 'Failed to load subjects');
        // Fallback to empty array
        setAvailableSubjects([]);
      } finally {
        setSubjectsLoading(false);
      }
    };

    fetchSubjects();
  }, []); // Run once on mount

  const hasActiveFilters = filters.subject || (filters.dateRange && filters.dateRange !== 'month');

  const clearFilters = () => {
    onFiltersChange({
      subject: undefined,
      dateRange: 'month',
      startDate: undefined,
      endDate: undefined
    });
  };

  const handleSubjectChange = (value: string) => {
    onFiltersChange({ 
      subject: value === 'all' ? undefined : value 
    });
  };

  const handleDateRangeChange = (value: string) => {
    onFiltersChange({ 
      dateRange: value as AnalyticsFilters['dateRange'],
      // Clear custom dates when using preset ranges
      startDate: undefined,
      endDate: undefined
    });
  };

  const retrySubjectsFetch = () => {
    setSubjectsError(null);
    setSubjectsLoading(true);
    // Re-trigger the effect by updating a dependency
    window.location.reload(); // Simple reload for now
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4" />
            <CardTitle className="text-base">Filters</CardTitle>
          </div>
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              disabled={disabled}
              className="h-8 px-2"
            >
              <X className="h-3 w-3 mr-1" />
              Clear
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          
          {/* Subject Filter - Dynamic */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Subject</label>
            
            {subjectsLoading ? (
              <div className="flex items-center justify-center h-10 border rounded-md bg-gray-50">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-primary"></div>
                  <span className="text-sm text-muted-foreground">Loading...</span>
                </div>
              </div>
            ) : subjectsError ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center h-10 border rounded-md bg-red-50 border-red-200">
                  <div className="flex items-center space-x-2">
                    <AlertCircle className="h-3 w-3 text-red-500" />
                    <span className="text-xs text-red-600">Failed to load</span>
                  </div>
                </div>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={retrySubjectsFetch}
                  className="w-full h-8"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Retry
                </Button>
              </div>
            ) : (
              <Select
                value={filters.subject || 'all'}
                onValueChange={handleSubjectChange}
                disabled={disabled || availableSubjects.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All subjects" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Subjects</SelectItem>
                  {availableSubjects.map((subject) => (
                    <SelectItem key={subject} value={subject}>
                      {subject}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            
            {/* Show subjects count when loaded */}
            {!subjectsLoading && !subjectsError && (
              <div className="text-xs text-muted-foreground">
                {availableSubjects.length} subject{availableSubjects.length !== 1 ? 's' : ''} available
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Time Period</label>
            <Select
              value={filters.dateRange || 'month'}
              onValueChange={handleDateRangeChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select period" />
              </SelectTrigger>
              <SelectContent>
                {DATE_RANGES.map((range) => (
                  <SelectItem key={range.value} value={range.value}>
                    {range.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Custom Date Range (Future Enhancement) */}
          <div className="space-y-2">
            <label className="text-sm font-medium">Custom Range</label>
            <Button
              variant="outline"
              disabled={true} // Disabled for now, can be implemented later
              className="w-full justify-start"
            >
              <Calendar className="h-4 w-4 mr-2" />
              Coming Soon
            </Button>
          </div>
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-4 pt-3 border-t border-border">
            <div className="flex flex-wrap gap-2">
              <span className="text-sm text-muted-foreground">Active filters:</span>
              
              {filters.subject && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-primary/10 text-primary">
                  Subject: {filters.subject}
                  <button
                    onClick={() => onFiltersChange({ subject: undefined })}
                    disabled={disabled}
                    className="ml-1 hover:bg-primary/20 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
              
              {filters.dateRange && filters.dateRange !== 'month' && (
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-secondary/50 text-secondary-foreground">
                  Period: {DATE_RANGES.find(d => d.value === filters.dateRange)?.label || filters.dateRange}
                  <button
                    onClick={() => onFiltersChange({ dateRange: 'month' })}
                    disabled={disabled}
                    className="ml-1 hover:bg-secondary/70 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              )}
            </div>
          </div>
        )}

        {/* Debug Info (remove in production) */}
        {process.env.NODE_ENV === 'development' && (
          <div className="mt-4 p-2 bg-gray-50 rounded text-xs">
            <div><strong>Debug:</strong></div>
            <div>Available subjects: {availableSubjects.join(', ') || 'None'}</div>
            <div>Current filter: {filters.subject || 'All'}</div>
            <div>Subjects loading: {subjectsLoading ? 'Yes' : 'No'}</div>
            {subjectsError && <div className="text-red-600">Error: {subjectsError}</div>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}