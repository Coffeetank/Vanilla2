import ccxt, { binance } from 'ccxt';

export interface MarginConfig {
  apiKey: string;
  secret: string;
  sandbox?: boolean;
  marginMode?: 'cross' | 'isolated';
}

export interface OrderOptions {
  takeProfit?: number;
  stopLoss?: number;
  leverage?: number;
  marginMode?: 'cross' | 'isolated';
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  postOnly?: boolean;
  reduceOnly?: boolean;
}

export interface OCOOrderOptions {
  stopPrice: number;
  stopLimitPrice?: number;
  limitPrice: number;
  marginMode?: 'cross' | 'isolated';
}

export interface PositionInfo {
  symbol: string;
  side: string;
  size: number;
  notional: number;
  entryPrice: number;
  markPrice: number;
  pnl: number;
  pnlPercentage: number;
  marginMode: string;
  notionalUSDC?: number;
  unrealizedPnlUSDC?: number;
}

export interface ExitPlan {
  symbol: string;
  targetPrice: number;
  stopPrice: number;
  invalidationConditions?: InvalidationCondition[];
  currentPrice: number;
  targetPnl: number;
  stopPnl: number;
  riskRewardRatio: number;
}

export interface InvalidationCondition {
  type: 'price_below' | 'price_above' | 'macd_decrease' | 'rsi_below' | 'rsi_above' | 'volume_spike' | 'custom';
  description: string;
  parameters: any;
}

export class BinanceMarginTrader {
  private exchange: binance;
  private defaultMarginMode: 'cross' | 'isolated';

  constructor(config: MarginConfig) {
    this.exchange = new ccxt.binance({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.sandbox || false,
      options: {
        defaultType: 'margin',
        defaultMarginMode: config.marginMode || 'cross'
      }
    });
    this.defaultMarginMode = config.marginMode || 'cross';
  }

  // Account & Balance Management
  async getBalance(marginMode?: 'cross' | 'isolated', symbols?: string[]): Promise<any> {
    return await this.exchange.fetchBalance({
      marginMode: marginMode || this.defaultMarginMode,
      symbols: symbols
    });
  }

  async getAvailableUSDC(): Promise<{
    total: number;
    free: number;
    used: number;
    borrowed: number;
    interest: number;
    netAvailable: number;
  }> {
    const balance = await this.getBalance();
    const usdcBalance = balance['USDC'] || balance['USDT'] || { total: 0, free: 0, used: 0 };

    // Get USDC/USDT asset info for borrowed amounts
    const usdcInfo = balance.info?.userAssets?.['USDC'] || balance.info?.userAssets?.['USDT'] || {};

    return {
      total: usdcBalance.total || 0,
      free: usdcBalance.free || 0,
      used: usdcBalance.used || 0,
      borrowed: parseFloat(usdcInfo.borrowed || '0'),
      interest: parseFloat(usdcInfo.interest || '0'),
      netAvailable: (usdcBalance.free || 0) - parseFloat(usdcInfo.borrowed || '0') - parseFloat(usdcInfo.interest || '0')
    };
  }


  // Order Management Functions
  async createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const params = this.buildOrderParams(options);
    return await this.exchange.createOrder(symbol, 'market', side, amount, undefined, params);
  }

  async createLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const params = this.buildOrderParams(options);
    return await this.exchange.createOrder(symbol, 'limit', side, amount, price, params);
  }

  async createStopLimitOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price: number,
    stopPrice: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const params = {
      ...this.buildOrderParams(options),
      triggerPrice: stopPrice
    };
    return await this.exchange.createOrder(symbol, 'STOP_LOSS_LIMIT', side, amount, price, params);
  }

  async createStopMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    stopPrice: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const params = {
      ...this.buildOrderParams(options),
      triggerPrice: stopPrice
    };
    return await this.exchange.createOrder(symbol, 'STOP_LOSS', side, amount, undefined, params);
  }

  async createTrailingStopOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    trailingPercent: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const params = {
      ...this.buildOrderParams(options),
      trailingPercent: trailingPercent
    };
    return await this.exchange.createOrder(symbol, 'TRAILING_STOP_MARKET', side, amount, undefined, params);
  }

  async createOCOOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    ocoOptions: OCOOrderOptions
  ): Promise<any> {
    // OCO orders need to be created using Binance's specific API
    // We'll create two separate orders: a limit order and a stop-limit order
    try {
      const marginMode = ocoOptions.marginMode || this.defaultMarginMode;

      // Use Binance's raw API for OCO orders
      const ocoParams: any = {
        symbol: symbol.replace('/', ''),
        side: side.toUpperCase(),
        quantity: amount.toString(),
        price: ocoOptions.limitPrice.toString(),
        stopPrice: ocoOptions.stopPrice.toString(),
        isIsolated: marginMode === 'isolated' ? 'TRUE' : 'FALSE'
      };

      if (ocoOptions.stopLimitPrice) {
        ocoParams.stopLimitPrice = ocoOptions.stopLimitPrice.toString();
        ocoParams.stopLimitTimeInForce = 'GTC';
      }

      // Use the exchange's private API to create OCO order
      const response = await (this.exchange as any).marginPostOrder({
        ...ocoParams,
        type: 'OCO'
      });

      return response;
    } catch (error) {
      // Fallback: create two separate orders manually
      console.warn('OCO order failed, creating separate orders:', error);

      const limitOrder = await this.createLimitOrder(symbol, side, amount, ocoOptions.limitPrice, {
        marginMode: ocoOptions.marginMode
      });

      const stopOrder = await this.createStopLimitOrder(
        symbol,
        side,
        amount,
        ocoOptions.stopLimitPrice || ocoOptions.stopPrice,
        ocoOptions.stopPrice,
        { marginMode: ocoOptions.marginMode }
      );

      return {
        type: 'manual_oco',
        limitOrder,
        stopOrder,
        warning: 'Created as separate orders due to API limitations'
      };
    }
  }

  async cancelOrder(orderId: string, symbol: string): Promise<any> {
    return await this.exchange.cancelOrder(orderId, symbol, {
      marginMode: this.defaultMarginMode
    });
  }

  async cancelAllOrders(symbol: string, marginMode?: 'cross' | 'isolated'): Promise<any> {
    return await this.exchange.cancelAllOrders(symbol, {
      marginMode: marginMode || this.defaultMarginMode
    });
  }

  async getOpenOrders(symbol?: string): Promise<any> {
    return await this.exchange.fetchOpenOrders(symbol, undefined, undefined, {
      marginMode: this.defaultMarginMode
    });
  }

  async getOrderHistory(symbol: string, limit: number = 50): Promise<any> {
    return await this.exchange.fetchOrders(symbol, undefined, limit, {
      marginMode: this.defaultMarginMode
    });
  }

  async getOrderStatus(orderId: string, symbol: string): Promise<any> {
    return await this.exchange.fetchOrder(orderId, symbol, {
      marginMode: this.defaultMarginMode
    });
  }

  // Position Management
  async getCurrentPositions(): Promise<PositionInfo[]> {
    const balance = await this.getBalance();
    const positions: PositionInfo[] = [];

    for (const [asset, assetData] of Object.entries(balance.info.userAssets || {})) {
      const positionData = assetData as any;
      const netAsset = parseFloat(positionData.netAsset || '0');

      if (netAsset !== 0) {
        // Get recent trades to calculate average entry price
        const entryPrice = await this.calculateAverageEntryPrice(asset);
        const markPrice = await this.getCurrentPrice(asset);

        // Get USDC price for conversions
        const usdcPrice = await this.getUSDCPrice(asset);
        const notionalUSDC = Math.abs(netAsset) * markPrice * usdcPrice;
        const unrealizedPnlUSDC = this.calculatePnL(netAsset, entryPrice, markPrice) * usdcPrice;

        const position: PositionInfo = {
          symbol: asset,
          side: netAsset > 0 ? 'long' : 'short',
          size: Math.abs(netAsset),
          notional: Math.abs(netAsset) * markPrice,
          entryPrice: entryPrice,
          markPrice: markPrice,
          pnl: this.calculatePnL(netAsset, entryPrice, markPrice),
          pnlPercentage: this.calculatePnLPercentage(netAsset, entryPrice, markPrice),
          marginMode: this.defaultMarginMode,
          notionalUSDC: notionalUSDC,
          unrealizedPnlUSDC: unrealizedPnlUSDC,
        };

        positions.push(position);
      }
    }

    return positions;
  }

  private async calculateAverageEntryPrice(asset: string): Promise<number> {
    try {
      // Get recent trades for this asset to calculate average entry price
      const trades = await this.exchange.fetchMyTrades(asset, undefined, 50, {
        marginMode: this.defaultMarginMode
      });

      if (trades.length === 0) return 0;

      let totalCost = 0;
      let totalAmount = 0;
      let currentPosition = 0;

      // Calculate weighted average entry price
      for (const trade of trades.reverse()) { // Start from oldest
        const amount = (trade.amount || 0) * (trade.side === 'buy' ? 1 : -1);
        const cost = trade.cost || 0;
        const prevPosition = currentPosition;
        currentPosition += amount;

        // If position crosses zero, reset calculation
        if ((prevPosition > 0 && currentPosition < 0) || (prevPosition < 0 && currentPosition > 0)) {
          totalCost = cost * (trade.side === 'buy' ? 1 : -1);
          totalAmount = amount;
        } else {
          totalCost += cost * (trade.side === 'buy' ? 1 : -1);
          totalAmount += amount;
        }
      }

      return totalAmount !== 0 ? Math.abs(totalCost / totalAmount) : 0;
    } catch (error) {
      console.warn(`Could not calculate entry price for ${asset}:`, error);
      return 0;
    }
  }

  private async getCurrentPrice(asset: string): Promise<number> {
    try {
      // Try to get current ticker price
      const ticker = await this.exchange.fetchTicker(asset);
      return ticker.last || ticker.close || 0;
    } catch (error) {
      console.warn(`Could not get current price for ${asset}:`, error);
      return 0;
    }
  }

  private async getUSDCPrice(asset: string): Promise<number> {
    try {
      if (asset === 'USDC' || asset === 'USDT') return 1;

      // Try direct USDC pair first
      try {
        const ticker = await this.exchange.fetchTicker(`${asset}/USDC`);
        return ticker.last || ticker.close || 0;
      } catch {
        // Fallback to USDT pair
        try {
          const ticker = await this.exchange.fetchTicker(`${asset}/USDT`);
          return ticker.last || ticker.close || 0;
        } catch {
          // Fallback through BTC
          const assetBtc = await this.exchange.fetchTicker(`${asset}/BTC`);
          const btcUsdc = await this.exchange.fetchTicker('BTC/USDC');
          return (assetBtc.last || 0) * (btcUsdc.last || 0);
        }
      }
    } catch (error) {
      console.warn(`Could not get USDC price for ${asset}:`, error);
      return 0;
    }
  }

  private calculatePnL(netAsset: number, entryPrice: number, markPrice: number): number {
    if (entryPrice === 0 || markPrice === 0) return 0;

    const pnl = netAsset * (markPrice - entryPrice);
    return pnl;
  }

  private calculatePnLPercentage(netAsset: number, entryPrice: number, markPrice: number): number {
    if (entryPrice === 0) return 0;

    const side = netAsset > 0 ? 1 : -1;
    const pnlPercentage = side * ((markPrice - entryPrice) / entryPrice) * 100;
    return pnlPercentage;
  }

  async closePosition(symbol: string): Promise<any> {
    const balance = await this.getBalance();
    const baseAsset = symbol.split('/')[0];
    const position = balance[baseAsset];

    if (!position || position.total === 0) {
      throw new Error(`No position found for ${symbol}`);
    }

    const side = position.total > 0 ? 'sell' : 'buy';
    const amount = Math.abs(position.total);

    return await this.createMarketOrder(symbol, side, amount, { reduceOnly: true });
  }

  async closeAllPositions(): Promise<any[]> {
    const positions = await this.getCurrentPositions();
    const results = [];

    for (const position of positions) {
      try {
        const result = await this.closePosition(position.symbol);
        results.push(result);
      } catch (error) {
        console.error(`Failed to close position for ${position.symbol}:`, error);
        results.push({ error: (error as Error).message, symbol: position.symbol });
      }
    }

    return results;
  }

  // Margin & Leverage Functions
  async borrowMargin(asset: string, amount: number, symbol?: string): Promise<any> {
    if (this.defaultMarginMode === 'isolated' && !symbol) {
      throw new Error('Symbol required for isolated margin borrowing');
    }

    if (this.defaultMarginMode === 'cross') {
      return await this.exchange.borrowCrossMargin(asset, amount);
    } else {
      return await this.exchange.borrowIsolatedMargin(symbol!, asset, amount);
    }
  }

  async repayMargin(asset: string, amount: number, symbol?: string): Promise<any> {
    if (this.defaultMarginMode === 'isolated' && !symbol) {
      throw new Error('Symbol required for isolated margin repayment');
    }

    if (this.defaultMarginMode === 'cross') {
      return await this.exchange.repayCrossMargin(asset, amount);
    } else {
      return await this.exchange.repayIsolatedMargin(symbol!, asset, amount);
    }
  }

  async getBorrowHistory(asset?: string, symbol?: string): Promise<any> {
    return await this.exchange.fetchBorrowInterest(asset, symbol);
  }

  async getMaxBorrowable(asset: string, symbol?: string): Promise<any> {
    try {
      const balance = await this.getBalance();
      const marginLevel = await this.getMarginLevel();

      if (this.defaultMarginMode === 'isolated' && symbol) {
        // For isolated margin, calculate max borrowable for specific pair
        const pairData = balance.info.userAssets?.[symbol];
        if (!pairData) {
          return { asset, maxBorrowable: 0, error: 'Trading pair not found' };
        }

        // Get current collateral value
        const collateralValue = parseFloat(pairData.netAsset || '0') * parseFloat(pairData.indexPrice || '1');

        // Isolated margin typically allows 3:1 leverage (varies by pair)
        const maxLeverage = 3; // This should be fetched from exchange info
        const maxBorrowable = Math.max(0, (collateralValue * maxLeverage) - collateralValue);

        return {
          asset,
          symbol,
          marginMode: 'isolated',
          collateralValue,
          maxBorrowable,
          currentlyBorrowed: parseFloat(pairData.borrowed || '0'),
          availableToBorrow: Math.max(0, maxBorrowable - parseFloat(pairData.borrowed || '0'))
        };
      } else {
        // For cross margin, calculate based on total account equity
        const totalNetAsset = parseFloat(balance.info.totalNetAssetOfBtc || '0');
        const totalLiability = parseFloat(balance.info.totalLiabilityOfBtc || '0');

        // Cross margin typically allows up to 3:1 leverage, but depends on margin level
        const safeMarginLevel = 1.5; // Keep above liquidation threshold
        const currentMarginLevel = marginLevel.marginLevel || 1;

        if (currentMarginLevel <= safeMarginLevel) {
          return {
            asset,
            marginMode: 'cross',
            maxBorrowable: 0,
            reason: 'Margin level too low for additional borrowing',
            currentMarginLevel,
            safeMarginLevel
          };
        }

        // Calculate max additional borrowing to maintain safe margin level
        const maxTotalLiability = totalNetAsset / safeMarginLevel;
        const maxAdditionalBorrow = Math.max(0, maxTotalLiability - totalLiability);

        // Get asset price to convert from BTC terms
        const assetPrice = await this.getCurrentPrice(`${asset}/USDC`);
        const btcPrice = await this.getCurrentPrice('BTC/USDC');
        const assetInBtc = assetPrice / btcPrice;

        return {
          asset,
          marginMode: 'cross',
          totalNetAssetBtc: totalNetAsset,
          totalLiabilityBtc: totalLiability,
          currentMarginLevel,
          maxAdditionalBorrowBtc: maxAdditionalBorrow,
          maxAdditionalBorrowAsset: maxAdditionalBorrow / assetInBtc,
          assetPriceInBtc: assetInBtc
        };
      }
    } catch (error) {
      return {
        asset,
        symbol,
        error: (error as Error).message,
        maxBorrowable: 0
      };
    }
  }


  // Liability Management Functions
  async getCurrentLiabilities(): Promise<any> {
    const balance = await this.getBalance();
    const liabilities: any = {};

    if (this.defaultMarginMode === 'cross') {
      // For cross margin, get all borrowed assets
      for (const [asset, assetInfo] of Object.entries(balance.info.userAssets || {})) {
        const info = assetInfo as any;
        if (info.borrowed && parseFloat(info.borrowed) > 0) {
          liabilities[asset] = {
            borrowed: parseFloat(info.borrowed),
            interest: parseFloat(info.interest || '0'),
            total: parseFloat(info.borrowed) + parseFloat(info.interest || '0')
          };
        }
      }
    } else {
      // For isolated margin, liabilities are per symbol
      liabilities.isolated = balance.info.userAssets || {};
    }

    return liabilities;
  }

  async getTotalLiabilityValue(): Promise<number> {
    const balance = await this.getBalance();
    return parseFloat(balance.info.totalLiabilityOfBtc || '0');
  }

  async getLiabilityForAsset(asset: string, symbol?: string): Promise<any> {
    const balance = await this.getBalance();

    if (this.defaultMarginMode === 'isolated' && symbol) {
      // Get liability for specific isolated margin pair
      const pairInfo = balance.info.userAssets?.[symbol];
      return {
        asset,
        symbol,
        borrowed: parseFloat(pairInfo?.borrowed || '0'),
        interest: parseFloat(pairInfo?.interest || '0'),
        total: parseFloat(pairInfo?.borrowed || '0') + parseFloat(pairInfo?.interest || '0')
      };
    } else {
      // Get liability for cross margin asset
      const assetInfo = balance.info.userAssets?.[asset];
      return {
        asset,
        borrowed: parseFloat(assetInfo?.borrowed || '0'),
        interest: parseFloat(assetInfo?.interest || '0'),
        total: parseFloat(assetInfo?.borrowed || '0') + parseFloat(assetInfo?.interest || '0')
      };
    }
  }

  async repayAllLiabilities(): Promise<any[]> {
    const liabilities = await this.getCurrentLiabilities();
    const results = [];

    for (const [asset, liability] of Object.entries(liabilities)) {
      const liabilityInfo = liability as any;
      if (liabilityInfo.total > 0) {
        try {
          const result = await this.repayMargin(asset, liabilityInfo.total);
          results.push({ asset, amount: liabilityInfo.total, result });
        } catch (error) {
          results.push({ asset, error: (error as Error).message });
        }
      }
    }

    return results;
  }

  async autoRepayLiabilities(threshold: number = 0.8): Promise<any[]> {
    const marginLevel = await this.getMarginLevel();
    const results = [];

    // If margin level is below threshold, auto repay some liabilities
    if (marginLevel.marginLevel < threshold) {
      const liabilities = await this.getCurrentLiabilities();

      // Sort liabilities by amount (repay largest first)
      const sortedLiabilities = Object.entries(liabilities).sort(
        ([, a], [, b]) => (b as any).total - (a as any).total
      );

      for (const [asset, liability] of sortedLiabilities) {
        const liabilityInfo = liability as any;
        if (liabilityInfo.total > 0) {
          try {
            // Repay 50% of the liability
            const repayAmount = liabilityInfo.total * 0.5;
            const result = await this.repayMargin(asset, repayAmount);
            results.push({ asset, amount: repayAmount, result });

            // Check if margin level improved enough
            const newMarginLevel = await this.getMarginLevel();
            if (newMarginLevel.marginLevel > threshold) {
              break;
            }
          } catch (error) {
            results.push({ asset, error: (error as Error).message });
          }
        }
      }
    }

    return results;
  }

  async getLiquidationRisk(): Promise<any> {
    const marginLevel = await this.getMarginLevel();
    const liabilities = await this.getCurrentLiabilities();

    return {
      marginLevel: marginLevel.marginLevel,
      totalLiability: marginLevel.totalLiabilityOfBtc,
      totalAsset: marginLevel.totalAssetOfBtc,
      riskLevel: this.calculateRiskLevel(marginLevel.marginLevel),
      liabilities,
      recommendation: this.getLiquidationRecommendation(marginLevel.marginLevel)
    };
  }

  private calculateRiskLevel(marginLevel: number): string {
    if (marginLevel >= 3.0) return 'LOW';
    if (marginLevel >= 2.0) return 'MEDIUM';
    if (marginLevel >= 1.5) return 'HIGH';
    if (marginLevel >= 1.1) return 'CRITICAL';
    return 'LIQUIDATION_IMMINENT';
  }

  private getLiquidationRecommendation(marginLevel: number): string {
    if (marginLevel >= 3.0) return 'Safe to continue trading';
    if (marginLevel >= 2.0) return 'Consider reducing position size';
    if (marginLevel >= 1.5) return 'Reduce positions or add collateral';
    if (marginLevel >= 1.1) return 'URGENT: Close positions or repay loans immediately';
    return 'CRITICAL: Account will be liquidated soon';
  }

  // Utility Functions
  private buildOrderParams(options: OrderOptions): any {
    const params: any = {
      marginMode: options.marginMode || this.defaultMarginMode
    };

    if (options.takeProfit) {
      params.takeProfitPrice = options.takeProfit;
    }

    if (options.stopLoss) {
      params.stopLossPrice = options.stopLoss;
    }

    if (options.timeInForce) {
      params.timeInForce = options.timeInForce;
    }

    if (options.postOnly) {
      params.postOnly = options.postOnly;
    }

    if (options.reduceOnly) {
      params.reduceOnly = options.reduceOnly;
    }

    return params;
  }

  async getMarketData(symbol: string): Promise<any> {
    return {
      ticker: await this.exchange.fetchTicker(symbol),
      orderBook: await this.exchange.fetchOrderBook(symbol),
      trades: await this.exchange.fetchTrades(symbol)
    };
  }

  async getTradingFees(symbol?: string): Promise<any> {
    if (symbol) {
      return await this.exchange.fetchTradingFee(symbol);
    }
    return await this.exchange.fetchTradingFees();
  }

  async getMarginLevel(): Promise<any> {
    const balance = await this.getBalance();
    return {
      marginLevel: balance.info.marginLevel || 0,
      totalAssetOfBtc: balance.info.totalAssetOfBtc || 0,
      totalLiabilityOfBtc: balance.info.totalLiabilityOfBtc || 0,
      totalNetAssetOfBtc: balance.info.totalNetAssetOfBtc || 0
    };
  }

  // Advanced Trading Functions
  async createOrderWithTPSL(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    price?: number,
    takeProfit?: number,
    stopLoss?: number,
    orderType: string = 'limit'
  ): Promise<any> {
    const mainOrder = await this.exchange.createOrder(
      symbol,
      orderType,
      side,
      amount,
      price,
      {
        marginMode: this.defaultMarginMode,
        takeProfitPrice: takeProfit,
        stopLossPrice: stopLoss
      }
    );

    return mainOrder;
  }

  async scaledEntry(
    symbol: string,
    side: 'buy' | 'sell',
    totalAmount: number,
    entryPrices: number[],
    amounts?: number[]
  ): Promise<any[]> {
    const orders = [];
    const defaultAmountPerOrder = totalAmount / entryPrices.length;

    for (let i = 0; i < entryPrices.length; i++) {
      const amount = amounts ? amounts[i] : defaultAmountPerOrder;
      const order = await this.createLimitOrder(symbol, side, amount, entryPrices[i]);
      orders.push(order);
    }

    return orders;
  }

  async scaledExit(
    symbol: string,
    side: 'buy' | 'sell',
    totalAmount: number,
    exitPrices: number[],
    amounts?: number[]
  ): Promise<any[]> {
    const orders = [];
    const defaultAmountPerOrder = totalAmount / exitPrices.length;

    for (let i = 0; i < exitPrices.length; i++) {
      const amount = amounts ? amounts[i] : defaultAmountPerOrder;
      const order = await this.createLimitOrder(symbol, side, amount, exitPrices[i], {
        reduceOnly: true
      });
      orders.push(order);
    }

    return orders;
  }

  // Exit Plan Management
  async createExitPlan(
    symbol: string,
    targetPrice: number,
    stopPrice: number,
    invalidationConditions?: InvalidationCondition[]
  ): Promise<ExitPlan> {
    const positions = await this.getCurrentPositions();
    const position = positions.find(p => p.symbol === symbol);

    if (!position) {
      throw new Error(`No position found for ${symbol}`);
    }

    const currentPrice = position.markPrice;
    const entryPrice = position.entryPrice;

    // Calculate potential P&L in USDC
    const usdcPrice = await this.getUSDCPrice(symbol);
    const targetPnl = position.size * (targetPrice - entryPrice) * (position.side === 'long' ? 1 : -1) * usdcPrice;
    const stopPnl = position.size * (stopPrice - entryPrice) * (position.side === 'long' ? 1 : -1) * usdcPrice;

    // Calculate risk-reward ratio
    const riskAmount = Math.abs(entryPrice - stopPrice);
    const rewardAmount = Math.abs(targetPrice - entryPrice);
    const riskRewardRatio = rewardAmount / riskAmount;

    return {
      symbol,
      targetPrice,
      stopPrice,
      invalidationConditions: invalidationConditions || [],
      currentPrice,
      targetPnl,
      stopPnl,
      riskRewardRatio
    };
  }

  async executeExitPlan(exitPlan: ExitPlan): Promise<any> {
    // Create OCO order for target and stop
    const positions = await this.getCurrentPositions();
    const position = positions.find(p => p.symbol === exitPlan.symbol);

    if (!position) {
      throw new Error(`No position found for ${exitPlan.symbol}`);
    }

    const side = position.side === 'long' ? 'sell' : 'buy';

    return await this.createOCOOrder(exitPlan.symbol, side, position.size, {
      limitPrice: exitPlan.targetPrice,
      stopPrice: exitPlan.stopPrice,
      marginMode: this.defaultMarginMode
    });
  }

  async checkInvalidationConditions(exitPlan: ExitPlan): Promise<{
    shouldInvalidate: boolean;
    triggeredConditions: InvalidationCondition[];
    recommendation: string;
  }> {
    const triggeredConditions: InvalidationCondition[] = [];

    for (const condition of exitPlan.invalidationConditions || []) {
      const isTriggered = await this.evaluateCondition(exitPlan.symbol, condition);
      if (isTriggered) {
        triggeredConditions.push(condition);
      }
    }

    const shouldInvalidate = triggeredConditions.length > 0;

    return {
      shouldInvalidate,
      triggeredConditions,
      recommendation: shouldInvalidate
        ? 'CLOSE POSITION IMMEDIATELY - Invalidation conditions met'
        : 'Continue with exit plan'
    };
  }

  private async evaluateCondition(symbol: string, condition: InvalidationCondition): Promise<boolean> {
    try {
      const currentPrice = await this.getCurrentPrice(symbol);

      switch (condition.type) {
        case 'price_below':
          return currentPrice < condition.parameters.price;

        case 'price_above':
          return currentPrice > condition.parameters.price;

        case 'macd_decrease':
          return await this.checkMACDDecrease(symbol, condition.parameters);

        case 'rsi_below':
          return await this.checkRSI(symbol, '<', condition.parameters.level);

        case 'rsi_above':
          return await this.checkRSI(symbol, '>', condition.parameters.level);

        default:
          console.warn(`Unknown condition type: ${condition.type}`);
          return false;
      }
    } catch (error) {
      console.error(`Error evaluating condition for ${symbol}:`, error);
      return false;
    }
  }

  private async checkMACDDecrease(symbol: string, params: any): Promise<boolean> {
    try {
      // Get 4h OHLCV data for MACD calculation
      const ohlcv = await this.exchange.fetchOHLCV(symbol, '4h', undefined, 50);

      if (ohlcv.length < 26) return false;

      // Simple MACD calculation
      const closes = ohlcv.map(candle => Number(candle[4]));
      const ema12 = this.calculateEMA(closes, 12);
      const ema26 = this.calculateEMA(closes, 26);
      const macdLine = ema12.map((val, i) => val - ema26[i]);
      const signalLine = this.calculateEMA(macdLine, 9);
      const histogram = macdLine.map((val, i) => val - signalLine[i]);

      // Check if histogram decreased for consecutive bars
      const barsToCheck = params.consecutiveBars || 2;
      const recentHistogram = histogram.slice(-barsToCheck);

      for (let i = 1; i < recentHistogram.length; i++) {
        if (recentHistogram[i] >= recentHistogram[i - 1]) {
          return false;
        }
      }

      return true;
    } catch (error) {
      console.warn(`Could not check MACD for ${symbol}:`, error);
      return false;
    }
  }

  private async checkRSI(symbol: string, operator: '<' | '>', level: number): Promise<boolean> {
    try {
      const ohlcv = await this.exchange.fetchOHLCV(symbol, '4h', undefined, 15);
      const closes = ohlcv.map(candle => Number(candle[4]));
      const rsi = this.calculateRSI(closes, 14);
      const currentRSI = rsi[rsi.length - 1];

      return operator === '<' ? currentRSI < level : currentRSI > level;
    } catch (error) {
      console.warn(`Could not check RSI for ${symbol}:`, error);
      return false;
    }
  }

  private calculateEMA(prices: number[], period: number): number[] {
    const k = 2 / (period + 1);
    const ema = [prices[0]];

    for (let i = 1; i < prices.length; i++) {
      ema.push(prices[i] * k + ema[i - 1] * (1 - k));
    }

    return ema;
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

  // Convenience method to create a complete exit plan like your example
  async createDetailedExitPlan(
    symbol: string,
    targetPrice: number,
    stopPrice: number,
    invalidationPrice?: number,
    macdConsecutiveBars: number = 2
  ): Promise<ExitPlan> {
    const invalidationConditions: InvalidationCondition[] = [];

    if (invalidationPrice) {
      invalidationConditions.push({
        type: 'price_below',
        description: `Close early if 4h candle closes below ${invalidationPrice}`,
        parameters: { price: invalidationPrice }
      });

      invalidationConditions.push({
        type: 'macd_decrease',
        description: `Close early if 4h MACD histogram decreases for ${macdConsecutiveBars} consecutive bars`,
        parameters: { consecutiveBars: macdConsecutiveBars }
      });
    }

    return await this.createExitPlan(symbol, targetPrice, stopPrice, invalidationConditions);
  }

  // Enhanced Order and Plan Management
  async getCompleteOrderStatus(): Promise<{
    openOrders: any[];
    recentOrders: any[];
    positions: PositionInfo[];
    totalOrderCount: number;
    pendingValue: number;
  }> {
    const openOrders = await this.getOpenOrders();
    const positions = await this.getCurrentPositions();

    // Get recent orders for all symbols that have positions
    const recentOrders = [];
    const symbolsWithPositions = [...new Set(positions.map(p => p.symbol))];

    for (const symbol of symbolsWithPositions) {
      try {
        const orders = await this.getOrderHistory(symbol, 20);
        recentOrders.push(...orders);
      } catch (error) {
        console.warn(`Could not get orders for ${symbol}:`, error);
      }
    }

    // Calculate pending value in USDC
    let pendingValue = 0;
    for (const order of openOrders) {
      if (order.status === 'open' && order.remaining) {
        const usdcPrice = await this.getUSDCPrice(order.symbol);
        pendingValue += order.remaining * (order.price || 0) * usdcPrice;
      }
    }

    return {
      openOrders,
      recentOrders: recentOrders.slice(0, 50), // Limit to 50 most recent
      positions,
      totalOrderCount: openOrders.length,
      pendingValue
    };
  }

  async getOrdersByType(): Promise<{
    limitOrders: any[];
    stopOrders: any[];
    marketOrders: any[];
    ocoOrders: any[];
  }> {
    const openOrders = await this.getOpenOrders();

    return {
      limitOrders: openOrders.filter((order: any) => order.type === 'limit'),
      stopOrders: openOrders.filter((order: any) =>
        order.type?.includes('stop') || order.type?.includes('STOP')
      ),
      marketOrders: openOrders.filter((order: any) => order.type === 'market'),
      ocoOrders: openOrders.filter((order: any) => order.type === 'OCO')
    };
  }

  async cancelOrdersBySymbol(symbol: string, orderType?: string): Promise<any[]> {
    const openOrders = await this.getOpenOrders(symbol);
    const results = [];

    for (const order of openOrders) {
      if (!orderType || order.type === orderType) {
        try {
          const result = await this.cancelOrder(order.id, symbol);
          results.push({ orderId: order.id, status: 'cancelled', result });
        } catch (error) {
          results.push({
            orderId: order.id,
            status: 'failed',
            error: (error as Error).message
          });
        }
      }
    }

    return results;
  }

  async modifyOrder(
    orderId: string,
    symbol: string,
    newPrice?: number,
    newAmount?: number
  ): Promise<any> {
    // Get current order details
    const currentOrder = await this.getOrderStatus(orderId, symbol);

    if (!currentOrder) {
      throw new Error(`Order ${orderId} not found`);
    }

    // Cancel the existing order
    await this.cancelOrder(orderId, symbol);

    // Create new order with modified parameters
    const side = currentOrder.side;
    const amount = newAmount || currentOrder.amount;
    const price = newPrice || currentOrder.price;
    const type = currentOrder.type;

    if (type === 'limit') {
      return await this.createLimitOrder(symbol, side, amount, price);
    } else if (type === 'market') {
      return await this.createMarketOrder(symbol, side, amount);
    } else {
      throw new Error(`Cannot modify order type: ${type}`);
    }
  }

  async getPositionSummary(): Promise<{
    totalPositions: number;
    totalNotionalUSDC: number;
    totalUnrealizedPnlUSDC: number;
    longPositions: PositionInfo[];
    shortPositions: PositionInfo[];
    biggestWinner: PositionInfo | null;
    biggestLoser: PositionInfo | null;
  }> {
    const positions = await this.getCurrentPositions();

    const longPositions = positions.filter(p => p.side === 'long');
    const shortPositions = positions.filter(p => p.side === 'short');

    const totalNotionalUSDC = positions.reduce((sum, p) => sum + (p.notionalUSDC || 0), 0);
    const totalUnrealizedPnlUSDC = positions.reduce((sum, p) => sum + (p.unrealizedPnlUSDC || 0), 0);

    // Find biggest winner and loser by unrealized PnL
    let biggestWinner: PositionInfo | null = null;
    let biggestLoser: PositionInfo | null = null;

    for (const position of positions) {
      const pnl = position.unrealizedPnlUSDC || 0;

      if (!biggestWinner || pnl > (biggestWinner.unrealizedPnlUSDC || 0)) {
        biggestWinner = position;
      }

      if (!biggestLoser || pnl < (biggestLoser.unrealizedPnlUSDC || 0)) {
        biggestLoser = position;
      }
    }

    return {
      totalPositions: positions.length,
      totalNotionalUSDC,
      totalUnrealizedPnlUSDC,
      longPositions,
      shortPositions,
      biggestWinner,
      biggestLoser
    };
  }

  async getAccountOverview(): Promise<{
    availableUSDC: any;
    positions: PositionInfo[];
    openOrders: any[];
    liabilities: any;
    marginLevel: any;
    liquidationRisk: any;
    summary: {
      totalEquityUSDC: number;
      totalPositionValueUSDC: number;
      totalUnrealizedPnlUSDC: number;
      freeMarginUSDC: number;
      marginUtilization: number;
    };
  }> {
    // Get all account data
    const [availableUSDC, positions, openOrders, liabilities, marginLevel, liquidationRisk] =
      await Promise.all([
        this.getAvailableUSDC(),
        this.getCurrentPositions(),
        this.getOpenOrders(),
        this.getCurrentLiabilities(),
        this.getMarginLevel(),
        this.getLiquidationRisk()
      ]);

    // Calculate summary
    const totalPositionValueUSDC = positions.reduce((sum, p) => sum + (p.notionalUSDC || 0), 0);
    const totalUnrealizedPnlUSDC = positions.reduce((sum, p) => sum + (p.unrealizedPnlUSDC || 0), 0);
    const totalEquityUSDC = availableUSDC.netAvailable + totalPositionValueUSDC + totalUnrealizedPnlUSDC;
    const freeMarginUSDC = availableUSDC.free;
    const marginUtilization = totalPositionValueUSDC / (totalEquityUSDC || 1) * 100;

    return {
      availableUSDC,
      positions,
      openOrders,
      liabilities,
      marginLevel,
      liquidationRisk,
      summary: {
        totalEquityUSDC,
        totalPositionValueUSDC,
        totalUnrealizedPnlUSDC,
        freeMarginUSDC,
        marginUtilization
      }
    };
  }

  // Exit Plan Storage and Management (in-memory for now)
  private exitPlans: Map<string, ExitPlan> = new Map();

  async saveExitPlan(plan: ExitPlan): Promise<void> {
    this.exitPlans.set(plan.symbol, plan);
  }

  async getExitPlan(symbol: string): Promise<ExitPlan | undefined> {
    return this.exitPlans.get(symbol);
  }

  async getAllExitPlans(): Promise<ExitPlan[]> {
    return Array.from(this.exitPlans.values());
  }

  async removeExitPlan(symbol: string): Promise<boolean> {
    return this.exitPlans.delete(symbol);
  }

  async checkAllExitPlans(): Promise<{
    symbol: string;
    plan: ExitPlan;
    invalidationCheck: any;
    recommendation: string;
  }[]> {
    const results = [];

    for (const [symbol, plan] of this.exitPlans) {
      try {
        const invalidationCheck = await this.checkInvalidationConditions(plan);
        results.push({
          symbol,
          plan,
          invalidationCheck,
          recommendation: invalidationCheck.recommendation
        });
      } catch (error) {
        results.push({
          symbol,
          plan,
          invalidationCheck: { error: (error as Error).message },
          recommendation: 'Error checking plan'
        });
      }
    }

    return results;
  }
}