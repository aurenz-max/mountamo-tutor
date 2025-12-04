import React from 'react';
import { RelationalMappingSchema } from '../types';
import { MolecularBondingAdapter } from '../adapters/chemistry/molecular-bonding';

interface RelationalMappingProps {
  data: RelationalMappingSchema;
  index?: number;
}

/**
 * RelationalMapping Primitive
 *
 * A universal primitive for showing how entities connect and why.
 * Uses domain-specific adapters to render visualizations:
 * - Chemistry: 3D molecular structures
 * - Physics: Force diagrams
 * - Biology: Ecological networks
 *
 * Current implementation: Chemistry molecular bonding adapter only (MVP)
 */
const RelationalMapping: React.FC<RelationalMappingProps> = ({ data }) => {
  // Adapter resolution logic
  // For MVP, we hardcode the chemistry adapter
  // Future: Use a registry system to resolve adapters dynamically

  // Validate schema
  if (data.primitive !== 'relational_mapping') {
    return (
      <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-6 text-red-300">
        <h3 className="font-semibold mb-2">Schema Error</h3>
        <p>Expected primitive type "relational_mapping", got "{data.primitive}"</p>
      </div>
    );
  }

  // Route to appropriate adapter based on domain
  const renderAdapter = () => {
    const { field, subtype } = data.domain;

    // Chemistry domain
    if (field === 'chemistry' && subtype === 'molecular_bonding') {
      return <MolecularBondingAdapter schema={data} />;
    }

    // Fallback for unimplemented adapters
    return (
      <div className="bg-yellow-900/20 border border-yellow-500/50 rounded-lg p-6 text-yellow-300">
        <h3 className="font-semibold mb-2">Adapter Not Implemented</h3>
        <p className="mb-4">
          No adapter found for domain: {field} / {subtype}
        </p>
        <div className="bg-slate-900/50 border border-slate-700 rounded p-4 text-xs font-mono text-slate-400">
          <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderAdapter()}
    </div>
  );
};

export default RelationalMapping;
