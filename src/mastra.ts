import { Mastra } from '@mastra/core';
import { tradingAgent } from './trader/agent';

// Create Mastra instance with trading agent and memory configuration
export const mastra = new Mastra({
  agents: { tradingAgent },
});

// Export for easy access
export { tradingAgent };
