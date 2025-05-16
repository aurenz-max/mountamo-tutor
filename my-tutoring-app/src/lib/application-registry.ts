// lib/application-registry.ts
import { ComponentType } from 'react';

export interface SimulationMetadata {
  id: string;
  title: string;
  description: string;
  subject: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  category: 'physics' | 'chemistry' | 'biology' | 'astronomy' | 'earth-science';
  thumbnail?: string;
  duration?: string;
  prerequisites?: string[];
  topics?: string[];
  standards?: string[];
}

export interface SimulationComponent extends ComponentType<any> {
  metadata: SimulationMetadata;
}

// Registry to store all available simulations
class ApplicationRegistry {
  private applications: Map<string, SimulationComponent> = new Map();

  register(component: SimulationComponent) {
    this.applications.set(component.metadata.id, component);
  }

  getAll(): SimulationComponent[] {
    return Array.from(this.applications.values());
  }

  getById(id: string): SimulationComponent | undefined {
    return this.applications.get(id);
  }

  getByCategory(category: string): SimulationComponent[] {
    return this.getAll().filter(app => app.metadata.category === category);
  }
}

export const applicationRegistry = new ApplicationRegistry();