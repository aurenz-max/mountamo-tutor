import React from 'react';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { X, Search } from 'lucide-react';
import type { PackageFilters } from '@/lib/packages/types';

interface SearchFiltersProps {
  filters: PackageFilters;
  onFiltersChange: (filters: PackageFilters) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export function SearchFilters({ filters, onFiltersChange, searchQuery, onSearchChange }: SearchFiltersProps) {
  const subjects = ['Science', 'Math', 'English', 'History', 'Art','Mathematics'];
  const difficulties = ['BEGINNER', 'INTERMEDIATE', 'ADVANCED'];

  const clearFilter = (key: keyof PackageFilters) => {
    const newFilters = { ...filters };
    delete newFilters[key];
    onFiltersChange(newFilters);
  };

  const clearAllFilters = () => {
    onFiltersChange({});
    onSearchChange('');
  };

  const activeFilterCount = Object.keys(filters).length + (searchQuery ? 1 : 0);

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Search packages by title, description, or concepts..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Filter Controls */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Select 
          value={filters.subject || 'all'} 
          onValueChange={(value) => 
            onFiltersChange({ 
              ...filters, 
              subject: value === 'all' ? undefined : value 
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Subject" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Subjects</SelectItem>
            {subjects.map((subject) => (
              <SelectItem key={subject} value={subject}>{subject}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.difficulty || 'all'} 
          onValueChange={(value) => 
            onFiltersChange({ 
              ...filters, 
              difficulty: value === 'all' ? undefined : value 
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Difficulty" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Levels</SelectItem>
            {difficulties.map((difficulty) => (
              <SelectItem key={difficulty} value={difficulty}>
                {difficulty.charAt(0) + difficulty.slice(1).toLowerCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select 
          value={filters.skill || 'all'} 
          onValueChange={(value) => 
            onFiltersChange({ 
              ...filters, 
              skill: value === 'all' ? undefined : value 
            })
          }
        >
          <SelectTrigger>
            <SelectValue placeholder="Skill Area" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Skills</SelectItem>
            <SelectItem value="Astronomy">Astronomy</SelectItem>
            <SelectItem value="Biology">Biology</SelectItem>
            <SelectItem value="Chemistry">Chemistry</SelectItem>
            <SelectItem value="Physics">Physics</SelectItem>
          </SelectContent>
        </Select>

        <div className="flex items-center space-x-2">
          {activeFilterCount > 0 && (
            <button
              onClick={clearAllFilters}
              className="text-sm text-muted-foreground hover:text-foreground flex items-center"
            >
              Clear all ({activeFilterCount})
            </button>
          )}
        </div>
      </div>

      {/* Active Filters */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {searchQuery && (
            <Badge variant="secondary" className="flex items-center gap-1">
              Search: "{searchQuery}"
              <X 
                className="h-3 w-3 cursor-pointer" 
                onClick={() => onSearchChange('')}
              />
            </Badge>
          )}
          {Object.entries(filters).map(([key, value]) => (
            value && (
              <Badge key={key} variant="secondary" className="flex items-center gap-1">
                {key}: {value}
                <X 
                  className="h-3 w-3 cursor-pointer" 
                  onClick={() => clearFilter(key as keyof PackageFilters)}
                />
              </Badge>
            )
          ))}
        </div>
      )}
    </div>
  );
}