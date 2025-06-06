// app/packages/browse/page.tsx
'use client';

import React, { useState, useMemo } from 'react';
import { PackageCard } from '@/components/packages/PackageCard';
import { SearchFilters } from '@/components/packages/SearchFilters';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Grid3X3, List, BookOpen } from 'lucide-react';
import { usePackages } from '@/lib/packages/hooks';
import type { PackageFilters } from '@/lib/packages/types';

export default function PackageBrowsePage() {
  const [filters, setFilters] = useState<PackageFilters>({ status: 'approved', limit: 50 });
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  const { packages, loading, error, totalCount } = usePackages(filters);

  // Filter packages by search query
  const filteredPackages = useMemo(() => {
    if (!searchQuery.trim()) return packages;
    
    const query = searchQuery.toLowerCase();
    return packages.filter(pkg => 
      pkg.title.toLowerCase().includes(query) ||
      pkg.description.some(desc => desc.toLowerCase().includes(query)) ||
      pkg.subject.toLowerCase().includes(query) ||
      pkg.skill.toLowerCase().includes(query) ||
      pkg.subskill.toLowerCase().includes(query) ||
      pkg.learning_objectives.some(obj => obj.toLowerCase().includes(query))
    );
  }, [packages, searchQuery]);

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="p-8 text-center">
          <CardContent>
            <div className="text-red-600 mb-4">
              <BookOpen className="h-12 w-12 mx-auto mb-4" />
              <h2 className="text-xl font-semibold mb-2">Unable to Load Packages</h2>
              <p className="text-muted-foreground">{error}</p>
            </div>
            <Button onClick={() => window.location.reload()}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
          Enhanced Learning Packages
        </h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Discover rich, interactive educational content with AI-powered tutoring. 
          Each package combines reading materials, visualizations, audio content, and practice problems 
          for a comprehensive learning experience.
        </p>
      </div>

      {/* Search and Filters */}
      <div className="mb-8">
        <SearchFilters
          filters={filters}
          onFiltersChange={setFilters}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
        />
      </div>

      {/* Results Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="text-sm text-muted-foreground">
          {loading ? (
            'Loading packages...'
          ) : (
            `${filteredPackages.length} of ${totalCount} packages${searchQuery ? ` matching "${searchQuery}"` : ''}`
          )}
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            <Grid3X3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Package Grid/List */}
      {loading ? (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="h-96">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <Skeleton className="h-4 w-full mb-2" />
                <Skeleton className="h-4 w-2/3 mb-4" />
                <Skeleton className="h-20 w-full mb-4" />
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredPackages.length === 0 ? (
        <Card className="p-12 text-center">
          <CardContent>
            <BookOpen className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-xl font-semibold mb-2">No packages found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 
                `No packages match your search for "${searchQuery}". Try adjusting your filters or search terms.` :
                'No packages match your current filters. Try adjusting your search criteria.'
              }
            </p>
            <Button variant="outline" onClick={() => {
              setFilters({ status: 'approved', limit: 50 });
              setSearchQuery('');
            }}>
              Clear All Filters
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className={viewMode === 'grid' 
          ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' 
          : 'space-y-4'
        }>
          {filteredPackages.map((pkg) => (
            <PackageCard key={pkg.id} package={pkg} />
          ))}
        </div>
      )}
    </div>
  );
}