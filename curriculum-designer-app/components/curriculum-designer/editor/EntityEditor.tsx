'use client';

import { SubjectForm } from './SubjectForm';
import { UnitForm } from './UnitForm';
import { SkillForm } from './SkillForm';
import { SubskillForm } from './SubskillForm';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link2, Trash2 } from 'lucide-react';
import type { SelectedEntity } from '@/types/curriculum-authoring';

interface EntityEditorProps {
  entity: SelectedEntity;
  onPrerequisiteClick?: () => void;
}

export function EntityEditor({ entity, onPrerequisiteClick }: EntityEditorProps) {
  const getEntityTypeLabel = () => {
    switch (entity.type) {
      case 'subject':
        return 'Subject';
      case 'unit':
        return 'Unit';
      case 'skill':
        return 'Skill';
      case 'subskill':
        return 'Subskill';
      default:
        return 'Entity';
    }
  };

  const getEntityTitle = () => {
    switch (entity.type) {
      case 'subject':
        return (entity.data as any).subject_name;
      case 'unit':
        return (entity.data as any).unit_title;
      case 'skill':
        return (entity.data as any).skill_description;
      case 'subskill':
        return (entity.data as any).subskill_description;
      default:
        return 'Unknown';
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant="outline" className="text-xs">
                {getEntityTypeLabel()}
              </Badge>
              {(entity.data as any).is_draft && (
                <Badge variant="secondary" className="text-xs">
                  Draft
                </Badge>
              )}
            </div>
            <CardTitle className="text-xl">{getEntityTitle()}</CardTitle>
            <CardDescription className="mt-1">
              ID: <code className="text-xs">{entity.id}</code>
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {(entity.type === 'skill' || entity.type === 'subskill') && (
              <Button
                size="sm"
                variant="outline"
                onClick={onPrerequisiteClick}
              >
                <Link2 className="mr-2 h-4 w-4" />
                Prerequisites
              </Button>
            )}

            {entity.type !== 'subject' && (
              <Button
                size="sm"
                variant="outline"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {entity.type === 'subject' && <SubjectForm subject={entity.data as any} />}
        {entity.type === 'unit' && <UnitForm unit={entity.data as any} />}
        {entity.type === 'skill' && <SkillForm skill={entity.data as any} />}
        {entity.type === 'subskill' && <SubskillForm subskill={entity.data as any} />}
      </CardContent>
    </Card>
  );
}
