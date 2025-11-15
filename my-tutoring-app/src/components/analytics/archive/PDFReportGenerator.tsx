import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, FileText, Download, Calendar, Settings } from "lucide-react";
import { api } from '@/lib/api';
import { PDFReportOptions, PDFReportMetadata } from '@/lib/api';

const PDFReportGenerator = ({ studentId, subject, onReportGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [reports, setReports] = useState<PDFReportMetadata[]>([]);
  const [reportsLoading, setReportsLoading] = useState(false);
  const [reportType, setReportType] = useState<'comprehensive' | 'subject' | 'gap_analysis' | 'progress'>('comprehensive');
  const [reportFormat, setReportFormat] = useState<'detailed' | 'standard' | 'summary'>('standard');
  const [orientation, setOrientation] = useState<'portrait' | 'landscape'>('portrait');
  const [timePeriod, setTimePeriod] = useState<'week' | 'month' | 'quarter' | 'year' | 'all'>('month');
  const [includeGaps, setIncludeGaps] = useState(true);
  const [includeRecommendations, setIncludeRecommendations] = useState(true);
  const [includeMasteryMap, setIncludeMasteryMap] = useState(true);
  const [includeProgress, setIncludeProgress] = useState(true);
  const [includeProblemReviews, setIncludeProblemReviews] = useState(false);
  const [activeTab, setActiveTab] = useState<'generate' | 'history'>('generate');

  // Function to load previously generated reports
  const loadReports = async () => {
    if (activeTab !== 'history') return;
    
    try {
      setReportsLoading(true);
      const reportsList = await api.listPDFReports(studentId);
      setReports(reportsList);
      setReportsLoading(false);
    } catch (error) {
      console.error('Error loading reports:', error);
      setReportsLoading(false);
    }
  };

  // When tab changes, load reports if on history tab
  React.useEffect(() => {
    if (activeTab === 'history') {
      loadReports();
    }
  }, [activeTab]);

  // Function to generate a PDF report
  const generateReport = async () => {
    try {
      setLoading(true);
      
      // Collect selected sections
      const sections = [];
      if (includeGaps) sections.push('gaps');
      if (includeRecommendations) sections.push('recommendations');
      if (includeMasteryMap) sections.push('mastery_map');
      if (includeProgress) sections.push('progress');
      if (includeProblemReviews) sections.push('problem_reviews');
      
      const options: PDFReportOptions = {
        student_id: studentId,
        report_type: reportType,
        format: reportFormat,
        orientation: orientation,
        time_period: timePeriod,
        sections: sections
      };
      
      // Add subject if not comprehensive
      if (reportType !== 'comprehensive' && subject) {
        options.subject = subject;
      }
      
      const result = await api.generatePDFReport(options);
      
      if (onReportGenerated) {
        onReportGenerated(result);
      }
      
      setLoading(false);
      
      // Switch to history tab and refresh the list
      setActiveTab('history');
    } catch (error) {
      console.error('Error generating report:', error);
      setLoading(false);
    }
  };

  // Function to download a report
  const downloadReport = async (reportId: string) => {
    try {
      const blob = await api.downloadPDFReport(reportId);
      
      // Create a temporary URL for the blob
      const url = window.URL.createObjectURL(blob);
      
      // Create a temporary link element
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `report-${reportId}.pdf`);
      
      // Append to the document and trigger click
      document.body.appendChild(link);
      link.click();
      
      // Clean up
      link.parentNode?.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading report:', error);
    }
  };

  // Function to format date string
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          PDF Reports
        </CardTitle>
        <CardDescription>
          Generate and manage PDF reports
        </CardDescription>
      </CardHeader>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="px-6">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="generate">Generate Report</TabsTrigger>
            <TabsTrigger value="history">Report History</TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="generate">
          <CardContent>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Report Type</Label>
                <RadioGroup value={reportType} onValueChange={(value: any) => setReportType(value)} className="flex flex-col space-y-1">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="comprehensive" id="comprehensive" />
                    <Label htmlFor="comprehensive">Comprehensive (All Subjects)</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="subject" id="subject" />
                    <Label htmlFor="subject">Subject-specific</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="gap_analysis" id="gap_analysis" />
                    <Label htmlFor="gap_analysis">Gap Analysis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value="progress" id="progress" />
                    <Label htmlFor="progress">Progress Report</Label>
                  </div>
                </RadioGroup>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Detail Level</Label>
                  <Select value={reportFormat} onValueChange={(value: any) => setReportFormat(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select format" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="summary">Summary</SelectItem>
                      <SelectItem value="standard">Standard</SelectItem>
                      <SelectItem value="detailed">Detailed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Time Period</Label>
                  <Select value={timePeriod} onValueChange={(value: any) => setTimePeriod(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select time period" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="week">Last Week</SelectItem>
                      <SelectItem value="month">Last Month</SelectItem>
                      <SelectItem value="quarter">Last Quarter</SelectItem>
                      <SelectItem value="year">Last Year</SelectItem>
                      <SelectItem value="all">All Time</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Orientation</Label>
                  <Select value={orientation} onValueChange={(value: any) => setOrientation(value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select orientation" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="portrait">Portrait</SelectItem>
                      <SelectItem value="landscape">Landscape</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label>Include Sections</Label>
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox id="gaps" checked={includeGaps} onCheckedChange={(checked) => setIncludeGaps(!!checked)} />
                    <Label htmlFor="gaps">Gap Analysis</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="recommendations" checked={includeRecommendations} onCheckedChange={(checked) => setIncludeRecommendations(!!checked)} />
                    <Label htmlFor="recommendations">Recommendations</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="mastery_map" checked={includeMasteryMap} onCheckedChange={(checked) => setIncludeMasteryMap(!!checked)} />
                    <Label htmlFor="mastery_map">Mastery Map</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="progress" checked={includeProgress} onCheckedChange={(checked) => setIncludeProgress(!!checked)} />
                    <Label htmlFor="progress">Progress Charts</Label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox id="problem_reviews" checked={includeProblemReviews} onCheckedChange={(checked) => setIncludeProblemReviews(!!checked)} />
                    <Label htmlFor="problem_reviews">Problem Reviews</Label>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            <Button 
              className="w-full" 
              onClick={generateReport} 
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating Report...
                </>
              ) : (
                <>
                  <FileText className="mr-2 h-4 w-4" />
                  Generate PDF Report
                </>
              )}
            </Button>
          </CardFooter>
        </TabsContent>
        
        <TabsContent value="history">
          <CardContent>
            {reportsLoading ? (
              <div className="flex justify-center items-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reports.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No reports have been generated yet
              </div>
            ) : (
              <div className="space-y-3">
                {reports.map((report) => (
                  <div key={report.report_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <div className="font-medium">
                        {report.report_type.charAt(0).toUpperCase() + report.report_type.slice(1)} Report
                      </div>
                      <div className="text-sm text-muted-foreground">
                        Generated: {formatDate(report.generation_date)}
                      </div>
                    </div>
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={() => downloadReport(report.report_id)}
                    >
                      <Download className="h-4 w-4 mr-1" />
                      Download
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
          <CardFooter className="flex justify-between">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={loadReports}
              disabled={reportsLoading}
            >
              Refresh List
            </Button>
            
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <Calendar className="h-4 w-4 mr-1" />
                  Schedule Reports
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-80">
                <div className="space-y-4">
                  <h4 className="font-medium">Schedule Automated Reports</h4>
                  <p className="text-sm text-muted-foreground">
                    Configure automatic generation of reports at regular intervals.
                  </p>
                  <div className="space-y-2">
                    <Label>Frequency</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button className="w-full">
                    <Settings className="h-4 w-4 mr-1" />
                    Configure Schedule
                  </Button>
                </div>
              </PopoverContent>
            </Popover>
          </CardFooter>
        </TabsContent>
      </Tabs>
    </Card>
  );
};

export default PDFReportGenerator;