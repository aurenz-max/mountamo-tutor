import React from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface DashboardCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  linkText?: string;
  badge?: string;
  className?: string;
}

const DashboardCard: React.FC<DashboardCardProps> = ({
  title,
  description,
  icon,
  linkText = "Go to Dashboard",
  badge,
  className = "",
}) => {
  return (
    <Card className={`rounded-xl hover:shadow-lg transition-all duration-300 overflow-hidden ${className}`}>
      <div className="absolute top-0 right-0 mt-4 mr-4">
        {badge && (
          <Badge variant="outline" className="text-orange-500 border-orange-200 bg-orange-50">
            {badge}
          </Badge>
        )}
      </div>
      
      <CardHeader className="pt-8">
        <div className="h-16 flex items-center mb-6">
          {icon}
        </div>
        <CardTitle className="text-xl">{title}</CardTitle>
        <CardDescription className="text-gray-600">{description}</CardDescription>
      </CardHeader>
      
      <CardFooter className="flex justify-between items-center bg-gray-50 p-4">
        <Link href="/dashboard" className="w-full">
          <Button className="w-full flex justify-between items-center">
            {linkText}
            <ArrowRight size={16} />
          </Button>
        </Link>
      </CardFooter>
    </Card>
  );
};

export default DashboardCard;