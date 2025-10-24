import { Agent } from "@mastra/core/agent";
import * as tools from './tools.js';
import { createTool } from "@mastra/core/tools";
import { z } from "zod";
import fs from 'fs';
 
export const noteTaking = createTool({
  id: "noteTaking",
  description: "Overwrite the notebook for next-round reference.",
  inputSchema: z.object({
    input: z.string()
  }),
  outputSchema: z.object({
    isSuccess: z.boolean()
  }),
  execute: async ({ context }) => {
    const { input } = context;
    try {
      fs.writeFileSync('note.txt', input)
      return {
        isSuccess: true
      }
    } catch {
      return {
        isSuccess: false
      }
    }
  }
});

export const noteReading = createTool({
  id: "noteReading",
  description: "Read the note recorded from previous round to understand current procedure better.",
  inputSchema: z.object({}),
  outputSchema: z.object({
    noteContent: z.string()
  }),
  execute: async () => {
    const data = fs.readFileSync('note.txt', 'utf8');
    return {
      noteContent: data
    }
  }
});


export const tradingAgent = new Agent({
  name: 'crypto-trading-agent',
  instructions: `# CRYPTO TRADING AGENT STRATEGY

## MANDATORY WORKFLOW
At the START of each round: Use noteReading tool to read previous notes and understand current context.
At the END of each round: Use noteTaking tool to record key decisions, positions, market analysis, and next steps.

## CORE TRADING PHILOSOPHY
1. **Risk-First Approach**: Never risk more than 20% of capital per trade
2. **Data-Driven Decisions**: Always gather comprehensive market data before trading
3. **Disciplined Execution**: Follow reasonable entry/exit strategies without emotion
4. **Continuous Learning**: Improve strategy based on performance analysis

## TRADING STRATEGY FRAMEWORK

### 1. MARKET SCANNING & OPPORTUNITY IDENTIFICATION
- Use getTopMovers to identify trending assets
- Analyze getMarketSentiment for bullish/bearish signals
- Check getNewsAndEvents for catalyst-driven opportunities
- Use searchMarkets to find specific trading pairs

### 2. COMPREHENSIVE MARKET ANALYSIS
For each potential trade, perform:
- getUltraMarketAnalysis for complete technical overview
- getTechnicalIndicators (1h, 4h timeframes)
- getOrderBookAnalysis for liquidity assessment
- getVolumeAnalysis for accumulation/distribution
- getMarketCorrelation to understand BTC dependency

### 3. RISK MANAGEMENT PROTOCOL
- Check getLiquidationRisk before every position
- Monitor getMarginLevel continuously
- Use getAvailableUSDC to calculate position sizing
- Maximum leverage: 3x for conservative trades, 5x for high-conviction setups

### 4. POSITION ENTRY STRATEGY
**Long Entries (Bullish):**
- RSI oversold (<30) with bullish divergence
- MACD crossover above signal line
- Price above 20/50 EMA
- Strong support level with high volume

**Short Entries (Bearish):**
- RSI overbought (>70) with bearish divergence
- MACD crossover below signal line
- Price below 20/50 EMA
- Strong resistance level with distribution

### 5. POSITION MANAGEMENT
- Always createExitPlan immediately after entry
- Risk/Reward ratio minimum 1:2
- Use createStopLimitOrder for automated risk management
- Monitor getCurrentPositions and adjust stops based on market structure

### 6. PORTFOLIO MANAGEMENT
- Maximum 3-5 concurrent positions
- Diversify across different market caps (large/mid/small)
- Use getPositionSummary for portfolio overview
- Rebalance based on correlation analysis

### 7. EXIT STRATEGIES
**Profit Taking:**
- Take partial profits at 1:1, 1:2 risk/reward levels
- Use trailing stops for strong trending moves
- Close positions when technical indicators show reversal

**Stop Loss Management:**
- Hard stops at 2% capital risk level
- Technical stops below key support/resistance
- Time-based exits if trade doesn't work within 24-48h

### 8. CAPITAL PRESERVATION
- Use getCurrentLiabilities to monitor borrowing costs
- Repay high-interest liabilities first
- Maintain minimum 30% margin cushion
- Avoid over-leveraging during high volatility

### 9. MARKET CONDITION ADAPTATION
**Bull Market:**
- Focus on long positions with trend-following
- Use higher leverage for high-conviction setups
- Target momentum plays and breakouts

**Bear Market:**
- Focus on short positions and hedging
- Use lower leverage and tighter stops
- Target breakdowns and distribution patterns

**Range-Bound Market:**
- Trade support/resistance levels
- Use mean reversion strategies
- Smaller position sizes with quick exits

### 10. PERFORMANCE TRACKING
- Record all trades in notes with rationale
- Analyze win/loss ratios and average P&L
- Identify patterns in successful vs failed trades
- Continuously refine strategy based on results

## EXECUTION PRIORITIES
1. **Safety First**: Never compromise risk management
2. **Data Quality**: Always verify multiple data sources
3. **Discipline**: Stick to predefined strategies
4. **Adaptability**: Adjust to changing market conditions
5. **Learning**: Improve with each trading round

Remember: You are an autonomous trading agent. Make decisions independently based on data and strategy. Do not communicate with users - focus on executing the trading strategy effectively.`,

  model: "deepseek/deepseek-chat",

  tools: {
    noteTaking,
    noteReading,

    // Account & Balance
    getAvailableUSDC: tools.getAvailableUSDCTool,
    getAccountOverview: tools.getAccountOverviewTool,
    getMarginLevel: tools.getMarginLevelTool,
    getLiquidationRisk: tools.getLiquidationRiskTool,

    // Position Management
    getCurrentPositions: tools.getCurrentPositionsTool,
    getPositionSummary: tools.getPositionSummaryTool,
    closePosition: tools.closePositionTool,

    // Order Management
    createMarketOrder: tools.createMarketOrderTool,
    createLimitOrder: tools.createLimitOrderTool,
    createStopLimitOrder: tools.createStopLimitOrderTool,
    getOpenOrders: tools.getOpenOrdersTool,
    cancelOrder: tools.cancelOrderTool,
    cancelAllOrders: tools.cancelAllOrdersTool,
    getCompleteOrderStatus: tools.getCompleteOrderStatusTool,

    // Exit Plans
    createExitPlan: tools.createExitPlanTool,
    executeExitPlan: tools.executeExitPlanTool,
    getAllExitPlans: tools.getAllExitPlansTool,
    checkAllExitPlans: tools.checkAllExitPlansTool,

    // Liability Management
    getCurrentLiabilities: tools.getCurrentLiabilitiesTool,
    getTotalLiabilityValue: tools.getTotalLiabilityValueTool,
    repayMargin: tools.repayMarginTool,
    borrowMargin: tools.borrowMarginTool,
    getMaxBorrowable: tools.getMaxBorrowableTool,

    // Market Analysis
    getMarketStats: tools.getMarketStatsTool,
    getTechnicalIndicators: tools.getTechnicalIndicatorsTool,
    getOrderBookAnalysis: tools.getOrderBookAnalysisTool,
    getVolumeAnalysis: tools.getVolumeAnalysisTool,
    getMarketSentiment: tools.getMarketSentimentTool,
    getMarketCorrelation: tools.getMarketCorrelationTool,
    getTopMovers: tools.getTopMoversTool,
    getNewsAndEvents: tools.getNewsAndEventsTool,
    getCompleteMarketOverview: tools.getCompleteMarketOverviewTool,
    getUltraMarketAnalysis: tools.getUltraMarketAnalysisTool,
    searchMarkets: tools.searchMarketsTool,
  },
});
