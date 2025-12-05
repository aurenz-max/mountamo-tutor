import React, { useState } from 'react';
import { RelationalMappingSchema } from '../types';
import RelationalMapping from '../primitives/RelationalMapping';
import { generateRelationalMappingChemistry } from '../service/geminiClient-api';

interface RelationalMappingTesterProps {
  onBack?: () => void;
}

/**
 * Test component for Relational Mapping primitive
 *
 * Features:
 * - Display sample water molecule data
 * - Generate new molecules using LLM
 * - Validate schema structure
 */
const RelationalMappingTester: React.FC<RelationalMappingTesterProps> = ({ onBack }) => {
  const [schema, setSchema] = useState<RelationalMappingSchema>(WATER_MOLECULE_SAMPLE);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = async (molecule: string) => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await generateRelationalMappingChemistry(molecule, 'high-school');
      setSchema(result as RelationalMappingSchema);
    } catch (err) {
      console.error('Generation error:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen text-white">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Back Button Header */}
        {onBack && (
          <div className="mb-8 text-center">
            <button
              onClick={onBack}
              className="inline-flex items-center gap-2 px-6 py-3 bg-slate-800/50 hover:bg-slate-700/50 text-white rounded-full border border-slate-600 transition-all"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path>
              </svg>
              Back to Home
            </button>
          </div>
        )}

        {/* Header */}
        <div className="text-center space-y-4">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
            Relational Mapping Tester
          </h1>
          <p className="text-slate-400 text-lg">
            Chemistry Molecular Bonding Visualization
          </p>
        </div>

        {/* Controls */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 space-y-4">
          <h2 className="text-xl font-semibold mb-4">Generate Molecules</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {['Water (H₂O)', 'Methane (CH₄)', 'Ammonia (NH₃)', 'Carbon Dioxide (CO₂)'].map((mol) => (
              <button
                key={mol}
                onClick={() => handleGenerate(mol)}
                disabled={isGenerating}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:text-slate-500 rounded-lg transition-colors text-sm font-medium"
              >
                {mol}
              </button>
            ))}
          </div>

          <button
            onClick={() => setSchema(WATER_MOLECULE_SAMPLE)}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors text-sm"
          >
            Reset to Sample Water Molecule
          </button>

          {isGenerating && (
            <div className="text-center text-blue-400 py-4">
              <div className="animate-pulse">Generating molecule visualization...</div>
            </div>
          )}

          {error && (
            <div className="bg-red-900/20 border border-red-500/50 rounded-lg p-4 text-red-300">
              <p className="font-semibold">Error:</p>
              <p className="text-sm">{error}</p>
            </div>
          )}
        </div>

        {/* Visualization */}
        <div className="bg-slate-900/30 border border-slate-700 rounded-lg p-6">
          <RelationalMapping data={schema} />
        </div>

        {/* Schema Viewer */}
        <details className="bg-slate-900/50 border border-slate-700 rounded-lg p-6">
          <summary className="cursor-pointer font-semibold text-slate-300 hover:text-white">
            View Raw Schema JSON
          </summary>
          <pre className="mt-4 text-xs text-slate-400 overflow-auto max-h-96 bg-slate-950 p-4 rounded">
            {JSON.stringify(schema, null, 2)}
          </pre>
        </details>

        {/* Validation Checklist */}
        <div className="bg-slate-900/50 border border-slate-700 rounded-lg p-6 space-y-3">
          <h3 className="font-semibold text-lg mb-4">Validation Checklist</h3>
          <div className="space-y-2 text-sm">
            <ValidationItem
              check={schema.primitive === 'relational_mapping'}
              label="Schema primitive type is 'relational_mapping'"
            />
            <ValidationItem
              check={schema.domain.field === 'chemistry'}
              label="Domain field is 'chemistry'"
            />
            <ValidationItem
              check={schema.domain.subtype === 'molecular_bonding'}
              label="Domain subtype is 'molecular_bonding'"
            />
            <ValidationItem
              check={schema.content.entities.length >= 2}
              label={`Has ${schema.content.entities.length} entities (atoms)`}
            />
            <ValidationItem
              check={schema.content.relationships.length >= 1}
              label={`Has ${schema.content.relationships.length} relationships (bonds)`}
            />
            <ValidationItem
              check={schema.content.emergentProperties.length >= 1}
              label={`Has ${schema.content.emergentProperties.length} emergent properties`}
            />
            <ValidationItem
              check={schema.content.satisfiedConstraints.length >= 1}
              label={`Has ${schema.content.satisfiedConstraints.length} satisfied constraints`}
            />
            <ValidationItem
              check={!!(schema.assessmentHooks?.predict || schema.assessmentHooks?.transfer || schema.assessmentHooks?.explain)}
              label="Has at least one assessment hook"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const ValidationItem: React.FC<{ check: boolean; label: string }> = ({ check, label }) => (
  <div className="flex items-center gap-2">
    <span className={check ? 'text-green-400' : 'text-red-400'}>
      {check ? '✓' : '✗'}
    </span>
    <span className={check ? 'text-slate-300' : 'text-slate-500'}>{label}</span>
  </div>
);

// Sample water molecule data from the SCIENCE PRIMITIVES doc
const WATER_MOLECULE_SAMPLE: RelationalMappingSchema = {
  primitive: 'relational_mapping',
  pedagogicalIntent: 'understand_mechanism',
  domain: {
    field: 'chemistry',
    subtype: 'molecular_bonding',
    renderingHints: {
      entityRepresentation: 'atom_simple',
      connectionVisualization: 'electron_sharing',
      spatialLayout: 'molecular_geometry'
    }
  },
  content: {
    title: 'Water Molecule Formation',
    centralQuestion: 'Why does oxygen bond with two hydrogen atoms?',
    entities: [
      {
        id: 'oxygen',
        label: 'Oxygen',
        properties: {
          valenceElectrons: 6,
          electronegativity: 3.44,
          desiredElectrons: 8
        },
        visualState: {
          orbitals: ['2s', '2p', '2p', '2p'],
          unpairedElectrons: 2,
          lonePairs: 2
        },
        position: { x: 0, y: 0, z: 0 }
      },
      {
        id: 'hydrogen_1',
        label: 'Hydrogen',
        properties: {
          valenceElectrons: 1,
          electronegativity: 2.20,
          desiredElectrons: 2
        },
        position: { x: -0.96, y: 0, z: 0.59 }
      },
      {
        id: 'hydrogen_2',
        label: 'Hydrogen',
        properties: {
          valenceElectrons: 1,
          electronegativity: 2.20,
          desiredElectrons: 2
        },
        position: { x: 0.96, y: 0, z: 0.59 }
      }
    ],
    relationships: [
      {
        from: 'oxygen',
        to: 'hydrogen_1',
        type: 'covalent_bond',
        mechanism: 'electron_sharing',
        properties: {
          sharedElectrons: 2,
          bondPolarity: 'polar',
          bondAngle: 104.5
        },
        explanation: 'Oxygen shares one electron pair with hydrogen. Due to oxygen\'s higher electronegativity, the shared electrons spend more time near oxygen, creating a polar bond.'
      },
      {
        from: 'oxygen',
        to: 'hydrogen_2',
        type: 'covalent_bond',
        mechanism: 'electron_sharing',
        properties: {
          sharedElectrons: 2,
          bondPolarity: 'polar',
          bondAngle: 104.5
        },
        explanation: 'Second O-H bond forms identically. The 104.5° angle results from lone pair repulsion being stronger than bonding pair repulsion (VSEPR).'
      }
    ],
    emergentProperties: [
      {
        property: 'molecular_polarity',
        explanation: 'The bent geometry (104.5°) combined with polar O-H bonds creates an uneven charge distribution.',
        consequence: 'Water dissolves ionic compounds, exhibits hydrogen bonding, and has high surface tension.'
      }
    ],
    satisfiedConstraints: [
      'Oxygen achieves 8 valence electrons (octet rule)',
      'Each hydrogen achieves 2 valence electrons (duet rule)',
      'VSEPR: 4 electron domains → tetrahedral electron geometry → bent molecular geometry'
    ]
  },
  assessmentHooks: {
    predict: 'What would happen if you replaced oxygen with sulfur (H₂S)?',
    transfer: 'Why does ammonia (NH₃) have a bond angle of 107° instead of 109.5°?'
  },
  metadata: {
    gradeLevel: 'high-school',
    difficulty: 'standard',
    estimatedTime: 10
  }
};

export default RelationalMappingTester;
