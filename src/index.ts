import 'dotenv/config';
import './instrumentation.js'; // Must be the first import for OpenTelemetry setup
import { tradingAgent } from './trader/agent.js';
import { BinanceMarketInspector } from './trader/MarketInspector.js';
import { initializeTools, initializeTrader } from './trader/tools.js';
import { MarketTrader } from './trader/MarketTrader.js';

async function main() {
  console.log('Trading Agent Starting...\n');

  // Initialize Binance trading components
  const inspector = new BinanceMarketInspector({
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_SECRET || '',
    sandbox: process.env.BINANCE_SANDBOX === 'true',
    cryptoPanicApiKey: process.env.CRYPTOPANIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
  });

  // Initialize tools with instances
  initializeTools(inspector);
  // Initialize trader (execution)
  const trader = new MarketTrader({
    apiKey: process.env.BINANCE_API_KEY || '',
    apiSecret: process.env.BINANCE_SECRET || '',
    sandbox: process.env.BINANCE_SANDBOX === 'true',
  });
  initializeTrader(trader);

  // Get the trading agent
  const agent = tradingAgent;

  // Create a conversation thread for memory
  const threadId = `trading-session-${Date.now()}`;

  console.log('✅ Trading Agent initialized successfully');
  console.log('📝 Thread ID:', threadId);
  console.log('🔧 Sandbox mode:', process.env.BINANCE_SANDBOX === 'true' ? 'ON' : 'OFF');
  console.log('\n' + '='.repeat(60) + '\n');

  const prompt = `New round begins.
Symbols under management: BTC/USDT,ETH/USDT,BNB/USDT,XRP/USDT,SOL/USDT,TRX/USDT,AVAX/USDT
Current time: ${new Date().toUTCString()}
Follow the system instructions to analyze the market, choose actions, and update the note.`;

  console.log('💭 Query:', prompt);
  console.log('\n' + '-'.repeat(60) + '\n');

  const response = await agent.generate(prompt, { threadId });

  console.log(response.text);
  console.log('✨ Session complete!');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
