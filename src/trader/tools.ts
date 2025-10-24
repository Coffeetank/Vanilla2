import { createTool } from '@mastra/core';
import { z } from 'zod';
import { BinanceMarginTrader } from './MarginTrader.js';
import { BinanceMarketInspector } from './MarketInspector.js';

// Initialize trader and inspector instances
// These will be injected by the agent
let marginTrader: BinanceMarginTrader;
let marketInspector: BinanceMarketInspector;

export function initializeTools(trader: BinanceMarginTrader, inspector: BinanceMarketInspector) {
  marginTrader = trader;
  marketInspector = inspector;
}

// ============================================
// ACCOUNT & BALANCE TOOLS
// ============================================

export const getAvailableUSDCTool = createTool({
  id: 'get-available-usdc',
  description: 'Get current available USDC balance including borrowed amounts and interest. Returns total, free, used, borrowed, interest, and net available.',
  inputSchema: z.object({}),
  outputSchema: z.object({
    total: z.number(),
    free: z.number(),
    used: z.number(),
    borrowed: z.number(),
    interest: z.number(),
    netAvailable: z.number(),
  }),
  execute: async () => {
    return await marginTrader.getAvailableUSDC();
  },
});

export const getAccountOverviewTool = createTool({
  id: 'get-account-overview',
  description: 'Get complete account overview including balance, positions, margin level, liabilities, and all open orders.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getAccountOverview();
  },
});

export const getMarginLevelTool = createTool({
  id: 'get-margin-level',
  description: 'Get current margin level and margin ratio. Critical for assessing liquidation risk.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getMarginLevel();
  },
});

export const getLiquidationRiskTool = createTool({
  id: 'get-liquidation-risk',
  description: 'Get detailed liquidation risk analysis including margin level, risk percentage, and safe distance from liquidation.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getLiquidationRisk();
  },
});

// ============================================
// POSITION MANAGEMENT TOOLS
// ============================================

export const getCurrentPositionsTool = createTool({
  id: 'get-current-positions',
  description: 'Get all current open positions with detailed P&L, notional value in USDC, entry price, and current price.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.any()),
  execute: async () => {
    return await marginTrader.getCurrentPositions();
  },
});

export const getPositionSummaryTool = createTool({
  id: 'get-position-summary',
  description: 'Get summarized view of all positions with total counts, total notional, unrealized P&L breakdown.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getPositionSummary();
  },
});

export const closePositionTool = createTool({
  id: 'close-position',
  description: 'Close a specific position entirely using a market order. Use this when exiting a position.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.closePosition(context.symbol);
  },
});

// ============================================
// ORDER MANAGEMENT TOOLS
// ============================================

export const createMarketOrderTool = createTool({
  id: 'create-market-order',
  description: 'Create a market order for immediate execution at current market price. Use for quick entries/exits.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    side: z.enum(['buy', 'sell']).describe('Order side: buy or sell'),
    amount: z.number().describe('Amount to trade'),
    options: z.object({
      takeProfit: z.number().optional(),
      stopLoss: z.number().optional(),
      leverage: z.number().optional(),
      marginMode: z.enum(['cross', 'isolated']).optional(),
    }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const { symbol, side, amount, options } = context;
    return await marginTrader.createMarketOrder(symbol, side, amount, options);
  },
});

export const createLimitOrderTool = createTool({
  id: 'create-limit-order',
  description: 'Create a limit order to buy/sell at a specific price or better. Order will only execute at the specified price or better.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    side: z.enum(['buy', 'sell']).describe('Order side: buy or sell'),
    amount: z.number().describe('Amount to trade'),
    price: z.number().describe('Limit price'),
    options: z.object({
      takeProfit: z.number().optional(),
      stopLoss: z.number().optional(),
      timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
      postOnly: z.boolean().optional(),
    }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const { symbol, side, amount, price, options } = context;
    return await marginTrader.createLimitOrder(symbol, side, amount, price, options);
  },
});

export const createStopLimitOrderTool = createTool({
  id: 'create-stop-limit-order',
  description: 'Create a stop-limit order. When stop price is reached, a limit order is placed.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    side: z.enum(['buy', 'sell']).describe('Order side: buy or sell'),
    amount: z.number().describe('Amount to trade'),
    stopPrice: z.number().describe('Stop trigger price'),
    limitPrice: z.number().describe('Limit price after stop triggered'),
    options: z.object({
      reduceOnly: z.boolean().optional(),
      timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
    }).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    const { symbol, side, amount, stopPrice, limitPrice, options } = context;
    return await marginTrader.createStopLimitOrder(symbol, side, amount, stopPrice, limitPrice, options);
  },
});

export const getOpenOrdersTool = createTool({
  id: 'get-open-orders',
  description: 'Get all open orders for a specific trading pair symbol. Symbol is required to avoid rate limiting.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
  }),
  outputSchema: z.array(z.any()),
  execute: async ({ context }) => {
    return await marginTrader.getOpenOrders(context.symbol);
  },
});

export const cancelOrderTool = createTool({
  id: 'cancel-order',
  description: 'Cancel a specific order by order ID and symbol.',
  inputSchema: z.object({
    orderId: z.string().describe('Order ID to cancel'),
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.cancelOrder(context.orderId, context.symbol);
  },
});

export const cancelAllOrdersTool = createTool({
  id: 'cancel-all-orders',
  description: 'Cancel all open orders for a specific symbol.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    marginMode: z.enum(['cross', 'isolated']).optional(),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.cancelAllOrders(context.symbol, context.marginMode);
  },
});

export const getCompleteOrderStatusTool = createTool({
  id: 'get-complete-order-status',
  description: 'Get complete order status categorized by open, filled, and cancelled orders.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getCompleteOrderStatus();
  },
});

// ============================================
// EXIT PLAN TOOLS
// ============================================

export const createExitPlanTool = createTool({
  id: 'create-exit-plan',
  description: 'Create an exit plan for a position with target price and stop loss. Returns risk/reward analysis.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    targetPrice: z.number().describe('Target exit price'),
    stopPrice: z.number().describe('Stop loss price'),
    invalidationConditions: z.array(z.any()).optional().describe('Technical invalidation conditions'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.createExitPlan(context.symbol, context.targetPrice, context.stopPrice, context.invalidationConditions);
  },
});

export const executeExitPlanTool = createTool({
  id: 'execute-exit-plan',
  description: 'Execute an exit plan by placing OCO (One-Cancels-Other) order with target and stop loss.',
  inputSchema: z.object({
    exitPlan: z.any().describe('Exit plan object to execute'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.executeExitPlan(context.exitPlan);
  },
});

export const getAllExitPlansTool = createTool({
  id: 'get-all-exit-plans',
  description: 'Get all saved exit plans for current positions.',
  inputSchema: z.object({}),
  outputSchema: z.array(z.any()),
  execute: async () => {
    return await marginTrader.getAllExitPlans();
  },
});

export const checkAllExitPlansTool = createTool({
  id: 'check-all-exit-plans',
  description: 'Check all exit plans for invalidation conditions. Returns plans to execute and invalid plans.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.checkAllExitPlans();
  },
});

// ============================================
// LIABILITY MANAGEMENT TOOLS
// ============================================

export const getCurrentLiabilitiesTool = createTool({
  id: 'get-current-liabilities',
  description: 'Get current borrowed amounts and interest for all assets.',
  inputSchema: z.object({}),
  outputSchema: z.any(),
  execute: async () => {
    return await marginTrader.getCurrentLiabilities();
  },
});

export const getTotalLiabilityValueTool = createTool({
  id: 'get-total-liability-value',
  description: 'Get total liability value in USDC across all borrowed assets.',
  inputSchema: z.object({}),
  outputSchema: z.number(),
  execute: async () => {
    return await marginTrader.getTotalLiabilityValue();
  },
});

export const repayMarginTool = createTool({
  id: 'repay-margin',
  description: 'Repay borrowed margin for a specific asset.',
  inputSchema: z.object({
    asset: z.string().describe('Asset symbol to repay (e.g., BTC, USDT)'),
    amount: z.number().describe('Amount to repay'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.repayMargin(context.asset, context.amount, context.symbol);
  },
});

export const borrowMarginTool = createTool({
  id: 'borrow-margin',
  description: 'Borrow margin for a specific asset. Check max borrowable first.',
  inputSchema: z.object({
    asset: z.string().describe('Asset symbol to borrow'),
    amount: z.number().describe('Amount to borrow'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.borrowMargin(context.asset, context.amount, context.symbol);
  },
});

export const getMaxBorrowableTool = createTool({
  id: 'get-max-borrowable',
  description: 'Get maximum borrowable amount for a specific asset.',
  inputSchema: z.object({
    asset: z.string().describe('Asset symbol'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marginTrader.getMaxBorrowable(context.asset, context.symbol);
  },
});

// ============================================
// MARKET ANALYSIS TOOLS
// ============================================

export const getMarketStatsTool = createTool({
  id: 'get-market-stats',
  description: 'Get comprehensive market statistics for a symbol including 24h price change, volume, high/low.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getMarketStats(context.symbol);
  },
});

export const getTechnicalIndicatorsTool = createTool({
  id: 'get-technical-indicators',
  description: 'Get technical indicators including RSI, MACD, Bollinger Bands, and moving averages.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    timeframe: z.string().default('1h').describe('Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getTechnicalIndicators(context.symbol, context.timeframe);
  },
});

export const getOrderBookAnalysisTool = createTool({
  id: 'get-order-book-analysis',
  description: 'Get order book analysis including bid-ask spread, depth imbalance, and support/resistance levels.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    limit: z.number().default(20).describe('Order book depth limit'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getOrderBookAnalysis(context.symbol, context.limit);
  },
});

export const getVolumeAnalysisTool = createTool({
  id: 'get-volume-analysis',
  description: 'Get volume analysis including volume profile, whale activity, and accumulation/distribution.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getVolumeAnalysis(context.symbol);
  },
});

export const getMarketSentimentTool = createTool({
  id: 'get-market-sentiment',
  description: 'Get market sentiment score based on technical indicators, volume, and price action.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getMarketSentiment(context.symbol);
  },
});

export const getMarketCorrelationTool = createTool({
  id: 'get-market-correlation',
  description: 'Get market correlation with BTC and major assets, plus beta calculation.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getMarketCorrelation(context.symbol);
  },
});

export const getTopMoversTool = createTool({
  id: 'get-top-movers',
  description: 'Get top gaining and losing cryptocurrencies by 24h price change.',
  inputSchema: z.object({
    limit: z.number().default(20).describe('Number of top movers to return'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getTopMovers(context.limit);
  },
});

export const getNewsAndEventsTool = createTool({
  id: 'get-news-and-events',
  description: 'Get latest news and events for a cryptocurrency from CryptoPanic and Tavily APIs. Cached for 30 minutes.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getNewsAndEvents(context.symbol);
  },
});

export const getCompleteMarketOverviewTool = createTool({
  id: 'get-complete-market-overview',
  description: 'Get complete market overview combining stats, sentiment, order book, and volume analysis.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getCompleteMarketOverview(context.symbol);
  },
});

export const getUltraMarketAnalysisTool = createTool({
  id: 'get-ultra-market-analysis',
  description: 'Get ultra-comprehensive market analysis including all indicators, sentiment, news, correlation, and volume analysis.',
  inputSchema: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  outputSchema: z.any(),
  execute: async ({ context }) => {
    return await marketInspector.getUltraMarketAnalysis(context.symbol);
  },
});

export const searchMarketsTool = createTool({
  id: 'search-markets',
  description: 'Search for trading pairs by query string.',
  inputSchema: z.object({
    query: z.string().describe('Search query (e.g., "BTC", "ETH", "DOGE")'),
  }),
  outputSchema: z.array(z.string()),
  execute: async ({ context }) => {
    return await marketInspector.searchMarkets(context.query);
  },
});

// ============================================
// ALL TOOLS EXPORT
// ============================================

export const allTools = [
  // Account & Balance
  getAvailableUSDCTool,
  getAccountOverviewTool,
  getMarginLevelTool,
  getLiquidationRiskTool,

  // Position Management
  getCurrentPositionsTool,
  getPositionSummaryTool,
  closePositionTool,

  // Order Management
  createMarketOrderTool,
  createLimitOrderTool,
  createStopLimitOrderTool,
  getOpenOrdersTool,
  cancelOrderTool,
  cancelAllOrdersTool,
  getCompleteOrderStatusTool,

  // Exit Plans
  createExitPlanTool,
  executeExitPlanTool,
  getAllExitPlansTool,
  checkAllExitPlansTool,

  // Liability Management
  getCurrentLiabilitiesTool,
  getTotalLiabilityValueTool,
  repayMarginTool,
  borrowMarginTool,
  getMaxBorrowableTool,

  // Market Analysis
  getMarketStatsTool,
  getTechnicalIndicatorsTool,
  getOrderBookAnalysisTool,
  getVolumeAnalysisTool,
  getMarketSentimentTool,
  getMarketCorrelationTool,
  getTopMoversTool,
  getNewsAndEventsTool,
  getCompleteMarketOverviewTool,
  getUltraMarketAnalysisTool,
  searchMarketsTool,
];
