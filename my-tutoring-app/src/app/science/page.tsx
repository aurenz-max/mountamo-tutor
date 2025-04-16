'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import dynamic from 'next/dynamic';

// Icons for different simulation types
import { Atom, Wind, Droplets, SunMedium, Waves, Rocket, FlaskConical, HelpCircle } from "lucide-react";

// Also use dynamic import for the AI Tutor component
const EnhancedGeminiTutor = dynamic(() => import('@/components/GeminiEnhancedTutor'), {
  ssr: false
});

export default function ScienceAggregatorPage() {
  const [selectedSimulation, setSelectedSimulation] = useState(null);
  const [geminiOpen, setGeminiOpen] = useState(false);

  // All science simulations with their metadata including educational parameters
  const simulations = [
    {
      id: 'bohr',
      title: 'Bohr Model',
      description: 'Explore the Bohr model of atomic structure and electron energy levels',
      category: 'physics',
      difficulty: 'intermediate',
      icon: <Atom className="h-6 w-6" />,
      subject: 'Chemistry',
      skill: 'Atomic Structure',
      subskill: 'Bohr Model'
    },
    {
      id: 'catapult',
      title: 'Catapult Physics',
      description: 'Learn about projectile motion with an interactive catapult simulation',
      category: 'physics',
      difficulty: 'beginner',
      icon: <Rocket className="h-6 w-6" />,
      subject: 'Physics',
      skill: 'Mechanics',
      subskill: 'Projectile Motion'
    },
    {
      id: 'gas',
      title: 'Ideal Gas Law',
      description: 'Interactive visualization of gas behavior following PV=nRT',
      category: 'chemistry',
      difficulty: 'intermediate',
      icon: <Wind className="h-6 w-6" />,
      subject: 'Chemistry',
      skill: 'Gas Laws',
      subskill: 'Ideal Gas Behavior'
    },
    {
      id: 'mitochondria',
      title: 'Mitochondria Function',
      description: 'Explore how mitochondria produce energy through cellular respiration',
      category: 'biology',
      difficulty: 'advanced',
      icon: <FlaskConical className="h-6 w-6" />,
      subject: 'Biology',
      skill: 'Cellular Respiration',
      subskill: 'Mitochondrial Function'
    },
    {
      id: 'osmosis',
      title: 'Osmosis Simulation',
      description: 'Visualize how water moves across semi-permeable membranes',
      category: 'biology',
      difficulty: 'beginner',
      icon: <Droplets className="h-6 w-6" />,
      subject: 'Biology',
      skill: 'Cell Transport',
      subskill: 'Osmosis'
    },
    {
      id: 'solar-system',
      title: 'Solar System Model',
      description: 'Interactive model of our solar system with planet information',
      category: 'astronomy',
      difficulty: 'beginner',
      icon: <SunMedium className="h-6 w-6" />,
      subject: 'Astronomy',
      skill: 'Solar System',
      subskill: 'Planetary Motion'
    },
    {
      id: 'tides',
      title: 'Ocean Tides',
      description: 'Understand how the moon and sun affect Earth\'s tides',
      category: 'earth-science',
      difficulty: 'intermediate',
      icon: <Waves className="h-6 w-6" />,
      subject: 'Earth Science',
      skill: 'Oceanography',
      subskill: 'Tidal Forces'
    },
  ];

  // Get unique categories for filtering
  const categories = [...new Set(simulations.map(sim => sim.category))];
  
  // Function to get badge color based on difficulty
  const getDifficultyColor = (difficulty) => {
    switch(difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 hover:bg-green-200';
      case 'intermediate':
        return 'bg-blue-100 text-blue-800 hover:bg-blue-200';
      case 'advanced':
        return 'bg-purple-100 text-purple-800 hover:bg-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 hover:bg-gray-200';
    }
  };

  // Handle opening the AI tutor dialog
  const handleOpenAITutor = (simulation) => {
    setSelectedSimulation(simulation);
    setGeminiOpen(true);
  };

  return (
    <div className="container mx-auto p-6">
      <div className="flex flex-col gap-2 mb-8">
        <h1 className="text-3xl font-bold">Science Simulations</h1>
        <p className="text-muted-foreground">
          Explore interactive science demonstrations across various disciplines
        </p>
        
        <div className="mt-2 bg-blue-50 border border-blue-200 rounded-lg p-3 flex items-center">
          <HelpCircle className="h-5 w-5 text-blue-500 mr-2" />
          <p className="text-sm text-blue-700">
            Need help understanding a concept? Click the "AI Tutor" button on any simulation card to get real-time explanations.
          </p>
        </div>
      </div>

      <Tabs defaultValue="all" className="mb-8">
        <TabsList className="mb-4">
          <TabsTrigger value="all">All</TabsTrigger>
          {categories.map(category => (
            <TabsTrigger key={category} value={category}>
              {category.charAt(0).toUpperCase() + category.slice(1)}
            </TabsTrigger>
          ))}
        </TabsList>
        
        <TabsContent value="all">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {simulations.map((sim) => (
              <SimulationCard 
                key={sim.id} 
                simulation={sim} 
                onOpenAITutor={() => handleOpenAITutor(sim)}
              />
            ))}
          </div>
        </TabsContent>

        {categories.map(category => (
          <TabsContent key={category} value={category}>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {simulations
                .filter(sim => sim.category === category)
                .map((sim) => (
                  <SimulationCard 
                    key={sim.id} 
                    simulation={sim} 
                    onOpenAITutor={() => handleOpenAITutor(sim)}
                  />
                ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
      
      {/* Gemini AI Tutor Dialog */}
      <Dialog open={geminiOpen} onOpenChange={setGeminiOpen}>
        <DialogContent className="max-w-4xl h-[80vh]">
          <DialogHeader>
            <DialogTitle>
              {selectedSimulation && `AI Tutor - ${selectedSimulation.title}`}
            </DialogTitle>
          </DialogHeader>
          <div className="flex flex-col h-full">
            {selectedSimulation && (
              <EnhancedGeminiTutor
                simulationTitle={selectedSimulation.title}
                simulationDescription={selectedSimulation.description}
                subject={selectedSimulation.subject}
                skill={selectedSimulation.skill}
                subskill={selectedSimulation.subskill}
                className="h-full"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Component for individual simulation cards
function SimulationCard({ simulation, onOpenAITutor }) {
  const difficultyColor = 
    simulation.difficulty === 'beginner' ? 'bg-green-100 text-green-800' :
    simulation.difficulty === 'intermediate' ? 'bg-blue-100 text-blue-800' :
    'bg-purple-100 text-purple-800';

  return (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {simulation.icon}
            <CardTitle>{simulation.title}</CardTitle>
          </div>
          <Badge variant="outline" className={difficultyColor}>
            {simulation.difficulty}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm text-gray-600 min-h-12">
          {simulation.description}
        </CardDescription>
      </CardContent>
      <CardFooter className="pt-3 flex justify-between items-center">
        <Badge variant="outline">
          {simulation.category.charAt(0).toUpperCase() + simulation.category.slice(1)}
        </Badge>
        <div className="flex space-x-2">
          <Link href={`/science/${simulation.id}`}>
            <Button variant="default" size="sm">
              Launch Simulation
            </Button>
          </Link>
          <Button 
            variant="outline" 
            size="sm"
            onClick={onOpenAITutor}
          >
            AI Tutor
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}