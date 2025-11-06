import React, { useState, useEffect } from 'react';
import { authApi } from '@/lib/authApiClient';
import { useAuth } from '@/contexts/AuthContext';
import UnitCard from './UnitCard';
import SkillCard from './SkillCard';
import SubskillCard from './SubskillCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight } from 'lucide-react';

// Define types for our curriculum structure
interface Subskill {
  id: string;
  description: string;
  difficulty_range: [number, number];
}

interface Skill {
  id: string;
  description: string;
  subskills: Subskill[];
}

interface Unit {
  id: string;
  title: string;
  description: string;
  skills: Skill[];
}

interface CurriculumExplorerProps {
  onSelect: (selection: any) => void;
}

const CurriculumExplorer: React.FC<CurriculumExplorerProps> = ({ onSelect }) => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<string[]>([]);
  const [currentSubject, setCurrentSubject] = useState('');
  const [curriculumData, setCurriculumData] = useState<Unit[] | null>(null);
  const [viewLevel, setViewLevel] = useState('subjects'); // subjects, units, skills, subskills
  const [currentUnit, setCurrentUnit] = useState<Unit | null>(null);
  const [currentSkill, setCurrentSkill] = useState<Skill | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadSubjects = async () => {
      if (!user) return;
      try {
        const availableSubjects = await authApi.getSubjects() as string[];
        setSubjects(availableSubjects);
      } catch (err) {
        setError('Failed to load subjects.');
      }
    };
    loadSubjects();
  }, [user]);

  useEffect(() => {
    if (!currentSubject || !user) return;

    const fetchCurriculum = async () => {
      setLoading(true);
      setError('');
      try {
        const data = await authApi.getSubjectCurriculum(currentSubject) as { curriculum: Unit[] };
        setCurriculumData(data.curriculum);
        setViewLevel('units');
      } catch (err) {
        setError('Failed to load curriculum.');
      } finally {
        setLoading(false);
      }
    };

    fetchCurriculum();
  }, [currentSubject, user]);

  const handleUnitClick = (unitId: string) => {
    if (!curriculumData) return;
    const unit = curriculumData.find(u => u.id === unitId);
    setCurrentUnit(unit || null);
    setViewLevel('skills');
  };

  const handleSkillClick = (skillId: string) => {
    if (!currentUnit) return;
    const skill = currentUnit.skills.find(s => s.id === skillId);
    setCurrentSkill(skill || null);
    setViewLevel('subskills');
  };

  const handleSubskillSelect = (subskillId: string) => {
    if (!currentSkill || !currentUnit) return;
    const subskill = currentSkill.subskills.find(s => s.id === subskillId);
    if (!subskill) return;

    onSelect({
        subject: currentSubject,
        unit: currentUnit,
        skill: currentSkill,
        subskill: subskill,
        selection: {
            subject: currentSubject,
            unit: currentUnit.id,
            skill: currentSkill.id,
            subskill: subskill.id
        }
    });
  };

  const Breadcrumbs = () => (
    <div className="flex items-center text-sm text-gray-500 mb-4">
      <button onClick={() => setViewLevel('subjects')} className="hover:underline">Subjects</button>
      {currentUnit && (
        <>
          <ChevronRight size={16} className="mx-1" />
          <button onClick={() => { setViewLevel('units'); setCurrentUnit(null); setCurrentSkill(null); }} className="hover:underline">{currentSubject}</button>
        </>
      )}
      {currentSkill && currentUnit &&(
        <>
          <ChevronRight size={16} className="mx-1" />
          <button onClick={() => { setViewLevel('skills'); setCurrentSkill(null); }} className="hover:underline">{currentUnit.title}</button>
        </>
      )}
    </div>
  );

  const renderContent = () => {
    if (loading) return <div>Loading...</div>;
    if (error) return <div className="text-red-500">{error}</div>;

    switch (viewLevel) {
      case 'units':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {curriculumData?.map(unit => (
              <UnitCard key={unit.id} unit={unit} progress={{ completed: 5, total: 10 }} onClick={handleUnitClick} />
            ))}
          </div>
        );
      case 'skills':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentUnit?.skills.map(skill => (
              <SkillCard key={skill.id} skill={skill} mastery={0.75} isRecommended={false} onClick={handleSkillClick} />
            ))}
          </div>
        );
      case 'subskills':
        return (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentSkill?.subskills.map(subskill => (
              <SubskillCard key={subskill.id} subskill={subskill} difficulty="medium" estimatedTime={10} onStartPractice={handleSubskillSelect} />
            ))}
          </div>
        );
      default:
        return null;
    }
  };


  return (
    <div className="space-y-5">
      <h3 className="text-lg font-medium">Browse All Topics</h3>
      <Select value={currentSubject} onValueChange={setCurrentSubject}>
          <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a subject" />
          </SelectTrigger>
          <SelectContent>
              {subjects.map(subject => (
                  <SelectItem key={subject} value={subject}>
                      {subject}
                  </SelectItem>
              ))}
          </SelectContent>
      </Select>

        {currentSubject && <Breadcrumbs />}
        {renderContent()}
    </div>
  );
};

export default CurriculumExplorer;