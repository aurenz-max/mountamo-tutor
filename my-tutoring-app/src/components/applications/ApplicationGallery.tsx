// components/applications/ApplicationGallery.tsx
import { useState } from 'react';
import { useSimulations } from '@/contexts/SimulationContext';
import { ApplicationContainer } from './ApplicationContainer';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2 } from 'lucide-react';

export function ApplicationGallery() {
  const { simulations, loading, getSimulation } = useSimulations();
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');

  const filteredSimulations = activeTab === 'all' 
    ? simulations 
    : simulations.filter(sim => sim.metadata.category === activeTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin" />
      </div>
    );
  }

  if (selectedAppId) {
    const SimulationComponent = getSimulation(selectedAppId);
    if (!SimulationComponent) return null;

    return (
      <ApplicationContainer
        application={SimulationComponent}
        onBack={() => setSelectedAppId(null)}
        onTutorHelp={() => {
          console.log('Opening tutor for', SimulationComponent.metadata.title);
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="physics">Physics</TabsTrigger>
          <TabsTrigger value="chemistry">Chemistry</TabsTrigger>
          <TabsTrigger value="biology">Biology</TabsTrigger>
          <TabsTrigger value="astronomy">Astronomy</TabsTrigger>
          <TabsTrigger value="earth-science">Earth Science</TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredSimulations.map(simulation => (
              <ApplicationCard
                key={simulation.metadata.id}
                simulation={simulation}
                onLaunch={() => setSelectedAppId(simulation.metadata.id)}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}