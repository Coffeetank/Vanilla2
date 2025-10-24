import ccxt, { binance } from 'ccxt';
import crypto from 'crypto';

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
  notionalUSDT?: number;
  unrealizedPnlUSDT?: number;
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
  private apiKey: string;
  private apiSecret: string;
  private baseUrl: string;

  constructor(config: MarginConfig) {
    this.exchange = new ccxt.binance({
      apiKey: config.apiKey,
      secret: config.secret,
      sandbox: config.sandbox || false,
      options: {
        defaultType: 'margin',
        defaultMarginMode: config.marginMode || 'cross',
        warnOnFetchOpenOrdersWithoutSymbol: false
      }
    });
    this.defaultMarginMode = config.marginMode || 'cross';
    this.apiKey = config.apiKey;
    this.apiSecret = config.secret;
    this.baseUrl = config.sandbox ? 'https://testnet.binance.vision' : 'https://api.binance.com';
  }

  /**
   * Sign a request with HMAC-SHA256 signature for Binance API
   */
  private signRequest(params: Record<string, any>): string {
    const queryString = Object.entries(params)
      .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
      .join('&');

    const signature = crypto
      .createHmac('sha256', this.apiSecret)
      .update(queryString)
      .digest('hex');

    return `${queryString}&signature=${signature}`;
  }

  /**
   * Make a signed POST request to Binance API
   */
  private async makeSignedRequest(endpoint: string, params: Record<string, any>): Promise<any> {
    const signedParams = this.signRequest(params);
    const url = `${this.baseUrl}${endpoint}?${signedParams}`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'X-MBX-APIKEY': this.apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });

    if (!response.ok) {
      const errorData = await response.text();
      throw new Error(`Binance API error: ${response.status} ${response.statusText} - ${errorData}`);
    }

    return await response.json();
  }

  /**
   * Round number to specified decimal places
   */
  private roundToDecimals(value: number, decimals: number): number {
    const multiplier = Math.pow(10, decimals);
    return Math.round(value * multiplier) / multiplier;
  }

  /**
   * Strip trailing zeros and decimal point from a number string
   */
  private stripTrailingZeros(numStr: string): string {
    if (!numStr || !numStr.includes('.')) return numStr;
    // Remove trailing zeros but keep at least one digit after decimal if needed
    let result = numStr.replace(/0+$/, '');
    if (result.endsWith('.')) {
      result = result.slice(0, -1);
    }
    // If result becomes empty or just a decimal, return the original
    if (!result || result === '.') return numStr;
    return result;
  }

  /**
   * Format quantity and price values to match Binance precision requirements
   */
  private async formatOrderValues(symbol: string, quantity: number, price?: number): Promise<{
    quantity: string;
    price?: string;
  }> {
    try {
      const markets = await this.exchange.loadMarkets();
      const market = markets[symbol];

      if (!market) {
        // Fallback to reasonable defaults
        return {
          quantity: this.stripTrailingZeros(quantity.toFixed(6)),
          price: price ? this.stripTrailingZeros(price.toFixed(2)) : undefined
        };
      }

      // Get precision from market limits
      const amountPrecision = market.precision?.amount || 8;
      const pricePrecision = market.precision?.price || 2;

      return {
        quantity: this.stripTrailingZeros(this.roundToDecimals(quantity, amountPrecision).toFixed(amountPrecision)),
        price: price ? this.stripTrailingZeros(this.roundToDecimals(price, pricePrecision).toFixed(pricePrecision)) : undefined
      };
    } catch (error) {
      console.warn(`Could not get market precision for ${symbol}, using defaults`);
      return {
        quantity: this.stripTrailingZeros(quantity.toFixed(6)),
        price: price ? this.stripTrailingZeros(price.toFixed(2)) : undefined
      };
    }
  }

  // Account & Balance Management
  async getBalance(marginMode?: 'cross' | 'isolated', symbols?: string[]): Promise<any> {
    return await this.exchange.fetchBalance({
      marginMode: marginMode || this.defaultMarginMode,
      symbols: symbols
    });
  }

  async getAvailableUSDT(): Promise<{
    total: number;
    free: number;
    used: number;
    borrowed: number;
    interest: number;
    netAvailable: number;
  }> {
    const balance = await this.getBalance();
    // Use USDT as the primary stablecoin
    const usdtBalance = balance['USDT'] || { total: 0, free: 0, used: 0 };

    // Get USDT asset info for borrowed amounts
    const usdtInfo = balance.info?.userAssets?.['USDT'] || {};

    return {
      total: usdtBalance.total || 0,
      free: usdtBalance.free || 0,
      used: usdtBalance.used || 0,
      borrowed: parseFloat(usdtInfo.borrowed || '0'),
      interest: parseFloat(usdtInfo.interest || '0'),
      netAvailable: (usdtBalance.free || 0) - parseFloat(usdtInfo.borrowed || '0') - parseFloat(usdtInfo.interest || '0')
    };
  }


  // Order Management Functions
  async createMarketOrder(
    symbol: string,
    side: 'buy' | 'sell',
    amount: number,
    options: OrderOptions = {}
  ): Promise<any> {
    // If leverage is specified, handle borrowing first
    if (options.leverage && options.leverage > 1) {
      return await this.createLeveragedOrder(symbol, 'market', side, amount, undefined, options);
    }

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
    // For margin trading, use STOP_LOSS_LIMIT with a limit price that executes immediately
    // Set limit price 5% away from stop to ensure execution
    const limitPriceOffset = side === 'sell' ? 0.95 : 1.05;
    const limitPrice = stopPrice * limitPriceOffset;

    const params = {
      ...this.buildOrderParams(options),
      stopPrice: stopPrice,
    };

    return await this.exchange.createOrder(symbol, 'STOP_LOSS_LIMIT', side, amount, limitPrice, params);
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
    try {
      console.log(`📋 Creating native Binance OCO order for ${symbol}`);
      console.log(`   Take-profit: ${ocoOptions.limitPrice}, Stop-loss trigger: ${ocoOptions.stopPrice}`);

      // Format values to correct precision
      console.log(`🔍 Input values: amount=${amount}, limitPrice=${ocoOptions.limitPrice}, stopPrice=${ocoOptions.stopPrice}`);

      const formatted = await this.formatOrderValues(symbol, amount, ocoOptions.limitPrice);
      const formattedStopPrice = (await this.formatOrderValues(symbol, 1, ocoOptions.stopPrice)).price; // Use 1 instead of 0 for price formatting

      console.log(`🔍 Formatted values: quantity=${formatted.quantity}, price=${formatted.price}, stopPrice=${formattedStopPrice}`);

      // Binance margin OCO requires stopLimitPrice (cannot use stop-market)
      // If not provided, set it slightly worse than stopPrice to ensure execution
      let stopLimitPrice = ocoOptions.stopLimitPrice;
      if (!stopLimitPrice) {
        // For SELL: stopLimitPrice should be slightly below stopPrice (worse price for seller)
        // For BUY: stopLimitPrice should be slightly above stopPrice (worse price for buyer)
        const offset = side === 'sell' ? 0.99 : 1.01; // 1% worse than stop trigger
        stopLimitPrice = ocoOptions.stopPrice * offset;
        console.log(`   Auto-calculated stop-limit price: ${stopLimitPrice} (${offset > 1 ? 'above' : 'below'} stop trigger)`);
      }
      const formattedStopLimit = (await this.formatOrderValues(symbol, 1, stopLimitPrice)).price; // Use 1 for price formatting

      // Prepare parameters for Binance margin OCO API
      const params: Record<string, any> = {
        symbol: symbol.replace('/', ''), // BTC/USDT -> BTCUSDT
        side: side.toUpperCase(), // BUY or SELL
        quantity: formatted.quantity,
        price: formatted.price, // Take-profit limit price
        stopPrice: formattedStopPrice, // Stop-loss trigger price
        stopLimitPrice: formattedStopLimit, // Stop-loss limit price (required for margin OCO)
        stopLimitTimeInForce: 'GTC',
        sideEffectType: 'NO_SIDE_EFFECT', // We already borrowed when opening the position
        isIsolated: (ocoOptions.marginMode || this.defaultMarginMode) === 'isolated' ? 'TRUE' : 'FALSE',
        timestamp: Date.now()
      };

      console.log(`🔍 OCO params:`, {
        symbol: params.symbol,
        side: params.side,
        quantity: params.quantity,
        price: params.price,
        stopPrice: params.stopPrice,
        stopLimitPrice: params.stopLimitPrice
      });

      // Validate that all required parameters are present and valid
      if (!params.quantity || !params.price || !params.stopPrice || !params.stopLimitPrice) {
        throw new Error(`Missing required OCO parameters: ${JSON.stringify({
          quantity: params.quantity,
          price: params.price,
          stopPrice: params.stopPrice,
          stopLimitPrice: params.stopLimitPrice
        })}`);
      }

      // Call Binance's native margin OCO endpoint
      const response = await this.makeSignedRequest('/sapi/v1/margin/order/oco', params);

      console.log(`✅ OCO order created successfully!`);
      console.log(`   Order List ID: ${response.orderListId}`);
      console.log(`   Orders: ${response.orders?.length || 0} orders placed atomically`);

      return {
        type: 'native_oco',
        orderListId: response.orderListId,
        contingencyType: response.contingencyType,
        listStatusType: response.listStatusType,
        listOrderStatus: response.listOrderStatus,
        orders: response.orders,
        orderReports: response.orderReports,
        symbol,
        side,
        amount,
        takeProfitPrice: ocoOptions.limitPrice,
        stopLossPrice: ocoOptions.stopPrice,
        message: `✅ OCO order placed successfully with ${response.orders?.length || 0} legs`
      };
    } catch (error) {
      console.error('❌ Failed to create native OCO order:', error);

      // Fallback to separate orders if OCO fails
      console.log('⚠️ Falling back to separate stop-loss and take-profit orders...');

      const marginMode = ocoOptions.marginMode || this.defaultMarginMode;

      try {
        // Create stop-loss order first (more important)
        const stopLossOrder = await this.createStopMarketOrder(symbol, side, amount, ocoOptions.stopPrice, {
          marginMode,
          reduceOnly: true
        });
        console.log(`✅ Stop-loss order placed at ${ocoOptions.stopPrice}`);

        // Create take-profit limit order
        const takeProfitOrder = await this.createLimitOrder(symbol, side, amount, ocoOptions.limitPrice, {
          marginMode,
          reduceOnly: true
        });
        console.log(`✅ Take-profit order placed at ${ocoOptions.limitPrice}`);

        return {
          type: 'separate_orders',
          stopLossOrder,
          takeProfitOrder,
          message: 'Created stop-loss and take-profit as separate orders (fallback method)',
          originalError: (error as Error).message
        };
      } catch (fallbackError) {
        console.error('❌ Fallback also failed:', fallbackError);
        throw new Error(`Failed to create protective orders: ${(fallbackError as Error).message}. Original OCO error: ${(error as Error).message}`);
      }
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

    for (const [_id, assetData] of Object.entries(balance.info.userAssets || {})) {
      const positionData = assetData as any;
      const asset = positionData.asset; // Get the actual asset symbol from the data
      const netAsset = parseFloat(positionData.netAsset || '0');

      // Skip if no position
      if (netAsset === 0) continue;

      // Skip if no valid asset symbol
      if (!asset || asset.length < 2) {
        continue;
      }

      // Skip common quote/stable assets that aren't traded positions
      if (['USDT', 'USDC', 'BUSD', 'USD'].includes(asset)) {
        continue;
      }

      try {
        // Construct proper trading symbol
        const symbol = asset.includes('/') ? asset : `${asset}/USDT`;
        const [, quoteAsset] = symbol.split('/');

        // Get recent trades to calculate average entry price
        const entryPrice = await this.calculateAverageEntryPrice(symbol);
        const markPrice = await this.getCurrentPrice(symbol);

        // Calculate notional and P&L in quote currency
        const notional = Math.abs(netAsset) * markPrice;
        const pnl = this.calculatePnL(netAsset, entryPrice, markPrice);

        // Convert to USDT if quote currency is not USDT
        let notionalUSDT: number;
        let unrealizedPnlUSDT: number;

        if (quoteAsset === 'USDT') {
          // Already in USDT, no conversion needed
          notionalUSDT = notional;
          unrealizedPnlUSDT = pnl;
        } else {
          // Need to convert from quote currency to USDT
          const USDTPrice = await this.getUSDTPrice(quoteAsset);
          notionalUSDT = notional * USDTPrice;
          unrealizedPnlUSDT = pnl * USDTPrice;
        }

        const position: PositionInfo = {
          symbol: symbol,
          side: netAsset > 0 ? 'long' : 'short',
          size: Math.abs(netAsset),
          notional: notional,
          entryPrice: entryPrice,
          markPrice: markPrice,
          pnl: pnl,
          pnlPercentage: this.calculatePnLPercentage(netAsset, entryPrice, markPrice),
          marginMode: this.defaultMarginMode,
          notionalUSDT: notionalUSDT,
          unrealizedPnlUSDT: unrealizedPnlUSDT,
        };

        positions.push(position);
      } catch (error) {
        console.warn(`Skipping asset ${asset} due to error:`, (error as Error).message);
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

  private async getUSDTPrice(asset: string): Promise<number> {
    try {
      if (asset === 'USDT' || asset === 'USDC' || asset === 'BUSD') return 1;

      // Try direct USDT pair first
      try {
        const ticker = await this.exchange.fetchTicker(`${asset}/USDT`);
        return ticker.last || ticker.close || 0;
      } catch {
        // Fallback through BTC
        const assetBtc = await this.exchange.fetchTicker(`${asset}/BTC`);
        const btcUSDT = await this.exchange.fetchTicker('BTC/USDT');
        return (assetBtc.last || 0) * (btcUSDT.last || 0);
      }
    } catch (error) {
      console.warn(`Could not get USDT price for ${asset}:`, error);
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

  async closePosition(symbol: string, options: { autoRepay?: boolean } = {}): Promise<any> {
    const balance = await this.getBalance();
    const baseAsset = symbol.split('/')[0];
    const quoteAsset = symbol.split('/')[1];
    const position = balance[baseAsset];

    if (!position || position.total === 0) {
      throw new Error(`No position found for ${symbol}`);
    }

    const side = position.total > 0 ? 'sell' : 'buy';
    const amount = Math.abs(position.total);
    const isLong = position.total > 0;

    // Check if position is dust (below minimum order size)
    try {
      const markets = await this.exchange.loadMarkets();
      const market = markets[symbol];
      const minAmount = market?.limits?.amount?.min || 0;

      if (minAmount > 0 && amount < minAmount) {
        console.log(`⚠️ Position too small to close: ${amount.toFixed(6)} ${baseAsset} (minimum: ${minAmount} ${baseAsset})`);
        return {
          status: 'dust_position',
          symbol,
          amount,
          minAmount,
          warning: `Position size ${amount.toFixed(6)} ${baseAsset} is below minimum tradeable amount of ${minAmount} ${baseAsset}. This is dust and cannot be closed.`,
          suggestion: 'Consider leaving this dust position or manually converting through Binance Convert feature'
        };
      }
    } catch (error) {
      console.warn(`⚠️ Could not check minimum order size for ${symbol}, attempting to close anyway`);
    }

    // Close the position
    console.log(`📤 Closing ${isLong ? 'LONG' : 'SHORT'} position: ${amount.toFixed(6)} ${baseAsset}`);
    const closeOrder = await this.createMarketOrder(symbol, side, amount, { reduceOnly: true });

    const result: any = {
      closeOrder,
      autoRepay: options.autoRepay !== false // Default to true
    };

    // Auto-repay borrowed assets (default behavior)
    if (options.autoRepay !== false) {
      try {
        // Get liabilities for the assets involved
        const borrowedAsset = isLong ? quoteAsset : baseAsset;
        const liability = await this.getLiabilityForAsset(borrowedAsset);

        if (liability.total > 0) {
          console.log(`💰 Auto-repaying ${liability.total.toFixed(6)} ${borrowedAsset} borrowed amount`);

          // Ensure we have enough balance to repay
          const currentBalance = await this.getBalance();
          const available = currentBalance[borrowedAsset]?.free || 0;

          if (available >= liability.total) {
            const repayResult = await this.repayMargin(borrowedAsset, liability.total);
            result.repayment = {
              asset: borrowedAsset,
              amount: liability.total,
              status: 'success',
              result: repayResult
            };
            console.log(`✅ Successfully repaid ${liability.total.toFixed(6)} ${borrowedAsset}`);
          } else {
            result.repayment = {
              asset: borrowedAsset,
              amount: liability.total,
              status: 'insufficient_balance',
              available,
              needed: liability.total,
              warning: `Only ${available.toFixed(6)} ${borrowedAsset} available, need ${liability.total.toFixed(6)}`
            };
            console.warn(`⚠️ Insufficient balance to repay ${borrowedAsset}: have ${available.toFixed(6)}, need ${liability.total.toFixed(6)}`);
          }
        } else {
          result.repayment = {
            status: 'no_debt',
            message: `No ${borrowedAsset} debt to repay`
          };
        }
      } catch (error) {
        result.repayment = {
          status: 'error',
          error: (error as Error).message
        };
        console.error(`❌ Auto-repay failed:`, error);
      }
    }

    return result;
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

        // If no existing debt, calculate based on collateral alone (3x leverage)
        if (totalLiability === 0 || totalLiability < 0.00001) {
          // No debt yet - can borrow up to 2x collateral (for 3x total exposure)
          const maxBorrowBtc = totalNetAsset * 2; // 3x leverage = 1x collateral + 2x borrowed

          // Convert from BTC terms to asset amount
          let maxAdditionalBorrowAsset: number;
          let assetPriceInBtc: number;

          if (asset === 'USDT' || asset === 'USDC' || asset === 'BUSD') {
            const btcPrice = await this.getCurrentPrice('BTC/USDT');
            assetPriceInBtc = 1 / btcPrice;
            maxAdditionalBorrowAsset = maxBorrowBtc / assetPriceInBtc;
          } else {
            const assetPrice = await this.getCurrentPrice(`${asset}/USDT`);
            const btcPrice = await this.getCurrentPrice('BTC/USDT');
            assetPriceInBtc = assetPrice / btcPrice;
            maxAdditionalBorrowAsset = maxBorrowBtc / assetPriceInBtc;
          }

          return {
            asset,
            marginMode: 'cross',
            totalNetAssetBtc: totalNetAsset,
            totalLiabilityBtc: totalLiability,
            currentMarginLevel: 'N/A (no debt)',
            maxAdditionalBorrowBtc: maxBorrowBtc,
            maxAdditionalBorrowAsset: maxAdditionalBorrowAsset,
            assetPriceInBtc: assetPriceInBtc
          };
        }

        // Has existing debt - check margin level for safety
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

        // Convert from BTC terms to asset amount
        let maxAdditionalBorrowAsset: number;
        let assetPriceInBtc: number;

        if (asset === 'USDT' || asset === 'USDC' || asset === 'BUSD') {
          // For stablecoins, calculate price as 1 / BTC price
          const btcPrice = await this.getCurrentPrice('BTC/USDT');
          assetPriceInBtc = 1 / btcPrice;
          maxAdditionalBorrowAsset = maxAdditionalBorrow / assetPriceInBtc;
        } else {
          // For other assets, get their USDT price and convert to BTC terms
          const assetPrice = await this.getCurrentPrice(`${asset}/USDT`);
          const btcPrice = await this.getCurrentPrice('BTC/USDT');
          assetPriceInBtc = assetPrice / btcPrice;
          maxAdditionalBorrowAsset = maxAdditionalBorrow / assetPriceInBtc;
        }

        return {
          asset,
          marginMode: 'cross',
          totalNetAssetBtc: totalNetAsset,
          totalLiabilityBtc: totalLiability,
          currentMarginLevel,
          maxAdditionalBorrowBtc: maxAdditionalBorrow,
          maxAdditionalBorrowAsset: maxAdditionalBorrowAsset,
          assetPriceInBtc: assetPriceInBtc
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

  // Leveraged Order Management
  async createLeveragedOrder(
    symbol: string,
    type: 'market' | 'limit',
    side: 'buy' | 'sell',
    amount: number,
    price?: number,
    options: OrderOptions = {}
  ): Promise<any> {
    const leverage = options.leverage || 1;

    if (leverage <= 1) {
      // No leverage needed, use regular order
      const params = this.buildOrderParams(options);
      return await this.exchange.createOrder(symbol, type, side, amount, price, params);
    }

    try {
      // Calculate how much we need to borrow
      const [baseAsset, quoteAsset] = symbol.split('/');
      const borrowAsset = side === 'buy' ? quoteAsset : baseAsset;

      // Get current price for calculations
      const ticker = await this.exchange.fetchTicker(symbol);
      const currentPrice = price || ticker.last || ticker.close || 0;

      if (currentPrice <= 0) {
        throw new Error(`Unable to determine current price for ${symbol}`);
      }

      // Check maximum borrowable amount first
      const maxBorrowableResult = await this.getMaxBorrowable(borrowAsset);
      const maxBorrowableAmount = typeof maxBorrowableResult === 'object' ?
        (maxBorrowableResult.maxAdditionalBorrowAsset || maxBorrowableResult.maxBorrowable || 0) : maxBorrowableResult;

      // Calculate total position value and required borrowing
      const positionValue = side === 'buy' ? amount * currentPrice : amount;
      const availableBalance = await this.getAvailableBalance(borrowAsset);

      // Reserve buffer for protective orders (5 USDT minimum)
      const protectiveOrderBuffer = Math.min(10, availableBalance * 0.1); // 10% or 10 USDT max
      const usableBalance = Math.max(0, availableBalance - protectiveOrderBuffer);

      const totalRequired = positionValue * leverage;
      let borrowAmount = Math.max(0, totalRequired - usableBalance);

      if (protectiveOrderBuffer > 0) {
        console.log(`💰 Reserving ${protectiveOrderBuffer.toFixed(2)} ${borrowAsset} buffer for protective orders`);
      }

      // Adjust position size if borrowing exceeds limits
      let adjustedAmount = amount;
      if (borrowAmount > maxBorrowableAmount) {
        console.log(`⚠️ Requested borrow (${borrowAmount.toFixed(2)} ${borrowAsset}) exceeds limit (${maxBorrowableAmount.toFixed(2)} ${borrowAsset})`);

        // Calculate maximum position size with usable funds (after buffer) + max borrowing
        const maxTotalFunds = usableBalance + maxBorrowableAmount;
        const maxPositionValue = maxTotalFunds;
        adjustedAmount = side === 'buy' ? maxPositionValue / currentPrice : maxPositionValue;

        console.log(`📉 Adjusting position from ${amount.toFixed(6)} to ${adjustedAmount.toFixed(6)} ${baseAsset}`);

        // Recalculate borrowing with adjusted amount
        const adjustedPositionValue = side === 'buy' ? adjustedAmount * currentPrice : adjustedAmount;
        borrowAmount = Math.max(0, adjustedPositionValue - usableBalance);
      }

      // Borrow if needed (within limits)
      if (borrowAmount > 0) {
        console.log(`🏦 Borrowing ${borrowAmount.toFixed(6)} ${borrowAsset} for ${leverage}x leverage`);
        await this.exchange.borrowCrossMargin(borrowAsset, borrowAmount);
      }

      // Calculate total amount for the order (based on usable balance + borrowed funds)
      // This preserves the protective order buffer in the account
      const totalFunds = usableBalance + borrowAmount;
      const totalAmount = side === 'buy' ? totalFunds / currentPrice : adjustedAmount;

      // For MARKET orders: place without protection first, then add protective orders after execution
      // For LIMIT orders: can include protection in the order params
      let orderParams: any;
      let needsPostProtection = false;

      if (type === 'market' && (options.stopLoss || options.takeProfit)) {
        // Market orders: can't include stop-loss/take-profit (Binance doesn't know execution price yet)
        orderParams = this.buildOrderParams({
          ...options,
          stopLoss: undefined,
          takeProfit: undefined
        });
        needsPostProtection = true;
      } else {
        // Limit orders or no protection: can include everything
        orderParams = this.buildOrderParams(options);
      }

      const order = await this.exchange.createOrder(symbol, type, side, totalAmount, price, orderParams);

      // For market orders, place protective orders after execution using actual fill price
      let protectionResult = null;
      if (needsPostProtection && order.status === 'closed') {
        const actualPrice = order.average || order.price || currentPrice;
        console.log(`✅ Order filled at ${actualPrice}`);

        if (options.stopLoss && options.takeProfit) {
          console.log(`🎯 Setting protective orders: Stop-loss ${options.stopLoss}, Take-profit ${options.takeProfit}`);
          try {
            const exitSide = side === 'buy' ? 'sell' : 'buy';

            // Use native OCO API to place both orders atomically
            const ocoResult = await this.createOCOOrder(symbol, exitSide, totalAmount, {
              limitPrice: options.takeProfit,
              stopPrice: options.stopLoss,
              marginMode: options.marginMode || this.defaultMarginMode
            });

            protectionResult = {
              oco: ocoResult,
              status: 'oco_placed'
            };
          } catch (error) {
            console.warn(`⚠️ Failed to set protective orders: ${(error as Error).message}`);
            protectionResult = {
              status: 'failed',
              error: (error as Error).message
            };
          }
        } else if (options.stopLoss) {
          // Only stop-loss
          try {
            const exitSide = side === 'buy' ? 'sell' : 'buy';
            const stopLossOrder = await this.createStopMarketOrder(symbol, exitSide, totalAmount, options.stopLoss, {
              marginMode: options.marginMode || this.defaultMarginMode,
              reduceOnly: true
            });
            console.log(`✅ Stop-loss placed at ${options.stopLoss}`);
            protectionResult = { stopLoss: stopLossOrder, status: 'stop_only' };
          } catch (error) {
            console.warn(`⚠️ Failed to set stop-loss: ${(error as Error).message}`);
            protectionResult = { status: 'failed', error: (error as Error).message };
          }
        } else if (options.takeProfit) {
          // Only take-profit
          try {
            const exitSide = side === 'buy' ? 'sell' : 'buy';
            const takeProfitOrder = await this.createLimitOrder(symbol, exitSide, totalAmount, options.takeProfit, {
              marginMode: options.marginMode || this.defaultMarginMode,
              reduceOnly: true
            });
            console.log(`✅ Take-profit placed at ${options.takeProfit}`);
            protectionResult = { takeProfit: takeProfitOrder, status: 'tp_only' };
          } catch (error) {
            console.warn(`⚠️ Failed to set take-profit: ${(error as Error).message}`);
            protectionResult = { status: 'failed', error: (error as Error).message };
          }
        }
      } else if (needsPostProtection) {
        console.warn(`⚠️ Order not filled immediately, skipping protective orders`);
      } else if (options.stopLoss || options.takeProfit) {
        console.log(`✅ Order placed with built-in protective levels`);
      }

      return {
        ...order,
        leverage: leverage,
        borrowedAmount: borrowAmount,
        borrowedAsset: borrowAsset,
        originalAmount: amount,
        adjustedAmount: adjustedAmount,
        leveragedAmount: totalAmount,
        stopLoss: options.stopLoss,
        takeProfit: options.takeProfit,
        protection: protectionResult,
        positionAdjusted: adjustedAmount !== amount
      };

    } catch (error) {
      console.error('❌ Leveraged order failed:', (error as Error).message);
      throw error;
    }
  }

  private async getAvailableBalance(asset: string): Promise<number> {
    const balance = await this.getBalance();
    return balance[asset]?.free || 0;
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

    // Calculate potential P&L in USDT
    const [, quoteAsset] = symbol.split('/');

    // Calculate P&L in quote currency
    const targetPnlQuote = position.size * (targetPrice - entryPrice) * (position.side === 'long' ? 1 : -1);
    const stopPnlQuote = position.size * (stopPrice - entryPrice) * (position.side === 'long' ? 1 : -1);

    // Convert to USDT if needed
    let targetPnl: number;
    let stopPnl: number;

    if (quoteAsset === 'USDT') {
      targetPnl = targetPnlQuote;
      stopPnl = stopPnlQuote;
    } else {
      const USDTPrice = await this.getUSDTPrice(quoteAsset);
      targetPnl = targetPnlQuote * USDTPrice;
      stopPnl = stopPnlQuote * USDTPrice;
    }

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
    const positions = await this.getCurrentPositions();

    // Get open orders for all symbols that have positions
    const openOrders = [];
    const recentOrders = [];
    const symbolsWithPositions = [...new Set(positions.map(p => p.symbol))];

    for (const symbol of symbolsWithPositions) {
      try {
        const orders = await this.getOpenOrders(symbol);
        openOrders.push(...orders);

        const history = await this.getOrderHistory(symbol, 20);
        recentOrders.push(...history);
      } catch (error) {
        console.warn(`Could not get orders for ${symbol}:`, error);
      }
    }

    // Calculate pending value in USDT
    let pendingValue = 0;
    for (const order of openOrders) {
      if (order.status === 'open' && order.remaining) {
        try {
          const [, quoteAsset] = order.symbol.split('/');
          // Order value is: remaining * price (in quote currency)
          const orderValueQuote = order.remaining * (order.price || 0);

          // Convert to USDT if needed
          if (quoteAsset === 'USDT') {
            pendingValue += orderValueQuote;
          } else {
            const USDTPrice = await this.getUSDTPrice(quoteAsset);
            pendingValue += orderValueQuote * USDTPrice;
          }
        } catch (error) {
          console.warn(`Could not calculate pending value for ${order.symbol}:`, error);
        }
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
    // Get all positions to fetch orders for their symbols
    const positions = await this.getCurrentPositions();
    const symbolsWithPositions = [...new Set(positions.map(p => p.symbol))];

    const openOrders = [];
    for (const symbol of symbolsWithPositions) {
      try {
        const orders = await this.getOpenOrders(symbol);
        openOrders.push(...orders);
      } catch (error) {
        console.warn(`Could not get orders for ${symbol}:`, error);
      }
    }

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
    totalNotionalUSDT: number;
    totalUnrealizedPnlUSDT: number;
    longPositions: PositionInfo[];
    shortPositions: PositionInfo[];
    biggestWinner: PositionInfo | null;
    biggestLoser: PositionInfo | null;
  }> {
    const positions = await this.getCurrentPositions();

    const longPositions = positions.filter(p => p.side === 'long');
    const shortPositions = positions.filter(p => p.side === 'short');

    const totalNotionalUSDT = positions.reduce((sum, p) => sum + (p.notionalUSDT || 0), 0);
    const totalUnrealizedPnlUSDT = positions.reduce((sum, p) => sum + (p.unrealizedPnlUSDT || 0), 0);

    // Find biggest winner and loser by unrealized PnL
    let biggestWinner: PositionInfo | null = null;
    let biggestLoser: PositionInfo | null = null;

    for (const position of positions) {
      const pnl = position.unrealizedPnlUSDT || 0;

      if (!biggestWinner || pnl > (biggestWinner.unrealizedPnlUSDT || 0)) {
        biggestWinner = position;
      }

      if (!biggestLoser || pnl < (biggestLoser.unrealizedPnlUSDT || 0)) {
        biggestLoser = position;
      }
    }

    return {
      totalPositions: positions.length,
      totalNotionalUSDT,
      totalUnrealizedPnlUSDT,
      longPositions,
      shortPositions,
      biggestWinner,
      biggestLoser
    };
  }

  /**
   * Check if a position has protective orders (stop-loss or take-profit)
   */
  async hasProtectiveOrders(symbol: string): Promise<{
    hasStopLoss: boolean;
    hasTakeProfit: boolean;
    hasProtection: boolean;
    orders: any[];
  }> {
    try {
      const openOrders = await this.getOpenOrders(symbol);

      let hasStopLoss = false;
      let hasTakeProfit = false;

      for (const order of openOrders) {
        const orderType = order.type?.toLowerCase() || '';

        // Check for stop-loss orders
        if (orderType.includes('stop') && order.reduceOnly) {
          hasStopLoss = true;
        }

        // Check for take-profit orders (limit orders that reduce position)
        if (orderType === 'limit' && order.reduceOnly) {
          // Determine if it's take-profit by checking if price is favorable
          const positions = await this.getCurrentPositions();
          const position = positions.find(p => p.symbol === symbol);

          if (position) {
            const isLong = position.side === 'long';
            const orderPrice = order.price || 0;
            const markPrice = position.markPrice;

            // For long: take-profit is above current price
            // For short: take-profit is below current price
            if ((isLong && orderPrice > markPrice) || (!isLong && orderPrice < markPrice)) {
              hasTakeProfit = true;
            }
          }
        }
      }

      return {
        hasStopLoss,
        hasTakeProfit,
        hasProtection: hasStopLoss || hasTakeProfit,
        orders: openOrders
      };
    } catch (error) {
      console.warn(`Could not check protective orders for ${symbol}:`, error);
      return {
        hasStopLoss: false,
        hasTakeProfit: false,
        hasProtection: false,
        orders: []
      };
    }
  }

  /**
   * Get all positions that lack protective orders
   */
  async getUnprotectedPositions(): Promise<Array<{
    position: PositionInfo;
    protection: {
      hasStopLoss: boolean;
      hasTakeProfit: boolean;
    };
  }>> {
    const positions = await this.getCurrentPositions();
    const unprotected = [];

    for (const position of positions) {
      const protection = await this.hasProtectiveOrders(position.symbol);

      if (!protection.hasProtection) {
        unprotected.push({
          position,
          protection: {
            hasStopLoss: protection.hasStopLoss,
            hasTakeProfit: protection.hasTakeProfit
          }
        });
      }
    }

    return unprotected;
  }

  /**
   * Add OCO protection to an existing position
   */
  async addProtectionToPosition(
    symbol: string,
    stopLossPrice: number,
    takeProfitPrice: number
  ): Promise<any> {
    const positions = await this.getCurrentPositions();
    const position = positions.find(p => p.symbol === symbol);

    if (!position) {
      throw new Error(`No position found for ${symbol}`);
    }

    // Check if position already has protection
    const existingProtection = await this.hasProtectiveOrders(symbol);
    if (existingProtection.hasProtection) {
      console.warn(`⚠️ Position ${symbol} already has some protection orders`);
      if (existingProtection.hasStopLoss && existingProtection.hasTakeProfit) {
        return {
          status: 'already_protected',
          message: `Position already has both stop-loss and take-profit`,
          existingOrders: existingProtection.orders
        };
      }
    }

    // Determine the side for closing the position
    const exitSide = position.side === 'long' ? 'sell' : 'buy';

    // Create OCO order
    console.log(`🛡️ Adding protection to ${symbol} position (${position.size} ${position.side})`);
    const ocoResult = await this.createOCOOrder(symbol, exitSide, position.size, {
      limitPrice: takeProfitPrice,
      stopPrice: stopLossPrice,
      marginMode: this.defaultMarginMode
    });

    return {
      status: 'protected',
      position,
      stopLossPrice,
      takeProfitPrice,
      ocoResult,
      message: `✅ Added OCO protection: Stop-loss at ${stopLossPrice}, Take-profit at ${takeProfitPrice}`
    };
  }

  async getAccountOverview(): Promise<{
    availableUSDT: any;
    positions: PositionInfo[];
    openOrders: any[];
    liabilities: any;
    marginLevel: any;
    liquidationRisk: any;
    summary: {
      totalEquityUSDT: number;
      totalPositionValueUSDT: number;
      totalUnrealizedPnlUSDT: number;
      freeMarginUSDT: number;
      marginUtilization: number;
    };
  }> {
    // Get positions first to know which symbols to fetch orders for
    const positions = await this.getCurrentPositions();
    const symbolsWithPositions = [...new Set(positions.map(p => p.symbol))];

    // Get all account data
    const [availableUSDT, liabilities, marginLevel, liquidationRisk] =
      await Promise.all([
        this.getAvailableUSDT(),
        this.getCurrentLiabilities(),
        this.getMarginLevel(),
        this.getLiquidationRisk()
      ]);

    // Get open orders for all position symbols
    const openOrders = [];
    for (const symbol of symbolsWithPositions) {
      try {
        const orders = await this.getOpenOrders(symbol);
        openOrders.push(...orders);
      } catch (error) {
        console.warn(`Could not get orders for ${symbol}:`, error);
      }
    }

    // Calculate summary
    const totalPositionValueUSDT = positions.reduce((sum, p) => sum + (p.notionalUSDT || 0), 0);
    const totalUnrealizedPnlUSDT = positions.reduce((sum, p) => sum + (p.unrealizedPnlUSDT || 0), 0);
    const totalEquityUSDT = availableUSDT.netAvailable + totalPositionValueUSDT + totalUnrealizedPnlUSDT;
    const freeMarginUSDT = availableUSDT.free;
    const marginUtilization = totalPositionValueUSDT / (totalEquityUSDT || 1) * 100;

    return {
      availableUSDT,
      positions,
      openOrders,
      liabilities,
      marginLevel,
      liquidationRisk,
      summary: {
        totalEquityUSDT,
        totalPositionValueUSDT,
        totalUnrealizedPnlUSDT,
        freeMarginUSDT,
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