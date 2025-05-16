// components/applications/ApplicationContainer.tsx
interface ApplicationContainerProps {
  application: SimulationComponent;
  onBack: () => void;
  onTutorHelp?: () => void;
}

export function ApplicationContainer({ 
  application: SimulationComponent, 
  onBack, 
  onTutorHelp
}: ApplicationContainerProps) {
  return (
    <div className="application-container">
      <Card className="h-full">
        <CardHeader className="flex flex-row items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <CardTitle className="text-xl">{SimulationComponent.metadata.title}</CardTitle>
          </div>
          {/* ... rest of your header */}
        </CardHeader>
        <CardContent className="h-[calc(100%-4rem)] overflow-auto">
          <SimulationComponent />
        </CardContent>
      </Card>
    </div>
  );
}