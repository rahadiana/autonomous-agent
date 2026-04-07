import { getTestCases } from "../groundTruth.js";

const Dataset = new Map();

export function registerDataset(capability, testCases) {
  Dataset.set(capability, testCases);
}

export function getDataset(capability) {
  if (Dataset.has(capability)) {
    return Dataset.get(capability);
  }

  const testCases = getTestCases(capability);
  Dataset.set(capability, testCases);
  return testCases;
}

export function addToDataset(capability, input, expected) {
  const dataset = getDataset(capability);
  dataset.push({ input, expected, type: "generated" });
  Dataset.set(capability, dataset);
  return dataset;
}

export function getAllCapabilities() {
  return Array.from(Dataset.keys());
}

export function clearDataset() {
  Dataset.clear();
}

export { Dataset };
