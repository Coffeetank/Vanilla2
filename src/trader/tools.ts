import { z } from 'zod';
import { VM } from 'vm2';
import { BinanceMarginTrader } from './MarginTrader.js';
import { BinanceMarketInspector } from './MarketInspector.js';

// Tool definition interface
interface ToolDefinition {
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

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

export const getAvailableUSDTTool: ToolDefinition = {
  description: 'Get current available USDT balance including borrowed amounts and interest. Returns total, free, used, borrowed, interest, and net available.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getAvailableUSDT();
  },
};

export const getAccountOverviewTool: ToolDefinition = {
  description: 'Get complete account overview including balance, positions, margin level, liabilities, and all open orders.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getAccountOverview();
  },
};

export const getMarginLevelTool: ToolDefinition = {
  description: 'Get current margin level and margin ratio. Critical for assessing liquidation risk.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getMarginLevel();
  },
};

export const getLiquidationRiskTool: ToolDefinition = {
  description: 'Get detailed liquidation risk analysis including margin level, risk percentage, and safe distance from liquidation.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getLiquidationRisk();
  },
};

// ============================================
// POSITION MANAGEMENT TOOLS
// ============================================

export const getCurrentPositionsTool: ToolDefinition = {
  description: 'Get all current open positions with detailed P&L, notional value in USDT, entry price, and current price.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getCurrentPositions();
  },
};

export const getPositionSummaryTool: ToolDefinition = {
  description: 'Get summarized view of all positions with total counts, total notional, unrealized P&L breakdown.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getPositionSummary();
  },
};

export const closePositionTool: ToolDefinition = {
  description: 'Close a specific position entirely using a market order. Automatically repays borrowed USDT by default.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    autoRepay: z.boolean().optional().describe('Automatically repay borrowed assets after closing (default: true)'),
  }),
  execute: async ({ symbol, autoRepay }: { symbol: string; autoRepay?: boolean }) => {
    return await marginTrader.closePosition(symbol, { autoRepay });
  },
};

// ============================================
// ORDER MANAGEMENT TOOLS
// ============================================

export const createMarketOrderTool: ToolDefinition = {
  description: 'Create a market order for immediate execution. ALWAYS include stopLoss and takeProfit in options for leveraged positions. Binance handles these atomically with the order.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    side: z.enum(['buy', 'sell']).describe('Order side: buy or sell'),
    amount: z.number().describe('Amount to trade'),
    options: z.object({
      stopLoss: z.number().optional().describe('Stop loss price - REQUIRED for leveraged positions'),
      takeProfit: z.number().optional().describe('Take profit price - REQUIRED for leveraged positions'),
      leverage: z.number().optional().describe('Leverage multiplier (e.g., 5 for 5x)'),
      marginMode: z.enum(['cross', 'isolated']).optional(),
    }).optional(),
  }),
  execute: async ({ symbol, side, amount, options }: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    options?: {
      stopLoss?: number;
      takeProfit?: number;
      leverage?: number;
      marginMode?: 'cross' | 'isolated';
    };
  }) => {
    return await marginTrader.createMarketOrder(symbol, side, amount, options);
  },
};

export const createLimitOrderTool: ToolDefinition = {
  description: 'Create a limit order to buy/sell at a specific price or better. Order will only execute at the specified price or better.',
  parameters: z.object({
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
  execute: async ({ symbol, side, amount, price, options }: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    price: number;
    options?: {
      takeProfit?: number;
      stopLoss?: number;
      timeInForce?: 'GTC' | 'IOC' | 'FOK';
      postOnly?: boolean;
    };
  }) => {
    return await marginTrader.createLimitOrder(symbol, side, amount, price, options);
  },
};

export const createStopLimitOrderTool: ToolDefinition = {
  description: 'Create a stop-limit order. When stop price is reached, a limit order is placed.',
  parameters: z.object({
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
  execute: async ({ symbol, side, amount, stopPrice, limitPrice, options }: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    stopPrice: number;
    limitPrice: number;
    options?: {
      reduceOnly?: boolean;
      timeInForce?: 'GTC' | 'IOC' | 'FOK';
    };
  }) => {
    return await marginTrader.createStopLimitOrder(symbol, side, amount, stopPrice, limitPrice, options);
  },
};

export const createStopMarketOrderTool: ToolDefinition = {
  description: 'Create a stop-market order for stop-loss protection. When stop price is reached, order executes at market price immediately. Use this for reliable stop-loss execution.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
    side: z.enum(['buy', 'sell']).describe('Order side: buy or sell (opposite of position)'),
    amount: z.number().describe('Amount to trade'),
    stopPrice: z.number().describe('Stop trigger price'),
    options: z.object({
      reduceOnly: z.boolean().optional().describe('Set to true for closing positions'),
      timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional(),
    }).optional(),
  }),
  execute: async ({ symbol, side, amount, stopPrice, options }: {
    symbol: string;
    side: 'buy' | 'sell';
    amount: number;
    stopPrice: number;
    options?: {
      reduceOnly?: boolean;
      timeInForce?: 'GTC' | 'IOC' | 'FOK';
    };
  }) => {
    return await marginTrader.createStopMarketOrder(symbol, side, amount, stopPrice, options);
  },
};

export const getOpenOrdersTool: ToolDefinition = {
  description: 'Get all open orders for a specific trading pair symbol. Symbol is required to avoid rate limiting.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., BTC/USDT)'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marginTrader.getOpenOrders(symbol);
  },
};

export const cancelOrderTool: ToolDefinition = {
  description: 'Cancel a specific order by order ID and symbol.',
  parameters: z.object({
    orderId: z.string().describe('Order ID to cancel'),
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ orderId, symbol }: { orderId: string; symbol: string }) => {
    return await marginTrader.cancelOrder(orderId, symbol);
  },
};

export const cancelAllOrdersTool: ToolDefinition = {
  description: 'Cancel all open orders for a specific symbol.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    marginMode: z.enum(['cross', 'isolated']).optional(),
  }),
  execute: async ({ symbol, marginMode }: { symbol: string; marginMode?: 'cross' | 'isolated' }) => {
    return await marginTrader.cancelAllOrders(symbol, marginMode);
  },
};

export const getCompleteOrderStatusTool: ToolDefinition = {
  description: 'Get complete order status categorized by open, filled, and cancelled orders.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getCompleteOrderStatus();
  },
};

// ============================================
// EXIT PLAN TOOLS
// ============================================

export const createExitPlanTool: ToolDefinition = {
  description: 'Calculate risk/reward analysis for a position exit plan. This is informational only - to actually set stop-loss and take-profit, include them in the createMarketOrder options.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., ETH/USDT)'),
    targetPrice: z.number().describe('Target exit price (take-profit level)'),
    stopPrice: z.number().describe('Stop loss price'),
  }),
  execute: async ({ symbol, targetPrice, stopPrice }: {
    symbol: string;
    targetPrice: number;
    stopPrice: number;
  }) => {
    // Just calculate the exit plan (risk/reward analysis)
    const exitPlan = await marginTrader.createExitPlan(symbol, targetPrice, stopPrice, []);

    return {
      symbol,
      targetPrice,
      stopPrice,
      riskRewardRatio: exitPlan.riskRewardRatio,
      targetPnl: exitPlan.targetPnl,
      stopPnl: exitPlan.stopPnl,
      currentPrice: exitPlan.currentPrice,
      status: 'calculated',
      message: `📊 Risk/Reward: ${exitPlan.riskRewardRatio.toFixed(2)}:1. To apply these levels, use createMarketOrder with stopLoss and takeProfit options.`
    };
  },
};

// ============================================
// POSITION PROTECTION TOOLS
// ============================================

export const getUnprotectedPositionsTool: ToolDefinition = {
  description: 'Get all open positions that lack protective orders (stop-loss or take-profit). Use this to identify positions at risk.',
  parameters: z.object({}),
  execute: async () => {
    const unprotected = await marginTrader.getUnprotectedPositions();

    return {
      totalUnprotected: unprotected.length,
      positions: unprotected.map(u => ({
        symbol: u.position.symbol,
        side: u.position.side,
        size: u.position.size,
        entryPrice: u.position.entryPrice,
        markPrice: u.position.markPrice,
        pnl: u.position.unrealizedPnlUSDT,
        pnlPercentage: u.position.pnlPercentage,
        hasStopLoss: u.protection.hasStopLoss,
        hasTakeProfit: u.protection.hasTakeProfit
      })),
      message: unprotected.length > 0
        ? `⚠️ Found ${unprotected.length} unprotected position(s). Consider adding stop-loss and take-profit.`
        : `✅ All positions are protected with risk management orders.`
    };
  },
};

export const addProtectionToPositionTool: ToolDefinition = {
  description: 'Add OCO protection (stop-loss + take-profit) to an existing position. This creates an atomic OCO order that will close the position at either the stop-loss or take-profit price.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., ETH/USDT)'),
    stopLossPrice: z.number().describe('Stop-loss price to limit losses'),
    takeProfitPrice: z.number().describe('Take-profit price to lock in gains'),
  }),
  execute: async ({ symbol, stopLossPrice, takeProfitPrice }: {
    symbol: string;
    stopLossPrice: number;
    takeProfitPrice: number;
  }) => {
    return await marginTrader.addProtectionToPosition(symbol, stopLossPrice, takeProfitPrice);
  },
};

export const checkPositionProtectionTool: ToolDefinition = {
  description: 'Check if a specific position has protective orders (stop-loss or take-profit).',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., ETH/USDT)'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    const protection = await marginTrader.hasProtectiveOrders(symbol);

    return {
      symbol,
      hasStopLoss: protection.hasStopLoss,
      hasTakeProfit: protection.hasTakeProfit,
      hasProtection: protection.hasProtection,
      orderCount: protection.orders.length,
      status: protection.hasProtection
        ? (protection.hasStopLoss && protection.hasTakeProfit ? 'fully_protected' : 'partially_protected')
        : 'unprotected',
      message: protection.hasProtection
        ? `✅ Position has ${protection.hasStopLoss ? 'stop-loss' : ''}${protection.hasStopLoss && protection.hasTakeProfit ? ' and ' : ''}${protection.hasTakeProfit ? 'take-profit' : ''}`
        : `⚠️ Position has no protective orders`
    };
  },
};

export const getAllExitPlansTool: ToolDefinition = {
  description: 'Get all saved exit plans for current positions.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getAllExitPlans();
  },
};

export const checkAllExitPlansTool: ToolDefinition = {
  description: 'Check all exit plans for invalidation conditions. Returns plans to execute and invalid plans.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.checkAllExitPlans();
  },
};

// ============================================
// LIABILITY MANAGEMENT TOOLS
// ============================================

export const getCurrentLiabilitiesTool: ToolDefinition = {
  description: 'Get current borrowed amounts and interest for all assets.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getCurrentLiabilities();
  },
};

export const getTotalLiabilityValueTool: ToolDefinition = {
  description: 'Get total liability value in USDT across all borrowed assets.',
  parameters: z.object({}),
  execute: async () => {
    return await marginTrader.getTotalLiabilityValue();
  },
};

export const repayMarginTool: ToolDefinition = {
  description: 'Repay borrowed margin for a specific asset.',
  parameters: z.object({
    asset: z.string().describe('Asset symbol to repay (e.g., BTC, usdt)'),
    amount: z.number().describe('Amount to repay'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  execute: async ({ asset, amount, symbol }: { asset: string; amount: number; symbol?: string }) => {
    return await marginTrader.repayMargin(asset, amount, symbol);
  },
};

export const borrowMarginTool: ToolDefinition = {
  description: 'Borrow margin for a specific asset. Check max borrowable first.',
  parameters: z.object({
    asset: z.string().describe('Asset symbol to borrow'),
    amount: z.number().describe('Amount to borrow'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  execute: async ({ asset, amount, symbol }: { asset: string; amount: number; symbol?: string }) => {
    return await marginTrader.borrowMargin(asset, amount, symbol);
  },
};

export const getMaxBorrowableTool: ToolDefinition = {
  description: 'Get maximum borrowable amount for a specific asset.',
  parameters: z.object({
    asset: z.string().describe('Asset symbol'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  execute: async ({ asset, symbol }: { asset: string; symbol?: string }) => {
    return await marginTrader.getMaxBorrowable(asset, symbol);
  },
};

// ============================================
// MARKET ANALYSIS TOOLS
// ============================================

export const getMarketStatsTool: ToolDefinition = {
  description: 'Get comprehensive market statistics for a symbol including 24h price change, volume, high/low.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getMarketStats(symbol);
  },
};

export const getTechnicalIndicatorsTool: ToolDefinition = {
  description: 'Get technical indicators including RSI, MACD, Bollinger Bands, and moving averages.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    timeframe: z.string().default('1h').describe('Timeframe (e.g., 1m, 5m, 15m, 1h, 4h, 1d)'),
  }),
  execute: async ({ symbol, timeframe }: { symbol: string; timeframe: string }) => {
    return await marketInspector.getTechnicalIndicators(symbol, timeframe);
  },
};

export const getOrderBookAnalysisTool: ToolDefinition = {
  description: 'Get order book analysis including bid-ask spread, depth imbalance, and support/resistance levels.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
    limit: z.number().default(20).describe('Order book depth limit'),
  }),
  execute: async ({ symbol, limit }: { symbol: string; limit: number }) => {
    const analysis = await marketInspector.getOrderBookAnalysis(symbol, limit);
    // Return only most prominent information
    return {
      symbol: analysis.symbol,
      bestBid: analysis.bids[0]?.price || 0,
      bestAsk: analysis.asks[0]?.price || 0,
      spread: analysis.spread,
      spreadPercent: analysis.spreadPercent,
      buyingForce: analysis.buyingForce,
      sellingForce: analysis.sellingForce,
      forceRatio: analysis.buyingForce / (analysis.sellingForce || 1),
      marketPressure: analysis.marketPressure,
      topBids: analysis.bids.slice(0, 3), // Only top 3 bids
      topAsks: analysis.asks.slice(0, 3)  // Only top 3 asks
    };
  },
};

export const getVolumeAnalysisTool: ToolDefinition = {
  description: 'Get volume analysis including volume profile, whale activity, and accumulation/distribution.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    const analysis = await marketInspector.getVolumeAnalysis(symbol);
    // Return only most prominent information
    return {
      symbol: analysis.symbol,
      volumeTrend: analysis.volumeTrend,
      volumeMA: analysis.volumeMA,
      currentVsAverage: analysis.currentVsAverage,
      largeOrdersDetected: analysis.largeOrdersDetected,
      whaleActivity: analysis.whaleActivity,
      topVolumeZones: analysis.volumeProfile?.slice(0, 5) || [] // Only top 5 volume zones
    };
  },
};

export const getMarketSentimentTool: ToolDefinition = {
  description: 'Get market sentiment score based on technical indicators, volume, and price action.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getMarketSentiment(symbol);
  },
};

export const getMarketCorrelationTool: ToolDefinition = {
  description: 'Get market correlation with BTC and major assets, plus beta calculation.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getMarketCorrelation(symbol);
  },
};

export const getTopMoversTool: ToolDefinition = {
  description: 'Get top gaining and losing cryptocurrencies by 24h price change.',
  parameters: z.object({
    limit: z.number().default(20).describe('Number of top movers to return'),
  }),
  execute: async ({ limit }: { limit: number }) => {
    return await marketInspector.getTopMovers(limit);
  },
};

export const getNewsAndEventsTool: ToolDefinition = {
  description: 'Get latest news and events for a cryptocurrency from CryptoPanic and Tavily APIs. Cached for 30 minutes.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getNewsAndEvents(symbol);
  },
};

export const getCompleteMarketOverviewTool: ToolDefinition = {
  description: 'Get complete market overview combining stats, sentiment, order book, and volume analysis.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getCompleteMarketOverview(symbol);
  },
};

export const getMarketOverviewSummaryTool: ToolDefinition = {
  description: 'Get concise market overview with key metrics, sentiment, technical signal, and recommendation. Use this first before diving into detailed analysis.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getMarketOverviewSummary(symbol);
  },
};

export const searchMarketsTool: ToolDefinition = {
  description: 'Search for trading pairs by query string.',
  parameters: z.object({
    query: z.string().describe('Search query (e.g., "BTC", "ETH", "DOGE")'),
  }),
  execute: async ({ query }: { query: string }) => {
    return await marketInspector.searchMarkets(query);
  },
};

// ============================================
// CHART & HISTORICAL DATA TOOL
// ============================================

export const getChartDataTool: ToolDefinition = {
  description: 'Get historical OHLCV candlestick data for chart analysis. Returns open, high, low, close, volume data for specified timeframe and period.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., "BTC/USDT")'),
    timeframe: z.enum(['1m', '3m', '5m', '15m', '30m', '1h', '2h', '6h', '8h', '12h', '1d', '3d', '1w']).describe('Candlestick timeframe'),
    limit: z.number().optional().default(100).describe('Number of candles to fetch (max 1000, default 100)'),
  }),
  execute: async ({ symbol, timeframe, limit = 100 }: { symbol: string; timeframe: string; limit?: number }) => {
    return await marketInspector.getChartData(symbol, timeframe, Math.min(limit, 1000));
  },
};

// ============================================
// SCIENTIFIC CALCULATION TOOL
// ============================================

export const executeJavaScriptTool: ToolDefinition = {
  description: 'Execute JavaScript code for scientific calculations, custom indicators, statistical analysis, and complex financial math. Available functions: Math (all), Array, Object, JSON, mean(arr), median(arr), stdDev(arr), sma(prices, period), ema(prices, period), rsi(prices, period=14), percentChange(oldVal, newVal), compoundGrowth(initial, rate, periods), sharpeRatio(returns, riskFreeRate=0), round(num, decimals=2), clamp(value, min, max), console.log().',
  parameters: z.object({
    code: z.string().describe('JavaScript code to execute'),
    description: z.string().optional().describe('Description of what the calculation does'),
  }),
  execute: async ({ code, description }: { code: string; description?: string }) => {
    try {
      // Create a secure VM with scientific and financial functions
      const vm = new VM({
        timeout: 5000, // 5 second timeout
        sandbox: {
          // Math functions
          Math,

          // Array and utility functions
          Array,
          Object,
          JSON,

          // Common financial/statistical functions
          mean: (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length,
          median: (arr: number[]) => {
            const sorted = [...arr].sort((a, b) => a - b);
            const mid = Math.floor(sorted.length / 2);
            return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
          },
          stdDev: (arr: number[]) => {
            const avg = arr.reduce((a, b) => a + b, 0) / arr.length;
            const squareDiffs = arr.map(value => Math.pow(value - avg, 2));
            return Math.sqrt(squareDiffs.reduce((a, b) => a + b, 0) / arr.length);
          },

          // Technical analysis helpers
          sma: (prices: number[], period: number) => {
            const result = [];
            for (let i = period - 1; i < prices.length; i++) {
              const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
              result.push(sum / period);
            }
            return result;
          },
          ema: (prices: number[], period: number) => {
            const k = 2 / (period + 1);
            const result = [prices[0]];
            for (let i = 1; i < prices.length; i++) {
              result.push(prices[i] * k + result[i - 1] * (1 - k));
            }
            return result;
          },
          rsi: (prices: number[], period = 14) => {
            const gains = [];
            const losses = [];
            for (let i = 1; i < prices.length; i++) {
              const change = prices[i] - prices[i - 1];
              gains.push(change > 0 ? change : 0);
              losses.push(change < 0 ? -change : 0);
            }

            let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
            let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

            const rsiValues = [];
            for (let i = period; i < gains.length; i++) {
              avgGain = (avgGain * (period - 1) + gains[i]) / period;
              avgLoss = (avgLoss * (period - 1) + losses[i]) / period;
              const rs = avgGain / avgLoss;
              rsiValues.push(100 - (100 / (1 + rs)));
            }
            return rsiValues;
          },

          // Financial calculations
          percentChange: (oldVal: number, newVal: number) => ((newVal - oldVal) / oldVal) * 100,
          compoundGrowth: (initial: number, rate: number, periods: number) => initial * Math.pow(1 + rate, periods),
          sharpeRatio: (returns: number[], riskFreeRate = 0) => {
            const excess = returns.map(r => r - riskFreeRate);
            const avgExcess = excess.reduce((a, b) => a + b, 0) / excess.length;
            const stdDev = Math.sqrt(excess.map(x => Math.pow(x - avgExcess, 2)).reduce((a, b) => a + b, 0) / excess.length);
            return avgExcess / stdDev;
          },

          // Utility functions
          round: (num: number, decimals = 2) => Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals),
          clamp: (value: number, min: number, max: number) => Math.min(Math.max(value, min), max),

          // Console for debugging (safe)
          console: {
            log: (...args: any[]) => ({ type: 'log', message: args.join(' ') })
          }
        }
      });

      // Wrap code in a function to allow return statements
      const wrappedCode = `(function() { ${code} })()`;

      // Execute the wrapped code
      const result = vm.run(wrappedCode);

      return {
        success: true,
        result,
        description: description || 'JavaScript calculation executed',
        executionTime: new Date().toISOString()
      };

    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        description: description || 'JavaScript calculation failed'
      };
    }
  },
};

// ============================================
// ALL TOOLS EXPORT
// ============================================

export const allTools = [
  // Account & Balance
  getAvailableUSDTTool,
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
  createStopMarketOrderTool,
  getOpenOrdersTool,
  cancelOrderTool,
  cancelAllOrdersTool,
  getCompleteOrderStatusTool,

  // Exit Plans
  createExitPlanTool,

  // Position Protection
  getUnprotectedPositionsTool,
  addProtectionToPositionTool,
  checkPositionProtectionTool,

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
  getMarketOverviewSummaryTool,
  searchMarketsTool,
  getChartDataTool,
  executeJavaScriptTool,
];
