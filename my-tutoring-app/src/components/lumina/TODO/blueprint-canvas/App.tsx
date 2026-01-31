import React, { useState } from 'react';
import { Compass, PenTool, Layers, Layout, Info, ChevronRight, Download, ArrowLeft, Sofa } from 'lucide-react';
import { SketchPad } from './components/SketchPad';
import { PlanView } from './components/PlanView';
import { ElevationView } from './components/ElevationView';
import { RoomDetailView } from './components/RoomDetailView';
import { generateBlueprint, generateInterior } from './services/geminiService';
import { AppStatus, BuildingData, Room } from './types';

export default function App() {
  const [status, setStatus] = useState<AppStatus>(AppStatus.IDLE);
  const [buildingData, setBuildingData] = useState<BuildingData | null>(null);
  const [activeView, setActiveView] = useState<'plan' | 'elevation' | 'room'>('plan');
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleGenerate = async (imageData: string) => {
    setStatus(AppStatus.GENERATING);
    setErrorMsg(null);
    try {
      if (selectedRoomId && buildingData) {
        // We are generating interior for a specific room
        const room = buildingData.rooms.find(r => r.id === selectedRoomId);
        if (!room) throw new Error("Room not found");
        
        const furniture = await generateInterior(imageData, room.name);
        
        // Update the room with new interior data
        const updatedRooms = buildingData.rooms.map(r => 
          r.id === selectedRoomId ? { ...r, interior: furniture } : r
        );
        
        setBuildingData({ ...buildingData, rooms: updatedRooms });
        setActiveView('room'); // Ensure we are looking at the room detail
      } else {
        // We are generating the main building
        const data = await generateBlueprint(imageData);
        setBuildingData(data);
        setActiveView('plan');
      }
      setStatus(AppStatus.COMPLETE);
    } catch (e) {
      console.error(e);
      setStatus(AppStatus.ERROR);
      setErrorMsg("Failed to generate. Please try again with a clearer sketch.");
    }
  };

  const handleRoomSelect = (roomId: string) => {
    setSelectedRoomId(roomId);
    setActiveView('room');
    // NOTE: SketchPad will automatically reset via its internal useEffect when selectedRoomId changes (passed as prop name)
  };

  const handleBackToPlan = () => {
    setSelectedRoomId(null);
    setActiveView('plan');
  };

  const downloadJSON = () => {
    if (!buildingData) return;
    const blob = new Blob([JSON.stringify(buildingData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${buildingData.name.replace(/\s+/g, '_').toLowerCase()}_plans.json`;
    a.click();
  };

  const selectedRoom = buildingData?.rooms.find(r => r.id === selectedRoomId);

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col">
      {/* Header */}
      <header className="h-16 border-b border-slate-700 bg-slate-950 flex items-center justify-between px-6 sticky top-0 z-20 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <Compass size={24} className="text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-widest font-mono">
            ARCHI<span className="text-blue-500">SKETCH</span>.AI
          </h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 bg-slate-800 rounded-full border border-slate-700 text-xs font-mono text-slate-400">
             v1.1.0 • GEMINI 3 POWERED
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex flex-col lg:flex-row overflow-hidden h-[calc(100vh-4rem)]">
        
        {/* Left Panel: Input */}
        <div className="lg:w-1/2 p-4 flex flex-col border-r border-slate-800 bg-slate-900/50 transition-colors duration-300">
          
          {/* Navigation Breadcrumb */}
          {selectedRoom ? (
             <div className="mb-2 flex items-center gap-2">
               <button onClick={handleBackToPlan} className="p-1 hover:bg-slate-700 rounded text-slate-400 hover:text-white transition-colors">
                 <ArrowLeft size={16} />
               </button>
               <span className="text-sm font-mono text-slate-500">Master Plan</span>
               <ChevronRight size={14} className="text-slate-600"/>
               <span className="text-sm font-bold text-indigo-400">{selectedRoom.name}</span>
             </div>
          ) : (
             <div className="mb-2 h-7"></div> // Spacer
          )}

          <SketchPad 
            onGenerate={handleGenerate} 
            isGenerating={status === AppStatus.GENERATING} 
            selectedRoomName={selectedRoom?.name}
          />
          
          {/* Instructions / Status */}
          <div className="mt-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700 text-sm text-slate-400">
            {status === AppStatus.IDLE && !selectedRoom && (
              <p className="flex items-center gap-2">
                <Info size={16} /> Draw a floor plan shape above and click Convert.
              </p>
            )}
            {status === AppStatus.IDLE && selectedRoom && (
              <p className="flex items-center gap-2 text-indigo-300">
                <Sofa size={16} /> Sketch furniture layout for the {selectedRoom.name}.
              </p>
            )}
            {status === AppStatus.GENERATING && (
              <p className="flex items-center gap-2 text-blue-400 animate-pulse">
                <Layers size={16} /> {selectedRoom ? 'Designing interior...' : 'Analyzing structure geometry...'}
              </p>
            )}
             {status === AppStatus.ERROR && (
              <p className="flex items-center gap-2 text-red-400">
                <Info size={16} /> {errorMsg}
              </p>
            )}
            {status === AppStatus.COMPLETE && buildingData && !selectedRoom && (
              <div className="space-y-2">
                <h3 className="text-white font-bold flex items-center gap-2">
                  <PenTool size={14}/> {buildingData.name}
                </h3>
                <p>{buildingData.summary}</p>
                <div className="flex gap-2 mt-2">
                  <button onClick={downloadJSON} className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
                    <Download size={12} /> Export Data
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Output */}
        <div className="lg:w-1/2 bg-slate-950 relative flex flex-col">
          {/* Output Toolbar */}
          <div className="h-14 border-b border-slate-800 flex items-center px-4 justify-between bg-slate-900/80 backdrop-blur-sm">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Visualization</span>
            <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
              <button 
                onClick={() => { setSelectedRoomId(null); setActiveView('plan'); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeView === 'plan' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Layout size={14} /> Plan
              </button>
              <button 
                onClick={() => { setSelectedRoomId(null); setActiveView('elevation'); }}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeView === 'elevation' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
              >
                <Layers size={14} /> Elevation
              </button>
               {selectedRoom && (
                <button 
                  onClick={() => setActiveView('room')}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all flex items-center gap-2 ${activeView === 'room' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-400 hover:text-white'}`}
                >
                  <Sofa size={14} /> Interior
                </button>
              )}
            </div>
          </div>

          {/* Visualization Area */}
          <div className="flex-1 overflow-auto flex items-center justify-center bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-slate-900 via-slate-950 to-black">
            {!buildingData ? (
              <div className="text-center p-8 opacity-30">
                <div className="w-24 h-24 border-4 border-dashed border-slate-600 rounded-xl mx-auto mb-4 flex items-center justify-center">
                  <Layout size={40} className="text-slate-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-500">Awaiting Blueprint</h3>
                <p className="text-slate-600 mt-2">Generate a design to view technical drawings</p>
              </div>
            ) : (
              <div className="w-full h-full animate-in fade-in zoom-in duration-500">
                {activeView === 'plan' && (
                  <PlanView 
                    data={buildingData} 
                    onRoomSelect={handleRoomSelect} 
                    selectedRoomId={selectedRoomId}
                  />
                )}
                {activeView === 'elevation' && (
                  <ElevationView data={buildingData} />
                )}
                {activeView === 'room' && selectedRoom && (
                  <RoomDetailView room={selectedRoom} />
                )}
              </div>
            )}
          </div>
        </div>

      </main>
    </div>
  );
}