export class PlanNode {
  constructor(action, state, parent = null, cost = 0) {
    this.action = action;
    this.state = state;
    this.parent = parent;
    this.cost = cost;
    this.children = [];
    this.score = 0;
    this.evaluated = false;
  }

  getPath() {
    const path = [];
    let current = this;
    while (current) {
      if (current.action) {
        path.unshift(current.action);
      }
      current = current.parent;
    }
    return path;
  }

  getDepth() {
    let depth = 0;
    let current = this.parent;
    while (current) {
      depth++;
      current = current.parent;
    }
    return depth;
  }
}

export class Planner {
  constructor(options = {}) {
    this.maxDepth = options.maxDepth || 10;
    this.maxNodes = options.maxNodes || 1000;
    this.branchFactor = options.branchFactor || 5;
    this.heuristicFn = options.heuristicFn || ((state, goal) => this.defaultHeuristic(state, goal));
    this.getActionsFn = options.getActionsFn || (() => []);
    this.applyActionFn = options.applyActionFn || ((state, action) => state);
    this.isGoalFn = options.isGoalFn || ((state, goal) => false);
    
    this.planCache = new Map();
    this.maxCost = options.maxCost || 1.0;
  }

  defaultHeuristic(state, goal) {
    return 0;
  }

  estimateCost(plan) {
    if (!plan || !plan.bestPath) return 0;
    return plan.bestPath.length * 0.1;
  }

  cachePlan(goal, plan) {
    const goalKey = typeof goal === "string" ? goal : JSON.stringify(goal);
    this.planCache.set(goalKey, {
      plan,
      cachedAt: Date.now()
    });
  }

  getCachedPlan(goal) {
    const goalKey = typeof goal === "string" ? goal : JSON.stringify(goal);
    return this.planCache.get(goalKey);
  }

  clearCache() {
    this.planCache.clear();
  }

  search(startState, goal, options = {}) {
    const maxDepth = options.maxDepth || this.maxDepth;
    const maxNodes = options.maxNodes || this.maxNodes;
    const timeout = options.timeout || 5000;
    const maxCost = options.maxCost || this.maxCost;

    const startTime = Date.now();
    let nodesExplored = 0;

    const root = new PlanNode(null, startState);
    root.evaluated = true;
    const queue = [root];
    const allNodes = [root];

    while (queue.length > 0) {
      if (Date.now() - startTime > timeout) {
        return this.createResult(root, "timeout");
      }

      if (nodesExplored >= maxNodes || allNodes.length > maxNodes) {
        return this.createResult(root, "limit_exceeded");
      }

      const current = queue.shift();

      if (this.isGoalFn(current.state, goal)) {
        const cost = this.estimateCost({ bestPath: current.getPath() });
        if (cost > maxCost) {
          return this.createResult(root, "cost_exceeded");
        }
        return this.createResult(current, "success", current.getPath());
      }

      if (current.getDepth() >= maxDepth) {
        continue;
      }

      const actions = this.getActionsFn(current.state, goal);
      nodesExplored++;

      for (const action of actions.slice(0, this.branchFactor)) {
        const nextState = this.applyActionFn(current.state, action);
        const heuristic = this.heuristicFn(nextState, goal);
        
        const child = new PlanNode(action, nextState, current, current.cost + 1);
        child.score = heuristic - child.cost;
        child.evaluated = true;
        
        current.children.push(child);
        allNodes.push(child);
        queue.push(child);
      }

      queue.sort((a, b) => b.score - a.score);
    }

    return this.createResult(root, "no_solution");
  }

  createResult(root, status, path = null) {
    const bestNode = this.findBestNode(root);
    return {
      status,
      path,
      bestPath: bestNode ? bestNode.getPath() : [],
      bestScore: bestNode ? bestNode.score : 0,
      nodesExplored: this.countNodes(root)
    };
  }

  findBestNode(root) {
    let best = null;
    let bestScore = -Infinity;

    const traverse = (node) => {
      if (node.evaluated && node.score > bestScore) {
        bestScore = node.score;
        best = node;
      }
      for (const child of node.children) {
        traverse(child);
      }
    };

    traverse(root);
    return best;
  }

  countNodes(root) {
    let count = 1;
    for (const child of root.children) {
      count += this.countNodes(child);
    }
    return count;
  }

  visualize(root, maxDepth = 3) {
    const lines = [];
    
    const print = (node, indent = 0) => {
      if (indent > maxDepth) return;
      
      const prefix = "  ".repeat(indent);
      const actionStr = node.action ? `Action: ${JSON.stringify(node.action)}` : "ROOT";
      const scoreStr = `score=${node.score.toFixed(2)}`;
      const depthStr = `depth=${node.getDepth()}`;
      
      lines.push(`${prefix}${actionStr} (${scoreStr}, ${depthStr})`);
      
      for (const child of node.children) {
        print(child, indent + 1);
      }
    };
    
    print(root);
    return lines.join("\n");
  }
}

export function decomposeGoal(goal, skills) {
  const decomposed = [];
  
  if (typeof goal === "string") {
    const parts = goal.split(" then ");
    for (const part of parts) {
      decomposed.push({
        subGoal: part.trim(),
        requiredCapabilities: []
      });
    }
  }

  if (typeof goal === "object" && goal.steps) {
    for (const step of goal.steps) {
      const matchingSkills = skills.filter(s => 
        s.capability && step.capability && s.capability.includes(step.capability)
      );
      
      decomposed.push({
        subGoal: step.description || step.goal,
        requiredCapabilities: matchingSkills.map(s => s.capability),
        skills: matchingSkills
      });
    }
  }

  return decomposed;
}

export function evaluatePlan(plan, context) {
  let score = 0;
  const factors = [];

  if (plan.path && plan.path.length > 0) {
    score += 0.3;
    factors.push("has_actions");
  }

  if (plan.nodesExplored < 100) {
    score += 0.2;
    factors.push("efficient_exploration");
  }

  if (plan.status === "success") {
    score += 0.4;
    factors.push("goal_achieved");
  }

  if (context && context.constraints) {
    const depthOk = plan.bestPath && plan.bestPath.length <= context.constraints.maxSteps;
    if (depthOk) {
      score += 0.1;
      factors.push("within_constraints");
    }
  }

  return {
    score,
    factors,
    plan
  };
}

export function createPlan(goal, state, skills, options = {}) {
  const goalStr = typeof goal === "string" ? goal : goal.goal || JSON.stringify(goal);
  const expectedCapability = options.expectedCapability;
  
  const planner = new Planner({
    maxDepth: options.maxDepth || 5,
    maxNodes: options.maxNodes || 500,
    branchFactor: options.branchFactor || 3,
    
    getActionsFn: (currentState, currentGoal) => {
      let filteredSkills = skills.filter(s => s.capability);
      
      if (expectedCapability) {
        filteredSkills = filteredSkills.filter(s => s.capability === expectedCapability);
      }
      
      return filteredSkills.map(s => ({
        capability: s.capability,
        skill: s
      }));
    },
    
    applyActionFn: (currentState, action) => {
      return {
        ...currentState,
        lastAction: action.capability,
        steps: (currentState.steps || 0) + 1
      };
    },
    
    isGoalFn: (currentState, currentGoal) => {
      const g = typeof currentGoal === "string" ? currentGoal : currentGoal.goal || "";
      return currentState.steps && currentState.steps > 0;
    },
    
    heuristicFn: (currentState, currentGoal) => {
      const g = typeof currentGoal === "string" ? currentGoal : "";
      let h = 1.0;
      if (currentState.steps && currentState.steps > 0) {
        h = 0.5;
      }
      if (currentGoal?.requiredSteps) {
        h = Math.max(0, currentGoal.requiredSteps - (currentState.steps || 0));
      }
      return h;
    }
  });

  return planner.search({ ...state, goal: goalStr }, goalStr, options);
}

export function validatePlan(plan, registry) {
  if (!plan || !plan.bestPath) return { valid: true };
  
  const errors = [];
  
  for (const step of plan.bestPath) {
    if (step.capability && !registry.has(step.capability)) {
      errors.push("Unknown capability: " + step.capability);
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

export function createRegistry(skills) {
  const registry = new Set();
  for (const skill of skills) {
    if (skill.capability) {
      registry.add(skill.capability);
    }
  }
  return registry;
}

export function planToDSL(plan) {
  if (!plan || !plan.bestPath) {
    return { logic: [] };
  }
  
  return {
    logic: plan.bestPath.map(s => ({
      op: "call_skill",
      skill: s.capability || s.skill,
      input: s.input || {}
    }))
  };
}