import React from 'react';
import { getPrimitive, SectionHeader, CenteredSectionHeader } from '../config/primitiveRegistry';
import { OrderedComponent } from '../types';
import { useExhibitContext } from '../contexts/ExhibitContext';
import { ObjectiveBadge } from './ObjectiveBadge';
import { useEvaluationContext } from '../evaluation';

interface ManifestOrderRendererProps {
  /**
   * Array of ordered components from exhibitData.orderedComponents
   */
  orderedComponents: OrderedComponent[];

  /**
   * Callback when a detail item is clicked (for drawer interactions)
   */
  onDetailItemClick?: (item: string) => void;

  /**
   * Callback when a term is clicked in FeatureExhibit
   */
  onTermClick?: (term: string) => void;
}

/**
 * ManifestOrderRenderer - Renders components in the exact order specified by the manifest
 *
 * This component iterates through the orderedComponents array (which preserves
 * the manifest's layout order) and renders each component using the primitive registry.
 *
 * This replaces the hardcoded component sections in App.tsx with a dynamic,
 * order-preserving renderer.
 *
 * All component lookups go through the primitive registry - no manual imports needed.
 * The only special handling is for:
 * - curator-brief: Skipped here (rendered in title section of App.tsx)
 * - concept-card-grid: Data is an array, needs grid layout wrapper
 */
export const ManifestOrderRenderer: React.FC<ManifestOrderRendererProps> = ({
  orderedComponents,
  onDetailItemClick,
  onTermClick,
}) => {
  const { getObjectivesForComponent, manifestItems } = useExhibitContext();
  const evaluationContext = useEvaluationContext();

  if (!orderedComponents || orderedComponents.length === 0) {
    return null;
  }

  return (
    <div className="w-full">
      {orderedComponents.map((item, index) => {
        const { componentId, instanceId, data } = item;

        // Get objectives for this component
        const objectives = getObjectivesForComponent(instanceId);

        // Skip curator-brief - it's rendered in the title section of App.tsx
        if (componentId === 'curator-brief') {
          return null;
        }

        // Get the primitive configuration from registry
        const config = getPrimitive(componentId);

        if (!config) {
          console.warn(`[ManifestOrderRenderer] No configuration found for component: ${componentId}`);
          return null;
        }

        const Component = config.component;

        // Skip if component is null (e.g., detail-drawer which is managed as a modal)
        if (Component === null || Component === undefined) {
          return null;
        }

        // Build additional props based on component type
        const additionalProps: Record<string, any> = {};
        if (componentId === 'generative-table' && onDetailItemClick) {
          additionalProps.onRowClick = onDetailItemClick;
        }
        if (componentId === 'feature-exhibit' && onTermClick) {
          additionalProps.onTermClick = onTermClick;
        }

        // Auto-inject evaluation props for evaluable primitives
        if (config.supportsEvaluation) {
          // Find manifest item to extract metadata
          const manifestItem = manifestItems.find(m => m.instanceId === instanceId);

          // Inject evaluation props into the data object
          additionalProps.instanceId = instanceId;
          additionalProps.exhibitId = evaluationContext?.exhibitId;

          // Extract skillId from manifest config if available
          if (manifestItem?.config?.skillId) {
            additionalProps.skillId = manifestItem.config.skillId;
          }
          if (manifestItem?.config?.subskillId) {
            additionalProps.subskillId = manifestItem.config.subskillId;
          }

          // Use first objective ID if available
          if (objectives.length > 0) {
            additionalProps.objectiveId = objectives[0].id;
          }
        }

        // Determine header component
        const HeaderComponent =
          config.dividerStyle === 'center' ? CenteredSectionHeader : SectionHeader;

        // Special handling for concept-card-grid: data.cards is an array, render in grid
        if (componentId === 'concept-card-grid') {
          // Data structure: { cards: ConceptCardData[], __instanceId?: string }
          const cards = Array.isArray(data?.cards) ? data.cards : [];
          if (cards.length === 0) {
            console.warn(`[ManifestOrderRenderer] concept-card-grid has no cards:`, data);
            return null;
          }
          return (
            <div key={instanceId} className="relative mb-20">
              {objectives.length > 0 && (
                <div className="mb-4">
                  <ObjectiveBadge objectives={objectives} compact={true} />
                </div>
              )}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 justify-items-center max-w-7xl mx-auto">
                {cards.map((card: any, cardIndex: number) => (
                  <div
                    key={`${instanceId}-card-${cardIndex}`}
                    className="w-full flex justify-center"
                    style={{ animationDelay: `${cardIndex * 150}ms` }}
                  >
                    <Component data={card} index={cardIndex} instanceId={`${instanceId}-card-${cardIndex}`} totalCards={cards.length} />
                  </div>
                ))}
              </div>
            </div>
          );
        }

        // Standard component rendering
        return (
          <div key={instanceId} className={config.containerClassName || 'mb-20'}>
            {/* Objective badges above component */}
            {objectives.length > 0 && (
              <div className="mb-4">
                <ObjectiveBadge objectives={objectives} compact={true} />
              </div>
            )}

            {/* Section header if configured */}
            {config.showDivider && config.sectionTitle && (
              <HeaderComponent title={config.sectionTitle} />
            )}

            {/* Render the component */}
            <Component data={{ ...data, ...additionalProps }} index={index} />
          </div>
        );
      })}
    </div>
  );
};

export default ManifestOrderRenderer;
