import 'dotenv/config';
import { tradingAgent } from './trader/agent.js';
import { BinanceMarginTrader } from './trader/MarginTrader.js';
import { BinanceMarketInspector } from './trader/MarketInspector.js';
import { initializeTools } from './trader/tools.js';

async function main() {
  console.log('Trading Agent Starting...\n');

  // Initialize Binance trading components
  const trader = new BinanceMarginTrader({
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_SECRET || '',
    sandbox: process.env.BINANCE_SANDBOX === 'true',
    marginMode: 'cross',
  });

  const inspector = new BinanceMarketInspector({
    apiKey: process.env.BINANCE_API_KEY || '',
    secret: process.env.BINANCE_SECRET || '',
    sandbox: process.env.BINANCE_SANDBOX === 'true',
    cryptoPanicApiKey: process.env.CRYPTOPANIC_API_KEY,
    tavilyApiKey: process.env.TAVILY_API_KEY,
  });

  // Initialize tools with instances
  initializeTools(trader, inspector);

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
