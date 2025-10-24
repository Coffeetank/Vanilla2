import { MarginTrading, MarginTradingRestAPI } from '@binance/margin-trading';

export interface MarketTraderConfig {
  apiKey: string;
  apiSecret: string;
  sandbox?: boolean;
}

export type OrderSide = 'BUY' | 'SELL';
export type OrderType = 'MARKET' | 'LIMIT' | 'STOP_LOSS' | 'STOP_LOSS_LIMIT' | 'TAKE_PROFIT' | 'TAKE_PROFIT_LIMIT';

export interface OpenPositionParams {
  symbol: string; // e.g. BTCUSDT
  side: OrderSide; // BUY for long, SELL for short
  type: 'MARKET' | 'LIMIT';
  quantity?: number; // base quantity
  quoteOrderQty?: number; // market quote quantity
  price?: number; // when LIMIT
  timeInForce?: 'GTC' | 'IOC' | 'FOK';
  // leverage via margin: borrow behavior
  sideEffectType?: 'NO_SIDE_EFFECT' | 'MARGIN_BUY' | 'AUTO_REPAY' | 'AUTO_BORROW_REPAY';
  autoRepayAtCancel?: boolean; // default true per API
  // risk management (OCO)
  takeProfitPrice: number; // TP limit
  stopLossPrice: number; // SL stop
  stopLimitPrice?: number; // optional SL limit when using stop-limit
}

export interface OpenPositionResult {
  order: any;
  oco?: any;
  protection?: { created: boolean; error?: string };
}

export class MarketTrader {
  private client: MarginTrading;
  private rest: any;
  
  private toNativeSymbol(symbol: string): string {
    return symbol.replace('/', '').toUpperCase();
  }

  constructor(config: MarketTraderConfig) {
    this.client = new MarginTrading({
      configurationRestAPI: {
        apiKey: config.apiKey,
        apiSecret: config.apiSecret,
        basePath: config.sandbox ? 'https://testnet.binance.vision' : undefined,
      },
    });
    this.rest = this.client.restAPI;
  }

  async borrowAssetCross(asset: string, amount: string) {
    return this.rest.marginAccountBorrowRepay({
      asset,
      isIsolated: 'FALSE',
      symbol: '',
      amount,
      type: 'MARGIN',
    }).then((r: { data: () => unknown }) => r.data());
  }

  async repayAssetCross(asset: string, amount: string) {
    return this.rest.marginAccountBorrowRepay({
      asset,
      isIsolated: 'FALSE',
      symbol: '',
      amount,
      type: 'MARGIN',
    }).then((r: { data: () => unknown }) => r.data());
  }

  async openPositionWithProtection(params: OpenPositionParams): Promise<OpenPositionResult> {
    const {
      symbol,
      side,
      type,
      quantity,
      quoteOrderQty,
      price,
      timeInForce,
      sideEffectType = 'NO_SIDE_EFFECT',
      autoRepayAtCancel = true,
      takeProfitPrice,
      stopLossPrice,
      stopLimitPrice,
    } = params;
    const nativeSymbol = this.toNativeSymbol(symbol);

    // 1) Create primary order on cross margin
    const orderReq: any = {
      symbol: nativeSymbol,
      side,
      type,
      isIsolated: 'FALSE',
      quantity,
      quoteOrderQty,
      price,
      timeInForce,
      sideEffectType, // MARGIN_BUY or AUTO_BORROW_REPAY for leveraged entries
      autoRepayAtCancel,
      newOrderRespType: 'FULL',
    } as const;

    const orderRes: any = await this.rest
      .marginAccountNewOrder(orderReq)
      .then((r: { data: () => unknown }) => r.data());

    // 2) Create OCO for TP/SL on cross margin
    // For a BUY entry (long), OCO is SELL side; for SELL entry (short), OCO is BUY side
    const ocoSide: OrderSide = side === 'BUY' ? 'SELL' : 'BUY';

    const ocoQuantity: number =
      typeof quantity === 'number' && quantity > 0
        ? quantity
        : Number(orderRes?.executedQty ?? orderRes?.origQty ?? 0);

    const ocoReq: any = {
      symbol: nativeSymbol,
      side: ocoSide,
      quantity: ocoQuantity,
      price: takeProfitPrice,
      stopPrice: stopLossPrice,
      isIsolated: 'FALSE',
      stopLimitPrice: stopLimitPrice,
      stopLimitTimeInForce: stopLimitPrice ? 'GTC' : undefined,
      newOrderRespType: 'RESULT',
      autoRepayAtCancel,
    } as const;

    let ocoRes: any = null;
    let ocoErr: string | undefined;
    try {
      ocoRes = await this.rest
        .marginAccountNewOco(ocoReq)
        .then((r: { data: () => unknown }) => r.data());
    } catch (e) {
      ocoErr = e instanceof Error ? e.message : String(e);
    }

    return {
      order: orderRes,
      oco: ocoRes || undefined,
      protection: { created: Boolean(ocoRes), error: ocoErr },
    };
  }

  // ============ Order Management ============
  async cancelAllOpenOrdersOnSymbol(symbol: string) {
    const nativeSymbol = this.toNativeSymbol(symbol);
    return this.rest
      .marginAccountCancelAllOpenOrdersOnASymbol({ symbol: nativeSymbol })
      .then((r: { data: () => unknown }) => r.data());
  }

  async cancelOrder(params: { symbol: string; orderId?: number; origClientOrderId?: string }) {
    const nativeSymbol = this.toNativeSymbol(params.symbol);
    return this.rest
      .marginAccountCancelOrder({
        symbol: nativeSymbol,
        orderId: params.orderId,
        origClientOrderId: params.origClientOrderId,
        isIsolated: 'FALSE',
      })
      .then((r: { data: () => unknown }) => r.data());
  }

  async cancelOco(params: { symbol: string; orderListId?: number; listClientOrderId?: string }) {
    const nativeSymbol = this.toNativeSymbol(params.symbol);
    return this.rest
      .marginAccountCancelOco({
        symbol: nativeSymbol,
        orderListId: params.orderListId,
        listClientOrderId: params.listClientOrderId,
        isIsolated: 'FALSE',
      })
      .then((r: { data: () => unknown }) => r.data());
  }

  async addProtectionOco(params: {
    symbol: string;
    side: OrderSide; // opposite to entry side
    quantity: number;
    takeProfitPrice: number;
    stopLossPrice: number;
    stopLimitPrice?: number;
    autoRepayAtCancel?: boolean;
  }) {
    const { symbol, side, quantity, takeProfitPrice, stopLossPrice, stopLimitPrice, autoRepayAtCancel = true } = params;
    const nativeSymbol = this.toNativeSymbol(symbol);
    const req: any = {
      symbol: nativeSymbol,
      side,
      quantity,
      price: takeProfitPrice,
      stopPrice: stopLossPrice,
      isIsolated: 'FALSE',
      stopLimitPrice,
      stopLimitTimeInForce: stopLimitPrice ? 'GTC' : undefined,
      newOrderRespType: 'RESULT',
      autoRepayAtCancel,
    } as const;
    return this.rest.marginAccountNewOco(req).then((r: { data: () => unknown }) => r.data());
  }

  async getOpenOrders(symbol?: string) {
    const nativeSymbol = symbol ? this.toNativeSymbol(symbol) : undefined;
    return this.rest
      .queryMarginAccountsOpenOrders({
        symbol: nativeSymbol,
        isIsolated: nativeSymbol ? 'FALSE' : undefined,
      })
      .then((r: { data: () => unknown }) => r.data());
  }

  async getOpenOco() {
    return this.rest
      .queryMarginAccountsOpenOco({})
      .then((r: { data: () => unknown }) => r.data());
  }

  // ============ Position/Exposure Helpers ============

  // Closing position by sending opposite MARKET order
  async closePositionMarket(symbol: string, sideToClose: OrderSide, quantity: number) {
    const side: OrderSide = sideToClose; // e.g., if long (BUY) then close with SELL
    // Binance REST expects symbols without separators, e.g., TRXUSDT
    const nativeSymbol = this.toNativeSymbol(symbol);
    const req: any = {
      symbol: nativeSymbol,
      side,
      type: 'MARKET',
      isIsolated: 'FALSE',
      quantity,
      newOrderRespType: 'RESULT',
    } as const;
    return this.rest.marginAccountNewOrder(req).then((r: { data: () => unknown }) => r.data());
  }

  // ============ Manual Borrow/Repay ============
  async manualBorrow(asset: string, amount: string) {
    return this.borrowAssetCross(asset, amount);
  }

  async manualRepay(asset: string, amount: string) {
    return this.repayAssetCross(asset, amount);
  }
}


