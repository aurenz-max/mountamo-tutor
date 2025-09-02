import React from 'react';
import { ReadingContentRenderer, ReadingContent } from './ReadingContentRenderer';

// Sample reading content with all interactive primitives
const sampleContent: ReadingContent = {
  title: "The Water Cycle: Understanding Earth's Most Important Process",
  word_count: 850,
  reading_level: "Grade 6-8",
  grade_appropriate_features: [
    "Clear, age-appropriate vocabulary",
    "Interactive elements to maintain engagement",
    "Real-world connections and examples",
    "Visual learning aids and structured information",
    "Progress tracking to encourage completion"
  ],
  sections: [
    {
      heading: "What is the Water Cycle?",
      content: "The water cycle is nature's way of recycling water throughout our planet. It's a continuous process where water moves from oceans, lakes, and rivers into the atmosphere, and then back to Earth. This process is powered by the sun and is essential for all life on our planet. The water cycle involves several key stages: evaporation, condensation, precipitation, and collection.",
      key_terms_used: ["water cycle", "evaporation", "condensation", "precipitation"],
      concepts_covered: ["continuous processes", "energy from the sun", "states of matter"],
      alerts: [
        {
          type: "alert",
          style: "tip",
          title: "Study Tip",
          content: "Remember that the water cycle has no beginning or end - it's a continuous loop that has been happening for billions of years!"
        }
      ],
      definitions: [
        {
          type: "definition",
          term: "evaporation",
          definition: "The process by which water changes from liquid to gas when heated by the sun"
        },
        {
          type: "definition",
          term: "condensation",
          definition: "The process by which water vapor cools and changes back into liquid water droplets"
        },
        {
          type: "definition",
          term: "precipitation",
          definition: "Water falling from clouds as rain, snow, sleet, or hail"
        }
      ],
      keyvalues: [
        {
          type: "keyvalue",
          key: "Water coverage of Earth",
          value: "71% of surface"
        },
        {
          type: "keyvalue",
          key: "Percentage of freshwater",
          value: "Only 3% of all water"
        }
      ]
    },
    {
      heading: "The Four Main Stages",
      content: "Understanding each stage of the water cycle helps us see how water moves through our environment. Each stage plays a crucial role in distributing water around our planet and maintaining the balance necessary for life.",
      key_terms_used: ["stages", "environment", "distribution"],
      concepts_covered: ["sequential processes", "environmental systems", "natural balance"],
      tables: [
        {
          type: "table",
          headers: ["Stage", "What Happens", "Energy Source"],
          rows: [
            ["Evaporation", "Water becomes water vapor", "Solar energy"],
            ["Condensation", "Water vapor forms clouds", "Cooling temperatures"],
            ["Precipitation", "Water falls to Earth", "Gravity"],
            ["Collection", "Water gathers in bodies", "Gravity and topography"]
          ]
        }
      ],
      expandables: [
        {
          type: "expandable",
          title: "Why does water evaporate faster on hot days?",
          content: "Heat energy from the sun gives water molecules more energy to move around. When they move fast enough, they can break free from the liquid and become water vapor. This is why puddles disappear faster on sunny, hot days compared to cool, cloudy days."
        },
        {
          type: "expandable",
          title: "How do clouds form?",
          content: "When warm air containing water vapor rises high into the atmosphere, it cools down. As it cools, the water vapor condenses around tiny particles of dust or pollen in the air, forming countless tiny water droplets that we see as clouds."
        }
      ]
    },
    {
      heading: "Real-World Impact",
      content: "The water cycle affects weather patterns, climate, agriculture, and daily life. Understanding this process helps us predict weather, manage water resources, and appreciate the interconnectedness of Earth's systems.",
      key_terms_used: ["weather patterns", "climate", "agriculture", "water resources"],
      concepts_covered: ["cause and effect", "environmental interconnections", "human impact"],
      quizzes: [
        {
          type: "quiz",
          question: "What provides the energy that drives the water cycle?",
          answer: "The Sun",
          explanation: "Solar energy heats water in oceans, lakes, and rivers, causing evaporation that starts the entire cycle."
        },
        {
          type: "quiz",
          question: "Name the process where water vapor turns back into liquid water.",
          answer: "Condensation",
          explanation: "This happens when warm air containing water vapor cools down, usually as it rises in the atmosphere."
        }
      ],
      alerts: [
        {
          type: "alert",
          style: "info",
          title: "Did You Know?",
          content: "A single drop of water might spend over 3,000 years in the ocean before evaporating and continuing through the water cycle!"
        }
      ],
      checklists: [
        {
          type: "checklist",
          text: "I can explain what causes evaporation",
          completed: false
        },
        {
          type: "checklist",
          text: "I understand how clouds form",
          completed: false
        },
        {
          type: "checklist",
          text: "I can name the four main stages of the water cycle",
          completed: false
        },
        {
          type: "checklist",
          text: "I can explain why the water cycle is important for life",
          completed: false
        }
      ]
    }
  ]
};

export const InteractivePrimitivesDemo: React.FC = () => {
  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Interactive Content Primitives Demo
          </h1>
          <p className="text-lg text-gray-600 max-w-3xl mx-auto">
            This demo showcases all seven interactive content primitives: alerts, expandable sections, 
            quizzes, inline definitions, progress checklists, tables, and key-value facts.
          </p>
        </div>

        {/* Main Content */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <ReadingContentRenderer content={sampleContent} />
        </div>

        {/* Technical Information */}
        <div className="mt-12 bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Technical Implementation</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">LLM-Friendly JSON</h3>
              <p className="text-sm text-gray-600">
                Each primitive uses flat JSON structures with clear type identifiers, 
                making it easy for LLMs to generate consistent content.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibold text-gray-800 mb-2">React Components</h3>
              <p className="text-sm text-gray-600">
                Built with TypeScript and Tailwind CSS, fully accessible 
                and responsive across all device sizes.
              </p>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <h3 className="font-semibent text-gray-800 mb-2">Performance Optimized</h3>
              <p className="text-sm text-gray-600">
                Lightweight components with minimal re-renders, 
                keeping bundle size under 5KB total.
              </p>
            </div>
          </div>
          
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Example JSON Structure</h3>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto">
              <pre className="text-sm">
{`{
  "type": "alert",
  "style": "tip",
  "title": "Study Tip",
  "content": "Remember that the water cycle..."
}

{
  "type": "quiz",
  "question": "What provides energy for the water cycle?",
  "answer": "The Sun",
  "explanation": "Solar energy heats water..."
}

{
  "type": "table",
  "headers": ["Stage", "What Happens"],
  "rows": [
    ["Evaporation", "Water becomes vapor"],
    ["Condensation", "Vapor forms clouds"]
  ]
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};