import React from 'react';
import {
  getPrimitive,
  SectionHeader,
  CenteredSectionHeader,
} from '../config/primitiveRegistry';
import { ComponentId } from '../types';
import { useExhibitContext } from '../contexts/ExhibitContext';
import { ObjectiveBadge } from './ObjectiveBadge';

interface PrimitiveRendererProps {
  /**
   * The component ID from the registry
   */
  componentId: ComponentId;

  /**
   * Data to pass to the primitive component
   */
  data: any;

  /**
   * Optional index for multi-instance primitives
   */
  index?: number;

  /**
   * Optional additional props to pass through
   */
  additionalProps?: Record<string, any>;
}

/**
 * Universal renderer for registered primitive components
 *
 * This component:
 * - Looks up the primitive configuration from the registry
 * - Renders section headers if configured
 * - Applies container styles
 * - Passes data to the primitive component
 *
 * Usage:
 * ```tsx
 * <PrimitiveRenderer
 *   componentId="generative-table"
 *   data={tableData}
 *   index={0}
 * />
 * ```
 */
export const PrimitiveRenderer: React.FC<PrimitiveRendererProps> = ({
  componentId,
  data,
  index,
  additionalProps = {},
}) => {
  const config = getPrimitive(componentId);

  if (!config) {
    console.warn(`[PrimitiveRenderer] No configuration found for component: ${componentId}`);
    return null;
  }

  const Component = config.component;

  // Skip rendering if component is a null component (handled elsewhere)
  if (Component === null || Component === undefined) {
    return null;
  }

  const HeaderComponent =
    config.dividerStyle === 'center' ? CenteredSectionHeader : SectionHeader;

  return (
    <div className={config.containerClassName}>
      {config.showDivider && config.sectionTitle && (
        <HeaderComponent title={config.sectionTitle} />
      )}
      <Component data={data} index={index} {...additionalProps} />
    </div>
  );
};

interface PrimitiveCollectionRendererProps {
  /**
   * The component ID from the registry
   */
  componentId: ComponentId;

  /**
   * Array of data items to render
   */
  dataArray: any[];

  /**
   * Optional additional props to pass through to each primitive
   */
  additionalProps?: Record<string, any>;

  /**
   * Optional key extractor function
   */
  keyExtractor?: (item: any, index: number) => string;
}

/**
 * Renders a collection of the same primitive type
 *
 * Automatically handles:
 * - Section header (only shown once for the collection)
 * - Container styling (applied to the collection wrapper)
 * - Individual primitive rendering
 *
 * Usage:
 * ```tsx
 * <PrimitiveCollectionRenderer
 *   componentId="generative-table"
 *   dataArray={exhibitData.tables}
 * />
 * ```
 */
export const PrimitiveCollectionRenderer: React.FC<PrimitiveCollectionRendererProps> = ({
  componentId,
  dataArray,
  additionalProps = {},
  keyExtractor = (_, index) => `${componentId}-${index}`,
}) => {
  const config = getPrimitive(componentId);
  const { getObjectivesForComponent } = useExhibitContext();

  if (!config) {
    console.warn(`[PrimitiveCollectionRenderer] No configuration found for component: ${componentId}`);
    return null;
  }

  if (!dataArray || dataArray.length === 0) {
    console.log(`[PrimitiveCollectionRenderer] Skipping ${componentId}: dataArray is empty or null`, dataArray);
    return null;
  }

  console.log(`[PrimitiveCollectionRenderer] Rendering ${componentId} with ${dataArray.length} items`, dataArray);

  const Component = config.component;

  // Skip rendering if component is a null component
  if (Component === null || Component === undefined) {
    return null;
  }

  const HeaderComponent =
    config.dividerStyle === 'center' ? CenteredSectionHeader : SectionHeader;

  return (
    <div className={config.containerClassName}>
      {config.showDivider && config.sectionTitle && (
        <HeaderComponent title={config.sectionTitle} />
      )}
      {dataArray.map((item, index) => {
        // Extract instanceId from data if available
        const instanceId = item.__instanceId;
        const objectives = instanceId ? getObjectivesForComponent(instanceId) : [];

        return (
          <div key={keyExtractor(item, index)} className="relative">
            {/* Objective badges above component */}
            {objectives.length > 0 && (
              <div className="mb-4">
                <ObjectiveBadge objectives={objectives} compact={true} />
              </div>
            )}
            <Component
              data={item}
              index={index}
              {...additionalProps}
            />
          </div>
        );
      })}
    </div>
  );
};
