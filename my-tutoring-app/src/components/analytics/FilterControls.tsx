// src/components/analytics/FilterControls.tsx
'use client'

import React, { useState, useEffect } from 'react'
import { useAnalytics } from './StudentAnalytics'
import { 
  Select, 
  SelectContent, 
  SelectGroup, 
  SelectItem, 
  SelectLabel, 
  SelectTrigger, 
  SelectValue 
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { CalendarIcon, RefreshCwIcon } from 'lucide-react'
import { format } from 'date-fns'
import { cn } from '@/lib/utils'
import { api } from '@/lib/api' // Import the api object that has getSubjects()

export default function FilterControls() {
  const { 
    studentId, 
    subject, 
    grade, 
    startDate, 
    endDate, 
    setStudentId, 
    setSubject, 
    setGrade, 
    setDateRange, 
    refreshData 
  } = useAnalytics()
  
  const [subjects, setSubjects] = useState<string[]>([])
  const [isLoadingSubjects, setIsLoadingSubjects] = useState(false)
  const [subjectsError, setSubjectsError] = useState<string | null>(null)
  
  // Define some student options (you could also fetch these from an API)
  const studentOptions = [
    { id: 1, name: 'Student #1' },
    { id: 2, name: 'Student #2' },
    { id: 3, name: 'Student #3' },
    { id: 4, name: 'Student #4' },
  ]
  
  // Define grade options
  const gradeOptions = [
    'Preschool',
    'Kindergarten',
    'Grade 1',
    'Grade 2',
    'Grade 3',
    'Grade 4',
    'Grade 5',
    'Grade 6',
    'Grade 7',
    'Grade 8',
  ]

  // Convert string dates to Date objects for the calendar component
  const fromDate = startDate ? new Date(startDate) : undefined
  const toDate = endDate ? new Date(endDate) : undefined
  
  // Format a date for display
  const formatDate = (dateString?: string) => {
    if (!dateString) return 'Select date'
    return format(new Date(dateString), 'PPP')
  }

  // Fetch subjects from the API
  useEffect(() => {
    const fetchSubjects = async () => {
      setIsLoadingSubjects(true)
      setSubjectsError(null)
      try {
        const subjectList = await api.getSubjects()
        setSubjects(subjectList)
      } catch (error) {
        console.error('Error fetching subjects:', error)
        setSubjectsError('Failed to load subjects')
        // Fallback to some default subjects
        setSubjects(['Mathematics', 'English', 'Science', 'Social Studies'])
      } finally {
        setIsLoadingSubjects(false)
      }
    }
    
    fetchSubjects()
  }, [])

  // Handle date range selection
  const handleDateRangeChange = (range: { from?: Date; to?: Date }) => {
    const from = range.from ? format(range.from, 'yyyy-MM-dd') : null
    const to = range.to ? format(range.to, 'yyyy-MM-dd') : null
    setDateRange(from, to)
  }

  return (
    <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-lg">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 w-full">
        <div>
          <label className="text-sm font-medium mb-1 block">Student:</label>
          <Select value={studentId.toString()} onValueChange={(value) => setStudentId(parseInt(value))}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select Student" />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Students</SelectLabel>
                {studentOptions.map((student) => (
                  <SelectItem key={student.id} value={student.id.toString()}>
                    {student.name}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Subject:</label>
          <Select 
            value={subject || 'all'} 
            onValueChange={(value) => setSubject(value === 'all' ? null : value)}
            disabled={isLoadingSubjects}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder={isLoadingSubjects ? "Loading subjects..." : "All Subjects"} />
            </SelectTrigger>
            <SelectContent>
              <SelectGroup>
                <SelectLabel>Subjects</SelectLabel>
                <SelectItem value="all">All Subjects</SelectItem>
                {subjects.map((subj) => (
                  <SelectItem key={subj} value={subj}>
                    {subj}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
          {subjectsError && (
            <p className="text-red-500 text-xs mt-1">{subjectsError}</p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">Date Range:</label>
          <Popover>
            <PopoverTrigger asChild>
              <Button 
                variant="outline"
                className={cn(
                  "w-full justify-start text-left font-normal",
                  !startDate && !endDate && "text-muted-foreground"
                )}
              >
                <CalendarIcon className="mr-2 h-4 w-4" />
                {startDate || endDate ? (
                  <>
                    {formatDate(startDate)} - {formatDate(endDate)}
                  </>
                ) : (
                  "All Time"
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                initialFocus
                mode="range"
                selected={{ 
                  from: fromDate,
                  to: toDate
                }}
                onSelect={handleDateRangeChange}
                numberOfMonths={2}
              />
              <div className="p-3 border-t flex justify-between">
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setDateRange(null, null)}
                >
                  Clear
                </Button>
                <Button 
                  size="sm"
                  onClick={() => {
                    const today = new Date()
                    const thirtyDaysAgo = new Date()
                    thirtyDaysAgo.setDate(today.getDate() - 30)
                    setDateRange(
                      format(thirtyDaysAgo, 'yyyy-MM-dd'),
                      format(today, 'yyyy-MM-dd')
                    )
                  }}
                >
                  Last 30 Days
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>

        <div className="flex items-end"> 
          <Button 
            className="w-full"
            onClick={() => refreshData()}
          >
            <RefreshCwIcon className="mr-2 h-4 w-4" /> 
            Refresh Data
          </Button>
        </div>
      </div>
    </div>
  )
}