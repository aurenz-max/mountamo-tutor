// lib/simulation-loader.ts
import { applicationRegistry } from './application-registry';

// This function dynamically imports all simulation components
export async function loadAllSimulations() {
  // Use webpack's require.context to get all simulation files
  const context = require.context('../components/simulations', true, /\.tsx$/);
  
  const simulationModules = await Promise.all(
    context.keys().map(async (key) => {
      const module = await import(`../components/simulations/${key.slice(2)}`);
      return module.default;
    })
  );

  // Register each simulation
  simulationModules.forEach(component => {
    if (component.metadata) {
      applicationRegistry.register(component);
    }
  });
}