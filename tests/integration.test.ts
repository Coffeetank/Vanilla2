import { BinanceMarginTrader } from '../src/BinanceMarginTrader';
import { BinanceMarketInspector } from '../src/BinanceMarketInspector';

// Test configuration - replace with your actual API keys
const TEST_CONFIG = {
  // Binance Testnet API keys
  apiKey: process.env.BINANCE_TESTNET_API_KEY || 'your_testnet_api_key',
  secret: process.env.BINANCE_TESTNET_SECRET || 'your_testnet_secret',
  sandbox: true,

  // News API keys (optional for testing)
  cryptoPanicApiKey: process.env.CRYPTOPANIC_API_KEY,
  tavilyApiKey: process.env.TAVILY_API_KEY,

  // Test symbols
  testSymbol: 'BTC/USDT',
  testSymbol2: 'ETH/USDT',

  // Test amounts (small for safety)
  testAmount: 0.001,
  testPrice: 50000
};

interface TestResult {
  function: string;
  success: boolean;
  duration: number;
  error?: string;
  data?: any;
}

class IntegrationTester {
  private marginTrader: BinanceMarginTrader;
  private marketInspector: BinanceMarketInspector;
  private results: TestResult[] = [];

  constructor() {
    this.marginTrader = new BinanceMarginTrader({
      apiKey: TEST_CONFIG.apiKey,
      secret: TEST_CONFIG.secret,
      sandbox: TEST_CONFIG.sandbox,
      marginMode: 'cross'
    });

    this.marketInspector = new BinanceMarketInspector({
      apiKey: TEST_CONFIG.apiKey,
      secret: TEST_CONFIG.secret,
      sandbox: TEST_CONFIG.sandbox,
      cryptoPanicApiKey: TEST_CONFIG.cryptoPanicApiKey,
      tavilyApiKey: TEST_CONFIG.tavilyApiKey
    });
  }

  private async testFunction(
    name: string,
    fn: () => Promise<any>,
    skipOnError: boolean = false
  ): Promise<TestResult> {
    const start = Date.now();

    try {
      console.log(`🧪 Testing ${name}...`);
      const data = await fn();
      const duration = Date.now() - start;

      const result: TestResult = {
        function: name,
        success: true,
        duration,
        data
      };

      console.log(`✅ ${name} - Success (${duration}ms)`);
      this.results.push(result);
      return result;

    } catch (error) {
      const duration = Date.now() - start;
      const errorMessage = error instanceof Error ? error.message : String(error);

      const result: TestResult = {
        function: name,
        success: false,
        duration,
        error: errorMessage
      };

      if (skipOnError) {
        console.log(`⚠️  ${name} - Skipped (${errorMessage})`);
      } else {
        console.log(`❌ ${name} - Failed (${duration}ms): ${errorMessage}`);
      }

      this.results.push(result);
      return result;
    }
  }

  // Test BinanceMarginTrader functions
  async testMarginTrader(): Promise<void> {
    console.log('\n📊 Testing BinanceMarginTrader Functions\n');

    // Account & Balance Management
    await this.testFunction('getAvailableUSDT', async () => {
      return await this.marginTrader.getAvailableUSDT();
    });

    await this.testFunction('getBalance', async () => {
      return await this.marginTrader.getBalance();
    });

    await this.testFunction('getMarginLevel', async () => {
      return await this.marginTrader.getMarginLevel();
    });

    // Position Management
    await this.testFunction('getCurrentPositions', async () => {
      return await this.marginTrader.getCurrentPositions();
    });

    await this.testFunction('getPositionSummary', async () => {
      return await this.marginTrader.getPositionSummary();
    });

    // Order Management
    await this.testFunction('getOpenOrders', async () => {
      return await this.marginTrader.getOpenOrders();
    });

    await this.testFunction('getOrdersByType', async () => {
      return await this.marginTrader.getOrdersByType();
    });

    await this.testFunction('getCompleteOrderStatus', async () => {
      return await this.marginTrader.getCompleteOrderStatus();
    });

    // Liability Management
    await this.testFunction('getCurrentLiabilities', async () => {
      return await this.marginTrader.getCurrentLiabilities();
    });

    await this.testFunction('getTotalLiabilityValue', async () => {
      return await this.marginTrader.getTotalLiabilityValue();
    });

    await this.testFunction('getLiquidationRisk', async () => {
      return await this.marginTrader.getLiquidationRisk();
    });

    // Max Borrowable
    await this.testFunction('getMaxBorrowable-BTC', async () => {
      return await this.marginTrader.getMaxBorrowable('BTC');
    });

    // Account Overview
    await this.testFunction('getAccountOverview', async () => {
      return await this.marginTrader.getAccountOverview();
    });

    // Exit Plan Management (test creation without execution)
    await this.testFunction('createDetailedExitPlan', async () => {
      return await this.marginTrader.createDetailedExitPlan(
        TEST_CONFIG.testSymbol,
        TEST_CONFIG.testPrice * 1.1, // 10% higher target
        TEST_CONFIG.testPrice * 0.95, // 5% lower stop
        TEST_CONFIG.testPrice * 0.93  // 7% lower invalidation
      );
    }, true); // Skip on error as we might not have positions

    // Test order creation (limit order that won't fill)
    await this.testFunction('createLimitOrder-Safe', async () => {
      const currentPrice = 50000; // Assumption for safe test
      const safePrice = currentPrice * 0.5; // Very low price that won't fill

      return await this.marginTrader.createLimitOrder(
        TEST_CONFIG.testSymbol,
        'buy',
        TEST_CONFIG.testAmount,
        safePrice
      );
    }, true); // Skip on error for safety
  }

  // Test BinanceMarketInspector functions
  async testMarketInspector(): Promise<void> {
    console.log('\n🔍 Testing BinanceMarketInspector Functions\n');

    // Basic Market Data
    await this.testFunction('getMarketStats', async () => {
      return await this.marketInspector.getMarketStats(TEST_CONFIG.testSymbol);
    });

    await this.testFunction('getMultipleMarketStats', async () => {
      return await this.marketInspector.getMultipleMarketStats([
        TEST_CONFIG.testSymbol,
        TEST_CONFIG.testSymbol2
      ]);
    });

    await this.testFunction('getTopMovers', async () => {
      return await this.marketInspector.getTopMovers(10);
    });

    // Order Book Analysis
    await this.testFunction('getOrderBookAnalysis', async () => {
      return await this.marketInspector.getOrderBookAnalysis(TEST_CONFIG.testSymbol);
    });

    // Trade Analysis
    await this.testFunction('getTradeStats', async () => {
      return await this.marketInspector.getTradeStats(TEST_CONFIG.testSymbol);
    });

    // Chart Analysis
    await this.testFunction('getChartAnalysis', async () => {
      return await this.marketInspector.getChartAnalysis(TEST_CONFIG.testSymbol, '1h', 50);
    });

    // Technical Indicators
    await this.testFunction('getTechnicalIndicators', async () => {
      return await this.marketInspector.getTechnicalIndicators(TEST_CONFIG.testSymbol);
    });

    // Volume Analysis
    await this.testFunction('getVolumeAnalysis', async () => {
      return await this.marketInspector.getVolumeAnalysis(TEST_CONFIG.testSymbol);
    });

    // Market Depth Analysis
    await this.testFunction('getMarketDepthAnalysis', async () => {
      return await this.marketInspector.getMarketDepthAnalysis(TEST_CONFIG.testSymbol);
    });

    // Funding and Fees
    await this.testFunction('getFundingAndFees', async () => {
      return await this.marketInspector.getFundingAndFees(TEST_CONFIG.testSymbol);
    });

    // Market Correlation
    await this.testFunction('getMarketCorrelation', async () => {
      return await this.marketInspector.getMarketCorrelation(TEST_CONFIG.testSymbol);
    });

    // Market Sentiment
    await this.testFunction('getMarketSentiment', async () => {
      return await this.marketInspector.getMarketSentiment(TEST_CONFIG.testSymbol);
    });

    // News and Events (if API keys provided)
    if (TEST_CONFIG.cryptoPanicApiKey || TEST_CONFIG.tavilyApiKey) {
      await this.testFunction('getNewsAndEvents', async () => {
        return await this.marketInspector.getNewsAndEvents(TEST_CONFIG.testSymbol);
      }, true); // Skip on error as API keys might not be provided
    }

    // Search Markets
    await this.testFunction('searchMarkets', async () => {
      return await this.marketInspector.searchMarkets('BTC');
    });

    // Complete Market Overview
    await this.testFunction('getCompleteMarketOverview', async () => {
      return await this.marketInspector.getCompleteMarketOverview(TEST_CONFIG.testSymbol);
    });

    // Ultra Market Analysis
    await this.testFunction('getUltraMarketAnalysis', async () => {
      return await this.marketInspector.getUltraMarketAnalysis(TEST_CONFIG.testSymbol);
    }, true); // Skip on error as it includes news which might fail
  }

  // Test specific news and events functionality
  async testNewsAndEvents(): Promise<void> {
    console.log('\n📰 Testing News and Events Integration\n');

    if (!TEST_CONFIG.cryptoPanicApiKey && !TEST_CONFIG.tavilyApiKey) {
      console.log('⚠️  Skipping news tests - API keys not provided');
      return;
    }

    // Test news for different assets
    const testAssets = ['BTC/USDT', 'ETH/USDT'];

    for (const asset of testAssets) {
      await this.testFunction(`getNewsAndEvents-${asset.replace('/', '-')}`, async () => {
        return await this.marketInspector.getNewsAndEvents(asset);
      }, true);
    }

    // Test cache functionality
    await this.testFunction('getNewsAndEvents-CacheTest', async () => {
      const start = Date.now();
      const result1 = await this.marketInspector.getNewsAndEvents(TEST_CONFIG.testSymbol);
      const time1 = Date.now() - start;

      const start2 = Date.now();
      const result2 = await this.marketInspector.getNewsAndEvents(TEST_CONFIG.testSymbol);
      const time2 = Date.now() - start2;

      return {
        firstCall: { time: time1, cached: result1.cacheInfo.cached },
        secondCall: { time: time2, cached: result2.cacheInfo.cached },
        cacheWorking: time2 < time1 / 2 // Second call should be much faster if cached
      };
    }, true);
  }

  // Generate comprehensive test report
  generateReport(): void {
    console.log('\n📋 INTEGRATION TEST REPORT\n');
    console.log('=' .repeat(60));

    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.success).length;
    const failedTests = totalTests - passedTests;

    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${passedTests} ✅`);
    console.log(`Failed: ${failedTests} ❌`);
    console.log(`Success Rate: ${((passedTests / totalTests) * 100).toFixed(1)}%`);

    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;
    console.log(`Average Duration: ${avgDuration.toFixed(0)}ms`);

    // Group results by category
    const categories = {
      'Margin Trader': this.results.filter(r =>
        r.function.includes('get') && !r.function.includes('Market')
      ),
      'Market Inspector': this.results.filter(r =>
        r.function.includes('Market') || r.function.includes('Chart') ||
        r.function.includes('Technical') || r.function.includes('Volume')
      ),
      'News & Events': this.results.filter(r =>
        r.function.includes('News') || r.function.includes('Events')
      )
    };

    console.log('\n📊 Results by Category:\n');

    Object.entries(categories).forEach(([category, results]) => {
      if (results.length > 0) {
        const passed = results.filter(r => r.success).length;
        const total = results.length;
        console.log(`${category}: ${passed}/${total} (${((passed/total)*100).toFixed(1)}%)`);
      }
    });

    // Show failed tests
    const failed = this.results.filter(r => !r.success);
    if (failed.length > 0) {
      console.log('\n❌ Failed Tests:\n');
      failed.forEach(result => {
        console.log(`- ${result.function}: ${result.error}`);
      });
    }

    // Show longest running tests
    const slowTests = this.results
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 5);

    console.log('\n⏱️  Slowest Tests:\n');
    slowTests.forEach(result => {
      console.log(`- ${result.function}: ${result.duration}ms`);
    });

    console.log('\n' + '=' .repeat(60));
  }

  // Run all tests
  async runAllTests(): Promise<void> {
    const startTime = Date.now();

    console.log('🚀 Starting Binance Integration Tests');
    console.log(`Test Configuration:`);
    console.log(`- Sandbox Mode: ${TEST_CONFIG.sandbox}`);
    console.log(`- Test Symbol: ${TEST_CONFIG.testSymbol}`);
    console.log(`- CryptoPanic API: ${TEST_CONFIG.cryptoPanicApiKey ? 'Configured' : 'Not configured'}`);
    console.log(`- Tavily API: ${TEST_CONFIG.tavilyApiKey ? 'Configured' : 'Not configured'}`);

    try {
      await this.testMarginTrader();
      await this.testMarketInspector();
      await this.testNewsAndEvents();
    } catch (error) {
      console.error('❌ Test suite failed:', error);
    }

    const totalTime = Date.now() - startTime;
    console.log(`\n⏰ Total test time: ${totalTime}ms`);

    this.generateReport();
  }
}

// Export for use in other files
export { IntegrationTester, TEST_CONFIG };

// Run tests if this file is executed directly
if (require.main === module) {
  const tester = new IntegrationTester();
  tester.runAllTests().catch(console.error);
}