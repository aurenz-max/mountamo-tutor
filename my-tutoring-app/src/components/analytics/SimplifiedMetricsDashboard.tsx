// components/analytics/SimplifiedMetricsDashboard.tsx

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from '@/lib/api';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Sector
} from 'recharts';

// Import the CurriculumTree component
import CurriculumTree from '@/components/analytics/CurriculumTree';

interface SimplifiedMetricsDashboardProps {
  studentId: number;
}

// Helper function to determine level color
const getLevelColor = (value: number) => {
  if (value >= 90) return "#10b981"; // emerald-500
  if (value >= 75) return "#3b82f6"; // blue-500
  if (value >= 60) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
};

// Helper function to determine level text
const getLevelText = (value: number) => {
  if (value >= 90) return "Advanced";
  if (value >= 75) return "Proficient";
  if (value >= 60) return "Developing";
  return "Beginning";
};

// Custom active shape for pie chart
const CustomActiveShape = (props: any) => {
  const RADIAN = Math.PI / 180;
  const { cx, cy, midAngle, innerRadius, outerRadius, startAngle, endAngle, fill, payload, percent, value } = props;
  const sin = Math.sin(-RADIAN * midAngle);
  const cos = Math.cos(-RADIAN * midAngle);
  const sx = cx + (outerRadius + 10) * cos;
  const sy = cy + (outerRadius + 10) * sin;
  const mx = cx + (outerRadius + 30) * cos;
  const my = cy + (outerRadius + 30) * sin;
  const ex = mx + (cos >= 0 ? 1 : -1) * 22;
  const ey = my;
  const textAnchor = cos >= 0 ? 'start' : 'end';

  return (
    <g>
      <text x={cx} y={cy} dy={8} textAnchor="middle" fill={fill} className="text-lg font-semibold">
        {payload.subject}
      </text>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        startAngle={startAngle}
        endAngle={endAngle}
        innerRadius={outerRadius + 6}
        outerRadius={outerRadius + 10}
        fill={fill}
      />
      <path d={`M${sx},${sy}L${mx},${my}L${ex},${ey}`} stroke={fill} fill="none" />
      <circle cx={ex} cy={ey} r={2} fill={fill} stroke="none" />
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} textAnchor={textAnchor} fill="#333" className="text-sm">
        {`${value.toFixed(1)}%`}
      </text>
      <text x={ex + (cos >= 0 ? 1 : -1) * 12} y={ey} dy={18} textAnchor={textAnchor} fill="#999" className="text-xs">
        {`(${(percent * 100).toFixed(0)}%)`}
      </text>
    </g>
  );
};

const SimplifiedMetricsDashboard: React.FC<SimplifiedMetricsDashboardProps> = ({ studentId }) => {
  const [subjects, setSubjects] = useState<string[]>([]);
  const [metricsData, setMetricsData] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("summary");
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const fetchAndCalculateMetrics = async () => {
      setLoading(true);
      setError(null);
      
      try {
        // Step 1: Fetch available subjects
        const subjectsList = await api.getSubjects();
        setSubjects(subjectsList);
        
        // Step 2: For each subject, fetch curriculum and attempts data
        const metricsPromises = subjectsList.map(async (subject) => {
          try {
            // Get curriculum data (denominator)
            const curriculum = await api.getSubjectCurriculum(subject);
            
            // Get attempts data (numerator)
            const attempts = await api.getStudentAttempts(studentId, subject);
            
            // Calculate metrics
            return calculateMetrics(subject, curriculum, attempts);
          } catch (err) {
            console.error(`Error processing ${subject}:`, err);
            return {
              subject,
              mastery: 0,
              masteryLevel: "No Data",
              coverage: 0,
              proficiency: 0,
              attemptedItems: 0,
              totalItems: 0, 
              totalAttempts: 0,
              averageScore: 0
            };
          }
        });
        
        const calculatedMetrics = await Promise.all(metricsPromises);
        setMetricsData(calculatedMetrics);
      } catch (err) {
        console.error('Error fetching data:', err);
        setError('Failed to load metrics data. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchAndCalculateMetrics();
  }, [studentId]);

  // Calculate metrics from curriculum and attempts data
  const calculateMetrics = (subject: string, curriculum: any, attempts: any[]) => {
    try {
      // Count total items in curriculum
      const extractSubskillIds = (data: any): string[] => {
        const ids: string[] = [];
        
        if (Array.isArray(data)) {
          data.forEach(item => {
            if (item.units) ids.push(...extractSubskillIds(item.units));
            if (item.skills) ids.push(...extractSubskillIds(item.skills));
            if (item.subskills) ids.push(...extractSubskillIds(item.subskills));
            if (item.subskill_id) ids.push(item.subskill_id);
          });
        } else if (typeof data === 'object' && data !== null) {
          if (data.units) ids.push(...extractSubskillIds(data.units));
          if (data.skills) ids.push(...extractSubskillIds(data.skills));
          if (data.subskills) ids.push(...extractSubskillIds(data.subskills));
          if (data.subskill_id) ids.push(data.subskill_id);
        }
        
        return ids;
      };
      
      // Get all subskill IDs
      const subskillIds = extractSubskillIds(curriculum);
      
      // If no subskills found, estimate using structure count
      const totalItems = subskillIds.length || 
        (curriculum && Array.isArray(curriculum.units) ? curriculum.units.length * 5 : 10);
      
      // Group attempts by subskill_id
      const attemptsBySubskill: Record<string, any[]> = {};
      attempts.forEach(attempt => {
        if (!attemptsBySubskill[attempt.subskill_id]) {
          attemptsBySubskill[attempt.subskill_id] = [];
        }
        attemptsBySubskill[attempt.subskill_id].push(attempt);
      });
      
      // Count unique attempted subskills
      const attemptedItems = Object.keys(attemptsBySubskill).length;
      
      // Calculate average score across all attempts
      let totalScore = 0;
      let scoreCount = 0;
      
      attempts.forEach(attempt => {
        if (typeof attempt.score === 'number') {
          totalScore += attempt.score;
          scoreCount++;
        }
      });
      
      const averageScore = scoreCount > 0 ? totalScore / scoreCount : 0;
      
      // Calculate metrics
      // 1. Mastery = (Sum of average scores across attempted items) / (Total curriculum items)
      const mastery = totalItems > 0 ? (averageScore * attemptedItems) / (totalItems * 10) : 0;
      
      // 2. Coverage = (Attempted items) / (Total items)
      const coverage = totalItems > 0 ? attemptedItems / totalItems : 0;
      
      // 3. Proficiency = Average score on attempted items
      const proficiency = scoreCount > 0 ? averageScore / 10 : 0;
      
      return {
        subject,
        mastery: Math.round(mastery * 100),
        masteryLevel: getLevelText(mastery * 100),
        coverage: Math.round(coverage * 100),
        proficiency: Math.round(proficiency * 100),
        attemptedItems,
        totalItems,
        totalAttempts: attempts.length,
        averageScore: Math.round(averageScore * 10) / 10
      };
    } catch (err) {
      console.error(`Error calculating metrics for ${subject}:`, err);
      return {
        subject,
        mastery: 0,
        masteryLevel: "Error",
        coverage: 0,
        proficiency: 0,
        attemptedItems: 0,
        totalItems: 0,
        totalAttempts: 0,
        averageScore: 0
      };
    }
  };

  // Handle pie chart hover
  const onPieEnter = (_: any, index: number) => {
    setActiveIndex(index);
  };

  // Loading skeletons
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-8 w-40" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-24 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">Error Loading Metrics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-700">{error}</p>
        </CardContent>
      </Card>
    );
  }

  // Empty state
  if (metricsData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Data Available</CardTitle>
        </CardHeader>
        <CardContent>
          <p>No metrics data could be calculated for this student.</p>
        </CardContent>
      </Card>
    );
  }

  // Get overall metrics by averaging across subjects with data
  const validMetrics = metricsData.filter(m => m.mastery > 0 || m.proficiency > 0 || m.coverage > 0);
  
  const overallMastery = validMetrics.length > 0 
    ? Math.round(validMetrics.reduce((sum, item) => sum + item.mastery, 0) / validMetrics.length)
    : 0;
  
  const overallProficiency = validMetrics.length > 0
    ? Math.round(validMetrics.reduce((sum, item) => sum + item.proficiency, 0) / validMetrics.length)
    : 0;
  
  const totalAttempts = metricsData.reduce((sum, item) => sum + item.totalAttempts, 0);
  
  const overallCoverage = validMetrics.length > 0
    ? Math.round(validMetrics.reduce((sum, item) => sum + item.coverage, 0) / validMetrics.length)
    : 0;

  // Prepare data for mastery vs proficiency chart
  const comparisonData = metricsData
    .filter(item => item.totalAttempts > 0)
    .map(item => ({
      subject: item.subject,
      mastery: item.mastery,
      proficiency: item.proficiency,
      coverage: item.coverage,
      masteryColor: getLevelColor(item.mastery),
      proficiencyColor: getLevelColor(item.proficiency)
    }));

  // Prepare data for attempts chart
  const attemptsData = metricsData.map(item => ({
    subject: item.subject,
    attempts: item.totalAttempts,
    averageScore: item.averageScore,
    coverage: item.coverage
  }));

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-2 w-[400px]">
          <TabsTrigger value="summary">Metrics Summary</TabsTrigger>
          <TabsTrigger value="curriculum">Curriculum Tree</TabsTrigger>
        </TabsList>
        
        {/* Metrics Summary Tab */}
        <TabsContent value="summary" className="space-y-6">
          {/* Metric Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Overall Mastery Card */}
            <Card className="border-l-4" style={{ borderLeftColor: getLevelColor(overallMastery) }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Overall Mastery</CardTitle>
                <CardDescription>
                  Achievement across curriculum
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {overallMastery}%
                </div>
                <Progress 
                  value={overallMastery} 
                  className="h-2 mb-2"
                  indicatorClassName="bg-gradient-to-r from-blue-400 to-blue-600"
                />
                <p className="text-sm text-muted-foreground">
                  Level: {getLevelText(overallMastery)}
                </p>
              </CardContent>
            </Card>
            
            {/* Proficiency Card */}
            <Card className="border-l-4" style={{ borderLeftColor: getLevelColor(overallProficiency) }}>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Proficiency</CardTitle>
                <CardDescription>
                  Performance on attempted items
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {overallProficiency}%
                </div>
                <Progress 
                  value={overallProficiency} 
                  className="h-2 mb-2"
                  indicatorClassName="bg-gradient-to-r from-violet-400 to-violet-600"
                />
                <p className="text-sm text-muted-foreground">
                  Level: {getLevelText(overallProficiency)}
                </p>
              </CardContent>
            </Card>
            
            {/* Problem Attempts Card */}
            <Card className="border-l-4 border-l-emerald-500">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg">Problem Attempts</CardTitle>
                <CardDescription>
                  Coverage and total attempts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold mb-2">
                  {totalAttempts}
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Coverage:</span>
                    <span className="font-medium">{overallCoverage}%</span>
                  </div>
                  <Progress 
                    value={overallCoverage} 
                    className="h-2"
                    indicatorClassName="bg-gradient-to-r from-emerald-400 to-emerald-600"
                  />
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Subject Comparison Charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mastery vs Proficiency Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Mastery vs Proficiency by Subject</CardTitle>
                <CardDescription>
                  Comparing overall achievement with performance
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={comparisonData}
                      margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                      barGap={0}
                      barCategoryGap="20%"
                    >
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis 
                        dataKey="subject" 
                        angle={-45} 
                        textAnchor="end" 
                        height={70}
                        interval={0}
                      />
                      <YAxis domain={[0, 100]} />
                      <Tooltip formatter={(value) => `${value}%`} />
                      <Legend />
                      <Bar dataKey="mastery" name="Mastery" fill="#3b82f6">
                        {
                          comparisonData.map((entry, index) => (
                            <Cell key={`cell-mastery-${index}`} fill={entry.masteryColor} />
                          ))
                        }
                      </Bar>
                      <Bar dataKey="proficiency" name="Proficiency" fill="#8b5cf6">
                        {
                          comparisonData.map((entry, index) => (
                            <Cell key={`cell-proficiency-${index}`} fill={entry.proficiencyColor} />
                          ))
                        }
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
            
            {/* Subject Progress Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Subject Progress</CardTitle>
                <CardDescription>
                  Mastery distribution by subject
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        activeIndex={activeIndex}
                        activeShape={CustomActiveShape}
                        data={metricsData.filter(item => item.mastery > 0)}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="mastery"
                        nameKey="subject"
                        onMouseEnter={onPieEnter}
                      >
                        {metricsData.filter(item => item.mastery > 0).map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={getLevelColor(entry.mastery)} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => `${value}%`} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Attempts by Subject */}
          <Card>
            <CardHeader>
              <CardTitle>Problem Attempts by Subject</CardTitle>
              <CardDescription>
                Number of attempts and average scores
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={attemptsData.filter(item => item.attempts > 0)}
                    margin={{ top: 20, right: 30, left: 20, bottom: 70 }}
                    barGap={8}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis 
                      dataKey="subject" 
                      angle={-45} 
                      textAnchor="end" 
                      height={70}
                      interval={0}
                    />
                    <YAxis yAxisId="left" label={{ value: 'Attempts', angle: -90, position: 'insideLeft' }} />
                    <YAxis yAxisId="right" orientation="right" domain={[0, 10]} label={{ value: 'Avg Score', angle: 90, position: 'insideRight' }} />
                    <Tooltip />
                    <Legend />
                    <Bar yAxisId="left" dataKey="attempts" name="Attempts" fill="#10b981" />
                    <Bar yAxisId="right" dataKey="averageScore" name="Avg Score" fill="#f59e0b" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        {/* Curriculum Tree Tab - Simply embed the CurriculumTree component */}
        <TabsContent value="curriculum">
          <CurriculumTree studentId={studentId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default SimplifiedMetricsDashboard;