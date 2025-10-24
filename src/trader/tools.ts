import { z } from 'zod';
import { VM } from 'vm2';
import { BinanceMarketInspector } from './MarketInspector.js';
import { MarketTrader } from './MarketTrader.js';

// Tool definition interface
interface ToolDefinition {
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

// Initialize inspector instance
// This will be injected by the agent
let marketInspector: BinanceMarketInspector;
let marketTrader: MarketTrader;

export function initializeTools(inspector: BinanceMarketInspector) {
  marketInspector = inspector;
}

export function initializeTrader(trader: MarketTrader) {
  marketTrader = trader;
}

// ============================================
// ACCOUNT & BALANCE TOOLS
// ============================================

export const getAvailableUSDTTool: ToolDefinition = {
  description: 'Get current available USDT balance including borrowed amounts and interest. Returns total, free, used, borrowed, interest, and net available.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getAvailableUSDT();
  },
};

export const getAccountOverviewTool: ToolDefinition = {
  description: 'Get complete account overview including balance, positions, margin level, liabilities, and all open orders.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getAccountOverview();
  },
};

export const getMarginLevelTool: ToolDefinition = {
  description: 'Get current margin level and margin ratio. Critical for assessing liquidation risk.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getMarginLevel();
  },
};

export const getLiquidationRiskTool: ToolDefinition = {
  description: 'Get detailed liquidation risk analysis including margin level, risk percentage, and safe distance from liquidation.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getLiquidationRisk();
  },
};

// ============================================
// POSITION MANAGEMENT TOOLS
// ============================================

export const getCurrentPositionsTool: ToolDefinition = {
  description: 'Get all current open positions with detailed P&L, notional value in USDT, entry price, and current price.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getCurrentPositions();
  },
};

export const getPositionSummaryTool: ToolDefinition = {
  description: 'Get summarized view of all positions with total counts, total notional, unrealized P&L breakdown.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getPositionSummary();
  },
};


// ============================================
// LIABILITY MANAGEMENT TOOLS
// ============================================

export const getCurrentLiabilitiesTool: ToolDefinition = {
  description: 'Get current borrowed amounts and interest for all assets.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getCurrentLiabilities();
  },
};

export const getTotalLiabilityValueTool: ToolDefinition = {
  description: 'Get total liability value in USDT across all borrowed assets.',
  parameters: z.object({}),
  execute: async () => {
    return await marketInspector.getTotalLiabilityValue();
  },
};


export const getMaxBorrowableTool: ToolDefinition = {
  description: 'Get maximum borrowable amount for a specific asset.',
  parameters: z.object({
    asset: z.string().describe('Asset symbol'),
    symbol: z.string().optional().describe('Trading pair for isolated margin'),
  }),
  execute: async ({ asset, symbol }: { asset: string; symbol?: string }) => {
    return await marketInspector.getMaxBorrowable(asset, symbol);
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

export const getSymbolFiltersTool: ToolDefinition = {
  description: 'Get symbol filters including LOT_SIZE, PRICE_FILTER, and MIN_NOTIONAL requirements.',
  parameters: z.object({
    symbol: z.string().describe('Trading pair symbol (e.g., "BTC/USDT")'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return await marketInspector.getSymbolFilters(symbol);
  },
};

// ============================================
// TRADER EXECUTION TOOLS (MARKETTRADER)
// ============================================

export const openPositionWithProtectionTool: ToolDefinition = {
  description: 'Place a cross margin order (MARKET/LIMIT) with optional auto-borrow and attach OCO TP/SL. Returns order and protection status.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
    side: z.enum(['BUY', 'SELL']).describe('Entry direction: BUY (long) or SELL (short)'),
    type: z.enum(['MARKET', 'LIMIT']).describe('Order type for the entry'),
    quantity: z.number().optional().describe('Base asset amount. For LIMIT, usually required unless using quoteOrderQty for MARKET'),
    quoteOrderQty: z.number().optional().describe('Quote amount (e.g., USDT) for MARKET orders. Mutually exclusive with quantity'),
    price: z.number().optional().describe('Limit price when type is LIMIT'),
    timeInForce: z.enum(['GTC', 'IOC', 'FOK']).optional().describe('Time in force for LIMIT orders'),
    sideEffectType: z.enum(['NO_SIDE_EFFECT', 'MARGIN_BUY', 'AUTO_REPAY', 'AUTO_BORROW_REPAY']).optional().describe('Borrow/repay behavior. Use MARGIN_BUY or AUTO_BORROW_REPAY to auto-borrow for leveraged entries'),
    autoRepayAtCancel: z.boolean().optional().describe('If true, debt generated by the order is repaid when order is cancelled (default true)'),
    takeProfitPrice: z.number().describe('Take-profit limit price for OCO protection'),
    stopLossPrice: z.number().describe('Stop price for stop-loss leg in OCO protection'),
    stopLimitPrice: z.number().optional().describe('Optional stop-limit price for SL leg. If set, SL uses STOP_LOSS_LIMIT with GTC'),
  }),
  execute: async (args: any) => {
    return marketTrader.openPositionWithProtection(args);
  },
};

export const addProtectionOcoTool: ToolDefinition = {
  description: 'Attach OCO TP/SL to an existing position/order. Opposite side to entry is required.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
    side: z.enum(['BUY', 'SELL']).describe('Protection side (opposite to entry): SELL for long entries, BUY for short entries'),
    quantity: z.number().describe('Base asset amount to protect (usually current filled/position size)'),
    takeProfitPrice: z.number().describe('Take-profit limit price'),
    stopLossPrice: z.number().describe('Stop price for stop-loss'),
    stopLimitPrice: z.number().optional().describe('Optional stop-limit price for stop-loss'),
    autoRepayAtCancel: z.boolean().optional().describe('If true, repay debt on cancel (default true)'),
  }),
  execute: async (args: any) => {
    return marketTrader.addProtectionOco(args);
  },
};

export const cancelOcoTool: ToolDefinition = {
  description: 'Cancel a protection OCO by orderListId or listClientOrderId.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
    orderListId: z.number().optional().describe('OCO orderListId to cancel'),
    listClientOrderId: z.string().optional().describe('OCO listClientOrderId to cancel. Either this or orderListId is required'),
  }),
  execute: async (args: any) => {
    return marketTrader.cancelOco(args);
  },
};

export const cancelOrderTool: ToolDefinition = {
  description: 'Cancel a single margin order by orderId or origClientOrderId.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
    orderId: z.number().optional().describe('Order ID to cancel'),
    origClientOrderId: z.string().optional().describe('Client order ID to cancel. Either this or orderId is required'),
  }),
  execute: async (args: any) => {
    return marketTrader.cancelOrder(args);
  },
};

export const cancelAllOpenOrdersOnSymbolTool: ToolDefinition = {
  description: 'Cancel all open orders (including OCO) for a symbol on cross margin.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
  }),
  execute: async ({ symbol }: { symbol: string }) => {
    return marketTrader.cancelAllOpenOrdersOnSymbol(symbol);
  },
};

export const getOpenOrdersTool: ToolDefinition = {
  description: 'Query open orders for a symbol (or all).',
  parameters: z.object({
    symbol: z.string().optional().describe('If omitted, returns open orders for all symbols (may be large)'),
  }),
  execute: async ({ symbol }: { symbol?: string }) => {
    return marketTrader.getOpenOrders(symbol);
  },
};

export const getOpenOcoTool: ToolDefinition = {
  description: 'Query open OCO order lists.',
  parameters: z.object({}),
  execute: async () => {
    return marketTrader.getOpenOco();
  },
};

export const closePositionMarketTool: ToolDefinition = {
  description: 'Close exposure by sending opposite MARKET order with given base quantity.',
  parameters: z.object({
    symbol: z.string().describe('Binance trading symbol, e.g., BTCUSDT'),
    sideToClose: z.enum(['BUY', 'SELL']).describe('Side to send for closing: SELL for longs, BUY for shorts'),
    quantity: z.number().describe('Base asset amount to close'),
  }),
  execute: async ({ symbol, sideToClose, quantity }: { symbol: string; sideToClose: 'BUY' | 'SELL'; quantity: number }) => {
    return marketTrader.closePositionMarket(symbol, sideToClose, quantity);
  },
};

export const manualBorrowTool: ToolDefinition = {
  description: 'Manually borrow asset in cross margin (amount as string per API).',
  parameters: z.object({
    asset: z.string().describe('Asset to borrow, e.g., USDT, BTC'),
    amount: z.string().describe('Borrow amount as a string per Binance API, precision-sensitive'),
  }),
  execute: async ({ asset, amount }: { asset: string; amount: string }) => {
    return marketTrader.manualBorrow(asset, amount);
  },
};

export const manualRepayTool: ToolDefinition = {
  description: 'Manually repay asset in cross margin (amount as string per API).',
  parameters: z.object({
    asset: z.string().describe('Asset to repay, e.g., USDT, BTC'),
    amount: z.string().describe('Repay amount as a string per Binance API, precision-sensitive'),
  }),
  execute: async ({ asset, amount }: { asset: string; amount: string }) => {
    return marketTrader.manualRepay(asset, amount);
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

  // Liability Management
  getCurrentLiabilitiesTool,
  getTotalLiabilityValueTool,
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
  getSymbolFiltersTool,
  getChartDataTool,
  executeJavaScriptTool,
  // Execution & Order Management
  openPositionWithProtectionTool,
  addProtectionOcoTool,
  cancelOcoTool,
  cancelOrderTool,
  cancelAllOpenOrdersOnSymbolTool,
  getOpenOrdersTool,
  getOpenOcoTool,
  closePositionMarketTool,
  manualBorrowTool,
  manualRepayTool,
];
