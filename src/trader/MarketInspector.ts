import ccxt, { binance } from 'ccxt';

export interface MarketConfig {
  apiKey?: string;
  secret?: string;
  sandbox?: boolean;
  cryptoPanicApiKey?: string;
  tavilyApiKey?: string;
}

export interface MarketStats {
  symbol: string;
  currentPrice: number;
  change24h: number;
  changePercent24h: number;
  high24h: number;
  low24h: number;
  volume24h: number;
  volumeUSDT24h: number;
  baseVolume: number;
  quoteVolume: number;
  timestamp: number;
}

export interface OrderBookAnalysis {
  symbol: string;
  bids: Array<{price: number, amount: number, total: number}>;
  asks: Array<{price: number, amount: number, total: number}>;
  spread: number;
  spreadPercent: number;
  buyingForce: number;
  sellingForce: number;
  strongestBid: {price: number, amount: number};
  strongestAsk: {price: number, amount: number};
  marketPressure: 'bullish' | 'bearish' | 'neutral';
  liquidityScore: number;
}

export interface TradeStats {
  symbol: string;
  totalTrades: number;
  buyTrades: number;
  sellTrades: number;
  buyVolume: number;
  sellVolume: number;
  avgTradeSize: number;
  largestTrade: number;
  buyRatio: number;
  sellRatio: number;
  volumeWeightedPrice: number;
  priceDirection: 'up' | 'down' | 'sideways';
}

export interface CandlestickData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ChartAnalysis {
  symbol: string;
  timeframe: string;
  candles: CandlestickData[];
  statistics: {
    totalCandles: number;
    bullishCandles: number;
    bearishCandles: number;
    dojiCandles: number;
    highestPrice: number;
    lowestPrice: number;
    priceRange: number;
    avgVolume: number;
    totalVolume: number;
    priceChange: number;
    priceChangePercent: number;
    volatility: number;
    trend: 'bullish' | 'bearish' | 'sideways';
  };
  patterns: {
    consecutiveBullish: number;
    consecutiveBearish: number;
    hammers: number;
    shootingStars: number;
    engulfingBullish: number;
    engulfingBearish: number;
  };
}

export interface MarketSentiment {
  symbol: string;
  overallSentiment: 'extremely_bullish' | 'bullish' | 'neutral' | 'bearish' | 'extremely_bearish';
  sentimentScore: number; // -100 to +100
  indicators: {
    priceAction: number;
    volume: number;
    orderBook: number;
    trades: number;
  };
  recommendation: string;
}

export interface TechnicalIndicators {
  symbol: string;
  timeframe: string;
  rsi: number;
  macd: {
    macd: number;
    signal: number;
    histogram: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  bollingerBands: {
    upper: number;
    middle: number;
    lower: number;
    position: 'overbought' | 'oversold' | 'neutral';
    squeeze: boolean;
  };
  movingAverages: {
    sma20: number;
    sma50: number;
    ema12: number;
    ema26: number;
    trend: 'bullish' | 'bearish' | 'neutral';
  };
  support: number[];
  resistance: number[];
}

export interface VolumeAnalysis {
  symbol: string;
  volumeProfile: {
    price: number;
    volume: number;
    percentage: number;
  }[];
  volumeTrend: 'increasing' | 'decreasing' | 'stable';
  volumeMA: number;
  currentVsAverage: number;
  largeOrdersDetected: boolean;
  whaleActivity: {
    detected: boolean;
    orderSize: number;
    frequency: number;
  };
}

export interface MarketDepthAnalysis {
  symbol: string;
  depthImbalance: number; // Positive = more buyers, Negative = more sellers
  supportLevels: Array<{price: number, strength: number}>;
  resistanceLevels: Array<{price: number, strength: number}>;
  wallAnalysis: {
    buyWalls: Array<{price: number, size: number}>;
    sellWalls: Array<{price: number, size: number}>;
  };
  liquidityHeatmap: Array<{
    priceLevel: number;
    liquidityScore: number;
    side: 'buy' | 'sell';
  }>;
}

export interface FundingAndFees {
  symbol: string;
  fundingRate?: number;
  fundingHistory?: Array<{timestamp: number, rate: number}>;
  tradingFees: {
    maker: number;
    taker: number;
  };
  borrowRates?: {
    baseAsset: number;
    quoteAsset: number;
  };
}

export interface ArbitrageOpportunities {
  symbol: string;
  exchanges: Array<{
    exchange: string;
    price: number;
    volume: number;
  }>;
  maxSpread: number;
  bestBuy: {exchange: string, price: number};
  bestSell: {exchange: string, price: number};
  profitPotential: number;
}

export interface MarketCorrelation {
  symbol: string;
  correlatedAssets: Array<{
    symbol: string;
    correlation: number;
    strength: 'strong' | 'moderate' | 'weak';
  }>;
  btcCorrelation: number;
  ethCorrelation: number;
  marketBeta: number;
}

export interface NewsAndEvents {
  symbol: string;
  upcomingEvents: Array<{
    date: string;
    event: string;
    impact: 'high' | 'medium' | 'low';
    source: string;
  }>;
  recentNews: Array<{
    id?: string;
    headline: string;
    summary?: string;
    source: string;
    timestamp: number;
    url?: string;
    votes?: {
      positive: number;
      negative: number;
      important: number;
    };
    rawData?: any; // Store original API response
  }>;
  marketAnalysis: Array<{
    headline: string;
    content: string;
    source: string;
    timestamp: number;
    relevanceScore: number;
    url: string;
    rawData?: any; // Store original API response
  }>;
  totalMentions: number;
  cacheInfo: {
    cached: boolean;
    cacheTime?: number;
    nextRefresh?: number;
  };
}

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiry: number;
}

interface CryptoPanicResponse {
  results: Array<{
    id: string;
    title: string;
    summary?: string;
    url: string;
    source: {
      title: string;
      domain: string;
    };
    published_at: string;
    votes: {
      positive: number;
      negative: number;
      important: number;
    };
    currencies?: Array<{
      code: string;
      title: string;
    }>;
  }>;
}

interface TavilyResponse {
  results: Array<{
    title: string;
    url: string;
    content: string;
    score: number;
    published_date?: string;
  }>;
}

export class BinanceMarketInspector {
  private exchange: binance;
  private cryptoPanicApiKey?: string;
  private tavilyApiKey?: string;
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

  constructor(config: MarketConfig = {}) {
    this.exchange = new ccxt.binance({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.sandbox || false,
      options: {
        defaultType: 'spot'
      }
    });
    this.cryptoPanicApiKey = config.cryptoPanicApiKey;
    this.tavilyApiKey = config.tavilyApiKey;
  }

  // Price and 24h Statistics
  async getMarketStats(symbol: string): Promise<MarketStats> {
    const ticker = await this.exchange.fetchTicker(symbol);

    // Convert to USDT volume
    let volumeUSDT24h = ticker.quoteVolume || 0;
    if (!symbol.includes('USDT') && !symbol.includes('USDT')) {
      const USDTPrice = await this.getUSDTPrice(symbol);
      volumeUSDT24h = (ticker.baseVolume || 0) * USDTPrice;
    }

    return {
      symbol,
      currentPrice: ticker.last || ticker.close || 0,
      change24h: ticker.change || 0,
      changePercent24h: ticker.percentage || 0,
      high24h: ticker.high || 0,
      low24h: ticker.low || 0,
      volume24h: ticker.baseVolume || 0,
      volumeUSDT24h,
      baseVolume: ticker.baseVolume || 0,
      quoteVolume: ticker.quoteVolume || 0,
      timestamp: ticker.timestamp || Date.now()
    };
  }

  async getMultipleMarketStats(symbols: string[]): Promise<MarketStats[]> {
    const promises = symbols.map(symbol => this.getMarketStats(symbol));
    return await Promise.all(promises);
  }

  async getTopMovers(limit: number = 20): Promise<{
    gainers: MarketStats[];
    losers: MarketStats[];
    volume: MarketStats[];
  }> {
    const tickers = await this.exchange.fetchTickers();
    const stats: MarketStats[] = [];

    for (const [symbol, ticker] of Object.entries(tickers)) {
      if (symbol.includes('USDT') || symbol.includes('USDT')) {
        const volumeUSDT24h = ticker.quoteVolume || 0;

        stats.push({
          symbol,
          currentPrice: ticker.last || ticker.close || 0,
          change24h: ticker.change || 0,
          changePercent24h: ticker.percentage || 0,
          high24h: ticker.high || 0,
          low24h: ticker.low || 0,
          volume24h: ticker.baseVolume || 0,
          volumeUSDT24h,
          baseVolume: ticker.baseVolume || 0,
          quoteVolume: ticker.quoteVolume || 0,
          timestamp: ticker.timestamp || Date.now()
        });
      }
    }

    // Sort by different criteria
    const gainers = stats
      .filter(s => s.changePercent24h > 0)
      .sort((a, b) => b.changePercent24h - a.changePercent24h)
      .slice(0, limit);

    const losers = stats
      .filter(s => s.changePercent24h < 0)
      .sort((a, b) => a.changePercent24h - b.changePercent24h)
      .slice(0, limit);

    const volume = stats
      .sort((a, b) => b.volumeUSDT24h - a.volumeUSDT24h)
      .slice(0, limit);

    return { gainers, losers, volume };
  }

  // Order Book Analysis
  async getOrderBookAnalysis(symbol: string, limit: number = 20): Promise<OrderBookAnalysis> {
    const orderBook = await this.exchange.fetchOrderBook(symbol, limit);

    const bids = orderBook.bids.map(([price, amount], index) => ({
      price: Number(price || 0),
      amount: Number(amount || 0),
      total: orderBook.bids.slice(0, index + 1).reduce((sum, [, amt]) => sum + Number(amt || 0), 0)
    }));

    const asks = orderBook.asks.map(([price, amount], index) => ({
      price: Number(price || 0),
      amount: Number(amount || 0),
      total: orderBook.asks.slice(0, index + 1).reduce((sum, [, amt]) => sum + Number(amt || 0), 0)
    }));

    const bestBid = bids[0]?.price || 0;
    const bestAsk = asks[0]?.price || 0;
    const spread = bestAsk - bestBid;
    const spreadPercent = (spread / bestBid) * 100;

    // Calculate forces
    const buyingForce = bids.reduce((sum, bid) => sum + (bid.price * bid.amount), 0);
    const sellingForce = asks.reduce((sum, ask) => sum + (ask.price * ask.amount), 0);

    // Find strongest orders
    const strongestBid = bids.reduce((max, bid) =>
      bid.amount > max.amount ? bid : max, bids[0] || {price: 0, amount: 0});

    const strongestAsk = asks.reduce((max, ask) =>
      ask.amount > max.amount ? ask : max, asks[0] || {price: 0, amount: 0});

    // Determine market pressure
    let marketPressure: 'bullish' | 'bearish' | 'neutral' = 'neutral';
    const forceRatio = buyingForce / (sellingForce || 1);
    if (forceRatio > 1.1) marketPressure = 'bullish';
    else if (forceRatio < 0.9) marketPressure = 'bearish';

    // Calculate liquidity score (0-100)
    const totalLiquidity = buyingForce + sellingForce;
    const liquidityScore = Math.min(100, totalLiquidity / 1000000 * 100);

    return {
      symbol,
      bids,
      asks,
      spread,
      spreadPercent,
      buyingForce,
      sellingForce,
      strongestBid,
      strongestAsk,
      marketPressure,
      liquidityScore
    };
  }

  // Trade Analysis
  async getTradeStats(symbol: string, limit: number = 100): Promise<TradeStats> {
    const trades = await this.exchange.fetchTrades(symbol, undefined, limit);

    let buyTrades = 0;
    let sellTrades = 0;
    let buyVolume = 0;
    let sellVolume = 0;
    let totalVolume = 0;
    let totalValue = 0;
    let largestTrade = 0;

    for (const trade of trades) {
      const volume = trade.amount || 0;
      const value = (trade.amount || 0) * (trade.price || 0);

      totalVolume += volume;
      totalValue += value;

      if (volume > largestTrade) {
        largestTrade = volume;
      }

      // Determine if buy or sell based on side or price movement
      if (trade.side === 'buy') {
        buyTrades++;
        buyVolume += volume;
      } else {
        sellTrades++;
        sellVolume += volume;
      }
    }

    const avgTradeSize = totalVolume / (trades.length || 1);
    const buyRatio = (buyVolume / (totalVolume || 1)) * 100;
    const sellRatio = 100 - buyRatio;
    const volumeWeightedPrice = totalValue / (totalVolume || 1);

    // Determine price direction
    let priceDirection: 'up' | 'down' | 'sideways' = 'sideways';
    if (trades.length >= 2) {
      const firstPrice = trades[0].price || 0;
      const lastPrice = trades[trades.length - 1].price || 0;
      const priceChange = ((lastPrice - firstPrice) / firstPrice) * 100;

      if (priceChange > 0.1) priceDirection = 'up';
      else if (priceChange < -0.1) priceDirection = 'down';
    }

    return {
      symbol,
      totalTrades: trades.length,
      buyTrades,
      sellTrades,
      buyVolume,
      sellVolume,
      avgTradeSize,
      largestTrade,
      buyRatio,
      sellRatio,
      volumeWeightedPrice,
      priceDirection
    };
  }

  // Chart Data and Analysis
  async getChartAnalysis(
    symbol: string,
    timeframe: string = '1h',
    limit: number = 100
  ): Promise<ChartAnalysis> {
    const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

    const candles: CandlestickData[] = ohlcv.map(([timestamp, open, high, low, close, volume]) => ({
      timestamp: Number(timestamp || 0),
      open: Number(open || 0),
      high: Number(high || 0),
      low: Number(low || 0),
      close: Number(close || 0),
      volume: Number(volume || 0)
    }));

    // Calculate statistics
    let bullishCandles = 0;
    let bearishCandles = 0;
    let dojiCandles = 0;
    let highestPrice = 0;
    let lowestPrice = Infinity;
    let totalVolume = 0;

    // Pattern detection
    let consecutiveBullish = 0;
    let consecutiveBearish = 0;
    let maxConsecutiveBullish = 0;
    let maxConsecutiveBearish = 0;
    let hammers = 0;
    let shootingStars = 0;
    let engulfingBullish = 0;
    let engulfingBearish = 0;

    for (let i = 0; i < candles.length; i++) {
      const candle = candles[i];
      const prevCandle = i > 0 ? candles[i - 1] : null;

      // Basic statistics
      if (candle.close > candle.open) {
        bullishCandles++;
        consecutiveBullish++;
        consecutiveBearish = 0;
        maxConsecutiveBullish = Math.max(maxConsecutiveBullish, consecutiveBullish);
      } else if (candle.close < candle.open) {
        bearishCandles++;
        consecutiveBearish++;
        consecutiveBullish = 0;
        maxConsecutiveBearish = Math.max(maxConsecutiveBearish, consecutiveBearish);
      } else {
        dojiCandles++;
        consecutiveBullish = 0;
        consecutiveBearish = 0;
      }

      highestPrice = Math.max(highestPrice, candle.high);
      lowestPrice = Math.min(lowestPrice, candle.low);
      totalVolume += candle.volume;

      // Pattern detection
      const bodySize = Math.abs(candle.close - candle.open);
      const upperShadow = candle.high - Math.max(candle.open, candle.close);
      const lowerShadow = Math.min(candle.open, candle.close) - candle.low;

      // Hammer pattern
      if (lowerShadow > bodySize * 2 && upperShadow < bodySize * 0.5) {
        hammers++;
      }

      // Shooting star pattern
      if (upperShadow > bodySize * 2 && lowerShadow < bodySize * 0.5) {
        shootingStars++;
      }

      // Engulfing patterns
      if (prevCandle) {
        const prevBodySize = Math.abs(prevCandle.close - prevCandle.open);

        if (candle.close > candle.open && // Current is bullish
            prevCandle.close < prevCandle.open && // Previous was bearish
            candle.open < prevCandle.close &&
            candle.close > prevCandle.open) {
          engulfingBullish++;
        }

        if (candle.close < candle.open && // Current is bearish
            prevCandle.close > prevCandle.open && // Previous was bullish
            candle.open > prevCandle.close &&
            candle.close < prevCandle.open) {
          engulfingBearish++;
        }
      }
    }

    const firstCandle = candles[0];
    const lastCandle = candles[candles.length - 1];
    const priceChange = lastCandle.close - firstCandle.open;
    const priceChangePercent = (priceChange / firstCandle.open) * 100;
    const priceRange = highestPrice - lowestPrice;
    const avgVolume = totalVolume / candles.length;

    // Calculate volatility (standard deviation of closes)
    const prices = candles.map(c => c.close);
    const avgPrice = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - avgPrice, 2), 0) / prices.length;
    const volatility = Math.sqrt(variance) / avgPrice * 100;

    // Determine trend
    let trend: 'bullish' | 'bearish' | 'sideways' = 'sideways';
    if (priceChangePercent > 2) trend = 'bullish';
    else if (priceChangePercent < -2) trend = 'bearish';

    return {
      symbol,
      timeframe,
      candles,
      statistics: {
        totalCandles: candles.length,
        bullishCandles,
        bearishCandles,
        dojiCandles,
        highestPrice,
        lowestPrice,
        priceRange,
        avgVolume,
        totalVolume,
        priceChange,
        priceChangePercent,
        volatility,
        trend
      },
      patterns: {
        consecutiveBullish: maxConsecutiveBullish,
        consecutiveBearish: maxConsecutiveBearish,
        hammers,
        shootingStars,
        engulfingBullish,
        engulfingBearish
      }
    };
  }

  // Market Sentiment Analysis
  async getMarketSentiment(symbol: string): Promise<MarketSentiment> {
    const [marketStats, orderBookAnalysis, tradeStats, chartAnalysis] = await Promise.all([
      this.getMarketStats(symbol),
      this.getOrderBookAnalysis(symbol),
      this.getTradeStats(symbol),
      this.getChartAnalysis(symbol, '1h', 24) // Last 24 hours
    ]);

    // Calculate individual indicator scores (-100 to +100)

    // Price action score
    let priceAction = 0;
    if (marketStats.changePercent24h > 5) priceAction = 80;
    else if (marketStats.changePercent24h > 2) priceAction = 50;
    else if (marketStats.changePercent24h > 0) priceAction = 20;
    else if (marketStats.changePercent24h > -2) priceAction = -20;
    else if (marketStats.changePercent24h > -5) priceAction = -50;
    else priceAction = -80;

    // Volume score
    let volume = 0;
    const avgVolume = marketStats.volumeUSDT24h / 24; // Rough hourly average
    if (avgVolume > 10000000) volume = 60; // High volume
    else if (avgVolume > 5000000) volume = 30;
    else if (avgVolume > 1000000) volume = 0;
    else volume = -30; // Low volume

    // Order book score
    let orderBook = 0;
    if (orderBookAnalysis.marketPressure === 'bullish') orderBook = 40;
    else if (orderBookAnalysis.marketPressure === 'bearish') orderBook = -40;

    // Add liquidity consideration
    if (orderBookAnalysis.liquidityScore > 70) orderBook += 20;
    else if (orderBookAnalysis.liquidityScore < 30) orderBook -= 20;

    // Trade score
    let trades = 0;
    if (tradeStats.buyRatio > 60) trades = 50;
    else if (tradeStats.buyRatio > 55) trades = 25;
    else if (tradeStats.buyRatio < 40) trades = -50;
    else if (tradeStats.buyRatio < 45) trades = -25;

    // Overall sentiment score (weighted average)
    const sentimentScore = Math.round(
      (priceAction * 0.4 + volume * 0.2 + orderBook * 0.2 + trades * 0.2)
    );

    // Determine overall sentiment
    let overallSentiment: MarketSentiment['overallSentiment'] = 'neutral';
    if (sentimentScore > 60) overallSentiment = 'extremely_bullish';
    else if (sentimentScore > 30) overallSentiment = 'bullish';
    else if (sentimentScore < -60) overallSentiment = 'extremely_bearish';
    else if (sentimentScore < -30) overallSentiment = 'bearish';

    // Generate recommendation
    let recommendation = '';
    switch (overallSentiment) {
      case 'extremely_bullish':
        recommendation = 'Strong buy signal. Consider entering long positions.';
        break;
      case 'bullish':
        recommendation = 'Bullish sentiment. Good for long positions with proper risk management.';
        break;
      case 'neutral':
        recommendation = 'Mixed signals. Wait for clearer direction or trade range.';
        break;
      case 'bearish':
        recommendation = 'Bearish sentiment. Consider short positions or avoid longs.';
        break;
      case 'extremely_bearish':
        recommendation = 'Strong sell signal. Avoid long positions or consider shorts.';
        break;
    }

    return {
      symbol,
      overallSentiment,
      sentimentScore,
      indicators: {
        priceAction,
        volume,
        orderBook,
        trades
      },
      recommendation
    };
  }

  // Comprehensive Market Overview
  async getCompleteMarketOverview(symbol: string): Promise<{
    marketStats: MarketStats;
    orderBookAnalysis: OrderBookAnalysis;
    tradeStats: TradeStats;
    chartAnalysis: ChartAnalysis;
    sentiment: MarketSentiment;
  }> {
    const [marketStats, orderBookAnalysis, tradeStats, chartAnalysis, sentiment] =
      await Promise.all([
        this.getMarketStats(symbol),
        this.getOrderBookAnalysis(symbol),
        this.getTradeStats(symbol),
        this.getChartAnalysis(symbol),
        this.getMarketSentiment(symbol)
      ]);

    return {
      marketStats,
      orderBookAnalysis,
      tradeStats,
      chartAnalysis,
      sentiment
    };
  }

  // Utility Functions
  private async getUSDTPrice(symbol: string): Promise<number> {
    try {
      if (symbol.includes('USDT') || symbol.includes('USDT')) return 1;

      const baseAsset = symbol.split('/')[0];

      // Try direct USDT pair first
      try {
        const ticker = await this.exchange.fetchTicker(`${baseAsset}/USDT`);
        return ticker.last || ticker.close || 0;
      } catch {
        // Fallback to USDT
        try {
          const ticker = await this.exchange.fetchTicker(`${baseAsset}/USDT`);
          return ticker.last || ticker.close || 0;
        } catch {
          // Fallback through BTC
          const btcTicker = await this.exchange.fetchTicker(`${baseAsset}/BTC`);
          const btcUSDTTicker = await this.exchange.fetchTicker('BTC/USDT');
          return (btcTicker.last || 0) * (btcUSDTTicker.last || 0);
        }
      }
    } catch (error) {
      console.warn(`Could not get USDT price for ${symbol}:`, error);
      return 0;
    }
  }

  async searchMarkets(query: string): Promise<string[]> {
    const markets = await this.exchange.fetchMarkets();
    return markets
      .map(market => market?.symbol || '')
      .filter(symbol =>
        symbol.toLowerCase().includes(query.toLowerCase()) &&
        (symbol.includes('/USDT') || symbol.includes('/USDT'))
      )
      .slice(0, 20);
  }

  // Advanced Technical Indicators
  async getTechnicalIndicators(symbol: string, timeframe: string = '1h'): Promise<TechnicalIndicators> {
    const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, 100);
    const closes = ohlcv.map(candle => Number(candle[4]));
    const highs = ohlcv.map(candle => Number(candle[2]));
    const lows = ohlcv.map(candle => Number(candle[3]));

    // RSI Calculation
    const rsi = this.calculateRSI(closes, 14);
    const currentRSI = rsi[rsi.length - 1];

    // MACD Calculation
    const ema12 = this.calculateEMA(closes, 12);
    const ema26 = this.calculateEMA(closes, 26);
    const macdLine = ema12.map((val, i) => val - ema26[i]);
    const signalLine = this.calculateEMA(macdLine, 9);
    const histogram = macdLine.map((val, i) => val - signalLine[i]);

    const macd = {
      macd: macdLine[macdLine.length - 1],
      signal: signalLine[signalLine.length - 1],
      histogram: histogram[histogram.length - 1],
      trend: histogram[histogram.length - 1] > histogram[histogram.length - 2] ? 'bullish' : 'bearish' as 'bullish' | 'bearish' | 'neutral'
    };

    // Bollinger Bands
    const sma20 = this.calculateSMA(closes, 20);
    const stdDev = this.calculateStandardDeviation(closes.slice(-20));
    const currentSMA = sma20[sma20.length - 1];
    const currentPrice = closes[closes.length - 1];

    const bollingerBands = {
      upper: currentSMA + (2 * stdDev),
      middle: currentSMA,
      lower: currentSMA - (2 * stdDev),
      position: currentPrice > currentSMA + (1.5 * stdDev) ? 'overbought' :
                currentPrice < currentSMA - (1.5 * stdDev) ? 'oversold' : 'neutral' as 'overbought' | 'oversold' | 'neutral',
      squeeze: (currentSMA + (2 * stdDev)) - (currentSMA - (2 * stdDev)) < currentSMA * 0.1
    };

    // Moving Averages
    const sma50 = this.calculateSMA(closes, 50);
    const movingAverages = {
      sma20: currentSMA,
      sma50: sma50[sma50.length - 1],
      ema12: ema12[ema12.length - 1],
      ema26: ema26[ema26.length - 1],
      trend: currentSMA > sma50[sma50.length - 1] ? 'bullish' : 'bearish' as 'bullish' | 'bearish' | 'neutral'
    };

    // Support and Resistance
    const support = this.findSupportLevels(lows, closes);
    const resistance = this.findResistanceLevels(highs, closes);

    return {
      symbol,
      timeframe,
      rsi: currentRSI,
      macd,
      bollingerBands,
      movingAverages,
      support,
      resistance
    };
  }

  // Volume Analysis
  async getVolumeAnalysis(symbol: string): Promise<VolumeAnalysis> {
    const ohlcv = await this.exchange.fetchOHLCV(symbol, '1h', undefined, 100);
    const trades = await this.exchange.fetchTrades(symbol, undefined, 200);

    // Volume Profile
    const priceVolumes = new Map<number, number>();
    const priceStep = 0.01; // Adjust based on asset price

    for (const candle of ohlcv) {
      const price = Math.round(Number(candle[4]) / priceStep) * priceStep;
      const volume = Number(candle[5]);
      priceVolumes.set(price, (priceVolumes.get(price) || 0) + volume);
    }

    const totalVolume = Array.from(priceVolumes.values()).reduce((sum, vol) => sum + vol, 0);
    const volumeProfile = Array.from(priceVolumes.entries())
      .map(([price, volume]) => ({
        price,
        volume,
        percentage: (volume / totalVolume) * 100
      }))
      .sort((a, b) => b.volume - a.volume)
      .slice(0, 20);

    // Volume Trend
    const volumes = ohlcv.map(candle => Number(candle[5]));
    const volumeMA = volumes.reduce((sum, vol) => sum + vol, 0) / volumes.length;
    const recentVolumes = volumes.slice(-10);
    const earlierVolumes = volumes.slice(-20, -10);
    const recentAvg = recentVolumes.reduce((sum, vol) => sum + vol, 0) / recentVolumes.length;
    const earlierAvg = earlierVolumes.reduce((sum, vol) => sum + vol, 0) / earlierVolumes.length;

    let volumeTrend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    if (recentAvg > earlierAvg * 1.1) volumeTrend = 'increasing';
    else if (recentAvg < earlierAvg * 0.9) volumeTrend = 'decreasing';

    // Whale Activity Detection
    const avgTradeSize = trades.reduce((sum, trade) => sum + (trade.amount || 0), 0) / trades.length;
    const largeTrades = trades.filter(trade => (trade.amount || 0) > avgTradeSize * 5);
    const whaleActivity = {
      detected: largeTrades.length > trades.length * 0.05,
      orderSize: largeTrades.length > 0 ? Math.max(...largeTrades.map(t => t.amount || 0)) : 0,
      frequency: largeTrades.length / trades.length
    };

    return {
      symbol,
      volumeProfile,
      volumeTrend,
      volumeMA,
      currentVsAverage: (volumes[volumes.length - 1] / volumeMA) * 100,
      largeOrdersDetected: largeTrades.length > 0,
      whaleActivity
    };
  }

  // Market Depth Analysis
  async getMarketDepthAnalysis(symbol: string): Promise<MarketDepthAnalysis> {
    const orderBook = await this.exchange.fetchOrderBook(symbol, 100);

    // Calculate depth imbalance
    const totalBidVolume = orderBook.bids.reduce((sum, [, amount]) => sum + Number(amount || 0), 0);
    const totalAskVolume = orderBook.asks.reduce((sum, [, amount]) => sum + Number(amount || 0), 0);
    const depthImbalance = (totalBidVolume - totalAskVolume) / (totalBidVolume + totalAskVolume) * 100;

    // Find significant levels
    const bidsByLevel = new Map<number, number>();
    const asksByLevel = new Map<number, number>();

    orderBook.bids.forEach(([price, amount]) => {
      const level = Math.round(Number(price || 0) * 100) / 100;
      bidsByLevel.set(level, (bidsByLevel.get(level) || 0) + Number(amount || 0));
    });

    orderBook.asks.forEach(([price, amount]) => {
      const level = Math.round(Number(price || 0) * 100) / 100;
      asksByLevel.set(level, (asksByLevel.get(level) || 0) + Number(amount || 0));
    });

    // Support and Resistance levels
    const supportLevels = Array.from(bidsByLevel.entries())
      .map(([price, volume]) => ({ price, strength: volume }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);

    const resistanceLevels = Array.from(asksByLevel.entries())
      .map(([price, volume]) => ({ price, strength: volume }))
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5);

    // Wall Analysis
    const avgBidSize = totalBidVolume / orderBook.bids.length;
    const avgAskSize = totalAskVolume / orderBook.asks.length;

    const buyWalls = orderBook.bids
      .filter(([, amount]) => Number(amount || 0) > avgBidSize * 3)
      .map(([price, amount]) => ({ price: Number(price || 0), size: Number(amount || 0) }))
      .slice(0, 10);

    const sellWalls = orderBook.asks
      .filter(([, amount]) => Number(amount || 0) > avgAskSize * 3)
      .map(([price, amount]) => ({ price: Number(price || 0), size: Number(amount || 0) }))
      .slice(0, 10);

    // Liquidity Heatmap
    const liquidityHeatmap = [
      ...orderBook.bids.map(([price, amount]) => ({
        priceLevel: Number(price || 0),
        liquidityScore: Number(amount || 0),
        side: 'buy' as const
      })),
      ...orderBook.asks.map(([price, amount]) => ({
        priceLevel: Number(price || 0),
        liquidityScore: Number(amount || 0),
        side: 'sell' as const
      }))
    ].sort((a, b) => b.liquidityScore - a.liquidityScore).slice(0, 50);

    return {
      symbol,
      depthImbalance,
      supportLevels,
      resistanceLevels,
      wallAnalysis: { buyWalls, sellWalls },
      liquidityHeatmap
    };
  }

  // Funding and Fees
  async getFundingAndFees(symbol: string): Promise<FundingAndFees> {
    try {
      // Get trading fees
      const tradingFee = await this.exchange.fetchTradingFee(symbol);

      // Try to get funding rate for futures/perpetuals
      let fundingRate;
      let fundingHistory;
      try {
        const fundingRateData = await this.exchange.fetchFundingRate(symbol);
        fundingRate = fundingRateData.fundingRate;

        const fundingHistoryData = await this.exchange.fetchFundingRateHistory(symbol, undefined, 24);
        fundingHistory = fundingHistoryData.map(rate => ({
          timestamp: rate.timestamp || 0,
          rate: rate.fundingRate || 0
        }));
      } catch {
        // Not a futures contract
      }

      return {
        symbol,
        fundingRate,
        fundingHistory,
        tradingFees: {
          maker: tradingFee.maker || 0,
          taker: tradingFee.taker || 0
        }
      };
    } catch (error) {
      return {
        symbol,
        tradingFees: { maker: 0.001, taker: 0.001 } // Default values
      };
    }
  }

  // Market Correlation Analysis
  async getMarketCorrelation(symbol: string): Promise<MarketCorrelation> {
    const timeframe = '1d';
    const limit = 30;

    // Get price data for the target symbol
    const targetOHLCV = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);
    const targetPrices = targetOHLCV.map(candle => Number(candle[4]));

    // Get price data for major assets
    const correlationAssets = ['BTC/USDT', 'ETH/USDT', 'BNB/USDT', 'ADA/USDT', 'SOL/USDT'];
    const correlatedAssets = [];

    for (const asset of correlationAssets) {
      if (asset === symbol) continue;

      try {
        const assetOHLCV = await this.exchange.fetchOHLCV(asset, timeframe, undefined, limit);
        const assetPrices = assetOHLCV.map(candle => Number(candle[4]));

        if (assetPrices.length === targetPrices.length) {
          const correlation = this.calculateCorrelation(targetPrices, assetPrices);
          let strength: 'strong' | 'moderate' | 'weak' = 'weak';

          if (Math.abs(correlation) > 0.7) strength = 'strong';
          else if (Math.abs(correlation) > 0.4) strength = 'moderate';

          correlatedAssets.push({
            symbol: asset,
            correlation,
            strength
          });
        }
      } catch (error) {
        console.warn(`Could not get correlation data for ${asset}:`, error);
      }
    }

    // Calculate BTC and ETH correlations
    const btcCorrelation = correlatedAssets.find(a => a.symbol === 'BTC/USDT')?.correlation || 0;
    const ethCorrelation = correlatedAssets.find(a => a.symbol === 'ETH/USDT')?.correlation || 0;

    // Calculate beta (volatility relative to BTC)
    let marketBeta = 1;
    if (btcCorrelation !== 0) {
      const targetReturns = this.calculateReturns(targetPrices);
      const btcPrices = correlatedAssets.find(a => a.symbol === 'BTC/USDT');
      if (btcPrices) {
        try {
          const btcOHLCV = await this.exchange.fetchOHLCV('BTC/USDT', timeframe, undefined, limit);
          const btcPriceData = btcOHLCV.map(candle => Number(candle[4]));
          const btcReturns = this.calculateReturns(btcPriceData);
          marketBeta = this.calculateBeta(targetReturns, btcReturns);
        } catch (error) {
          console.warn('Could not calculate beta:', error);
        }
      }
    }

    return {
      symbol,
      correlatedAssets: correlatedAssets.sort((a, b) => Math.abs(b.correlation) - Math.abs(a.correlation)),
      btcCorrelation,
      ethCorrelation,
      marketBeta
    };
  }

  // News and Events Analysis
  async getNewsAndEvents(symbol: string): Promise<NewsAndEvents> {
    const baseAsset = symbol.split('/')[0];
    const cacheKey = `news_${baseAsset}`;

    // Check cache first
    const cached = this.getFromCache<NewsAndEvents>(cacheKey);
    if (cached) {
      return {
        ...cached,
        cacheInfo: {
          cached: true,
          cacheTime: cached.cacheInfo?.cacheTime,
          nextRefresh: Date.now() + this.CACHE_DURATION
        }
      };
    }

    const [cryptoPanicNews, tavilyAnalysis] = await Promise.allSettled([
      this.fetchCryptoPanicNews(baseAsset),
      this.fetchTavilyAnalysis(baseAsset)
    ]).then(results => [
      results[0].status === 'fulfilled' ? results[0].value : [],
      results[1].status === 'fulfilled' ? results[1].value : []
    ]);

    // Just format the raw data without analysis - ensure cryptoPanicNews is properly typed
    const recentNews = (cryptoPanicNews as any[]).map((news: any) => ({
      id: news.id || '',
      headline: news.title || '',
      summary: news.summary || '',
      source: news.source?.title || 'Unknown',
      timestamp: news.published_at ? new Date(news.published_at).getTime() : Date.now(),
      url: news.url || '',
      votes: news.votes || { positive: 0, negative: 0, important: 0 },
      rawData: news // Store original response for LLM analysis
    }));

    // Process Tavily market analysis - keep full content
    const marketAnalysis = (tavilyAnalysis as any[]).map((item: any) => ({
      headline: item.title || '',
      content: item.content || '', // Full content, not truncated
      source: item.url ? new URL(item.url).hostname : 'Unknown',
      timestamp: item.published_date ? new Date(item.published_date).getTime() : Date.now(),
      relevanceScore: item.score || 0,
      url: item.url || '',
      rawData: item // Store original response for LLM analysis
    }));

    // Simple upcoming events extraction
    const upcomingEvents = this.extractBasicEvents([...recentNews, ...marketAnalysis]);

    const result: NewsAndEvents = {
      symbol,
      upcomingEvents,
      recentNews,
      marketAnalysis,
      totalMentions: recentNews.length + marketAnalysis.length,
      cacheInfo: {
        cached: false,
        cacheTime: Date.now(),
        nextRefresh: Date.now() + this.CACHE_DURATION
      }
    };

    // Cache the result
    this.setCache(cacheKey, result);

    return result;
  }

  private async fetchCryptoPanicNews(asset: string): Promise<CryptoPanicResponse['results']> {
    if (!this.cryptoPanicApiKey) {
      console.warn('CryptoPanic API key not provided');
      return [];
    }

    try {
      const response = await fetch(
        `https://cryptopanic.com/api/v1/posts/?auth_token=${this.cryptoPanicApiKey}&currencies=${asset}&filter=hot&limit=20`
      );

      if (!response.ok) {
        if (response.status === 429) {
          console.warn(`⚠️ CryptoPanic API rate limited (429). Using cached data or skipping news for ${asset}.`);
          return [];
        }
        throw new Error(`CryptoPanic API error: ${response.status}`);
      }

      const data = await response.json() as CryptoPanicResponse;
      return data.results;
    } catch (error) {
      console.error('Error fetching CryptoPanic news:', error);
      return [];
    }
  }

  private async fetchTavilyAnalysis(asset: string): Promise<TavilyResponse['results']> {
    if (!this.tavilyApiKey) {
      console.warn('Tavily API key not provided');
      return [];
    }

    try {
      const query = `${asset} cryptocurrency price analysis trading signals market outlook`;

      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.tavilyApiKey}`
        },
        body: JSON.stringify({
          query,
          search_depth: 'advanced',
          max_results: 10,
          include_domains: [
            'coindesk.com',
            'cointelegraph.com',
            'decrypt.co',
            'bloomberg.com',
            'reuters.com',
            'tradingview.com',
            'coinbase.com',
            'binance.com'
          ],
          exclude_domains: ['reddit.com', 'twitter.com'], // Exclude social media for now
          include_answer: false,
          include_raw_content: true
        })
      });

      if (!response.ok) {
        throw new Error(`Tavily API error: ${response.status}`);
      }

      const data = await response.json() as TavilyResponse;
      return data.results;
    } catch (error) {
      console.error('Error fetching Tavily analysis:', error);
      return [];
    }
  }

  private extractBasicEvents(items: any[]): NewsAndEvents['upcomingEvents'] {
    const events: NewsAndEvents['upcomingEvents'] = [];
    const eventKeywords = [
      'launch', 'release', 'update', 'upgrade', 'fork', 'conference', 'meeting',
      'announcement', 'earnings', 'listing', 'partnership', 'integration'
    ];

    // Extract potential events from headlines
    items.forEach(item => {
      const headline = item.headline || item.title || '';
      const lowerHeadline = headline.toLowerCase();

      eventKeywords.forEach(keyword => {
        if (lowerHeadline.includes(keyword)) {
          // Simple date extraction
          const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{4}|\d{4}-\d{2}-\d{2}|january|february|march|april|may|june|july|august|september|october|november|december)/i;
          const dateMatch = headline.match(dateRegex);

          events.push({
            date: dateMatch ? dateMatch[0] : 'TBD',
            event: headline.substring(0, 100),
            impact: lowerHeadline.includes('major') || lowerHeadline.includes('important') ? 'high' : 'medium',
            source: item.source || 'Unknown'
          });
        }
      });
    });

    return events.slice(0, 10); // Limit to 10 most relevant events
  }

  // Cache Management
  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() > entry.expiry) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  private setCache<T>(key: string, data: T): void {
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiry: Date.now() + this.CACHE_DURATION
    };
    this.cache.set(key, entry);

    // Clean up expired entries occasionally
    if (this.cache.size > 100) {
      this.cleanupCache();
    }
  }

  private cleanupCache(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiry) {
        this.cache.delete(key);
      }
    }
  }

  // Ultra Comprehensive Market Analysis
  async getMarketOverviewSummary(symbol: string): Promise<{
    symbol: string;
    price: number;
    change24h: number;
    changePercent24h: number;
    volume24hUSDT: number;
    sentiment: string;
    technicalSignal: string;
    rsi: number;
    trend: string;
    support: number;
    resistance: number;
    recommendation: string;
  }> {
    try {
      const results = await Promise.allSettled([
        this.getMarketStats(symbol),
        this.getMarketSentiment(symbol),
        this.getTechnicalIndicators(symbol, '1h')
      ]);

      const marketStats = results[0].status === 'fulfilled' ? results[0].value as any : null;
      const sentiment = results[1].status === 'fulfilled' ? results[1].value as any : null;
      const technicalIndicators = results[2].status === 'fulfilled' ? results[2].value as any : null;

      const rsi = technicalIndicators?.rsi || 50;
      const macdSignal = technicalIndicators?.macd?.signal || 'neutral';

      // Simple technical signal
      let technicalSignal = 'neutral';
      if (rsi < 30 && macdSignal === 'bullish') technicalSignal = 'bullish';
      else if (rsi > 70 && macdSignal === 'bearish') technicalSignal = 'bearish';
      else if (rsi < 40) technicalSignal = 'oversold';
      else if (rsi > 60) technicalSignal = 'overbought';

      // Simple recommendation
      let recommendation = 'hold';
      if (technicalSignal === 'bullish' && sentiment?.sentiment === 'bullish') recommendation = 'buy';
      else if (technicalSignal === 'bearish' && sentiment?.sentiment === 'bearish') recommendation = 'sell';

      return {
        symbol,
        price: marketStats?.currentPrice || 0,
        change24h: marketStats?.change24h || 0,
        changePercent24h: marketStats?.changePercent24h || 0,
        volume24hUSDT: marketStats?.volumeUSDT24h || 0,
        sentiment: sentiment?.sentiment || 'neutral',
        technicalSignal,
        rsi,
        trend: marketStats?.changePercent24h > 0 ? 'up' : 'down',
        support: technicalIndicators?.support || marketStats?.low24h || 0,
        resistance: technicalIndicators?.resistance || marketStats?.high24h || 0,
        recommendation
      };
    } catch (error) {
      console.error(`Error getting market overview for ${symbol}:`, error);
      return {
        symbol,
        price: 0,
        change24h: 0,
        changePercent24h: 0,
        volume24hUSDT: 0,
        sentiment: 'neutral',
        technicalSignal: 'neutral',
        rsi: 50,
        trend: 'neutral',
        support: 0,
        resistance: 0,
        recommendation: 'hold'
      };
    }
  }

  // Helper Methods for Calculations
  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
  }

  private calculateSMA(prices: number[], period: number): number[] {
    const sma = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }
    return sma;
  }

  private calculateRSI(prices: number[], period: number): number[] {
    const gains: number[] = [];
    const losses: number[] = [];

    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? Math.abs(change) : 0);
    }

    const rsi: number[] = [];
    for (let i = period - 1; i < gains.length; i++) {
      const avgGain = gains.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;
      const avgLoss = losses.slice(i - period + 1, i + 1).reduce((a, b) => a + b) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - (100 / (1 + rs)));
      }
    }

    return rsi;
  }

  private calculateStandardDeviation(prices: number[]): number {
    const mean = prices.reduce((sum, price) => sum + price, 0) / prices.length;
    const variance = prices.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) / prices.length;
    return Math.sqrt(variance);
  }

  private findSupportLevels(lows: number[], closes: number[]): number[] {
    const supports = [];
    const currentPrice = closes[closes.length - 1];

    // Find local minimums
    for (let i = 2; i < lows.length - 2; i++) {
      if (lows[i] < lows[i - 1] && lows[i] < lows[i + 1] &&
          lows[i] < lows[i - 2] && lows[i] < lows[i + 2]) {
        if (lows[i] < currentPrice) {
          supports.push(lows[i]);
        }
      }
    }

    return supports.sort((a, b) => b - a).slice(0, 3);
  }

  private findResistanceLevels(highs: number[], closes: number[]): number[] {
    const resistance = [];
    const currentPrice = closes[closes.length - 1];

    // Find local maximums
    for (let i = 2; i < highs.length - 2; i++) {
      if (highs[i] > highs[i - 1] && highs[i] > highs[i + 1] &&
          highs[i] > highs[i - 2] && highs[i] > highs[i + 2]) {
        if (highs[i] > currentPrice) {
          resistance.push(highs[i]);
        }
      }
    }

    return resistance.sort((a, b) => a - b).slice(0, 3);
  }

  private calculateCorrelation(x: number[], y: number[]): number {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateReturns(prices: number[]): number[] {
    const returns = [];
    for (let i = 1; i < prices.length; i++) {
      returns.push((prices[i] - prices[i - 1]) / prices[i - 1]);
    }
    return returns;
  }

  private calculateBeta(assetReturns: number[], marketReturns: number[]): number {
    const covariance = this.calculateCovariance(assetReturns, marketReturns);
    const marketVariance = this.calculateVariance(marketReturns);
    return marketVariance === 0 ? 1 : covariance / marketVariance;
  }

  private calculateCovariance(x: number[], y: number[]): number {
    const meanX = x.reduce((a, b) => a + b, 0) / x.length;
    const meanY = y.reduce((a, b) => a + b, 0) / y.length;
    return x.reduce((sum, xi, i) => sum + (xi - meanX) * (y[i] - meanY), 0) / x.length;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) / values.length;
  }

  // Chart Data Analysis
  async getChartData(symbol: string, timeframe: string, limit: number = 100): Promise<any> {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, timeframe, undefined, limit);

      // Format the data for better readability
      const chartData = ohlcv.map((candle, index) => ({
        timestamp: candle[0],
        datetime: new Date(candle[0]!).toISOString(),
        open: Number(candle[1]),
        high: Number(candle[2]),
        low: Number(candle[3]),
        close: Number(candle[4]),
        volume: Number(candle[5]),
        index: ohlcv.length - index // Most recent = 1, oldest = limit
      })).reverse(); // Most recent first

      // Calculate basic statistics
      const prices = chartData.map(c => c.close);
      const volumes = chartData.map(c => c.volume);
      const high24h = Math.max(...prices);
      const low24h = Math.min(...prices);
      const priceChange = ((chartData[0].close - chartData[chartData.length - 1].close) / chartData[chartData.length - 1].close) * 100;

      return {
        symbol,
        timeframe,
        candleCount: chartData.length,
        data: chartData,
        summary: {
          currentPrice: chartData[0].close,
          high24h,
          low24h,
          priceChange: parseFloat(priceChange.toFixed(2)),
          avgVolume: volumes.reduce((a, b) => a + b, 0) / volumes.length,
          totalVolume: volumes.reduce((a, b) => a + b, 0)
        }
      };
    } catch (error) {
      return {
        error: `Failed to fetch chart data: ${(error as Error).message}`,
        symbol,
        timeframe
      };
    }
  }
}