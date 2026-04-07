export class WorldModel {
  constructor() {
    this.belief = {
      skills: {},
      environment: {},
      capabilities: {},
      successRates: {}
    };
    this.lastUpdate = Date.now();
  }

  updateBelief(key, value) {
    const parts = key.split(".");
    let current = this.belief;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!current[parts[i]]) current[parts[i]] = {};
      current = current[parts[i]];
    }
    current[parts[parts.length - 1]] = value;
    this.lastUpdate = Date.now();
  }

  getBelief(path) {
    const parts = path.split(".");
    let current = this.belief;
    for (const part of parts) {
      if (current === undefined) return undefined;
      current = current[part];
    }
    return current;
  }

  async predict(skill, input) {
    const history = this.belief.successRates[skill.capability];
    if (!history) return { confidence: 0.5, expectedOutcome: "unknown" };

    const avgSuccess = history.reduce((a, b) => a + b, 0) / history.length;
    return {
      confidence: avgSuccess,
      expectedOutcome: avgSuccess > 0.7 ? "success" : "failure"
    };
  }
}

export class Simulation {
  constructor(worldModel) {
    this.worldModel = worldModel;
    this.maxSteps = 100;
  }

  async imaginePlans(plans, blackboard) {
    const results = [];
    for (const plan of plans) {
      const simulated = await this.simulate(plan, blackboard);
      results.push({ plan, simulated });
    }
    return results.sort((a, b) => b.simulated.score - a.simulated.score);
  }

  async simulate(plan, blackboard) {
    let score = 0.5;
    const steps = plan.steps || [];
    
    for (const step of steps.slice(0, this.maxSteps) ) {
      const prediction = await this.worldModel.predict(step, blackboard.getZoneData("context"));
      score *= prediction.confidence;
    }

    return { score, steps: steps.length };
  }
}

export class Curiosity {
  constructor(options = {}) {
    this.explorationRate = options.explorationRate || 0.1;
    this.learningRate = options.learningRate || 0.01;
    this.goalQueue = [];
  }

  addGoal(goal) {
    this.goalQueue.push({ goal, priority: goal.priority || 50, addedAt: Date.now() });
    this.goalQueue.sort((a, b) => b.priority - a.priority);
  }

  shouldExplore() {
    return Math.random() < this.explorationRate;
  }

  updateCuriosity(success, reward) {
    this.explorationRate = Math.max(0.01, Math.min(0.5, 
      this.explorationRate + (success ? this.learningRate : -this.learningRate)
    ));
  }

  getNextGoal() {
    return this.goalQueue.shift();
  }
}

export function createWorldModel(options = {}) {
  return new WorldModel(options);
}

export function createSimulation(worldModel, options = {}) {
  return new Simulation(worldModel, options);
}

export function createCuriosity(options = {}) {
  return new Curiosity(options);
}