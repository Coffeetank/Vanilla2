import 'dotenv/config';
import { mastra } from './mastra';
import { BinanceMarginTrader } from './trader/MarginTrader';
import { BinanceMarketInspector } from './trader/MarketInspector';
import { initializeTools } from './trader/tools';

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
  const agent = mastra.getAgent('tradingAgent');

  // Create a conversation thread for memory
  const threadId = `trading-session-${Date.now()}`;

  console.log('✅ Trading Agent initialized successfully');
  console.log('📝 Thread ID:', threadId);
  console.log('🔧 Sandbox mode:', process.env.BINANCE_SANDBOX === 'true' ? 'ON' : 'OFF');
  console.log('\n' + '='.repeat(60) + '\n');

  // Simple interactive prompt
  const prompt = 'Give me a complete overview of my trading account and current market opportunities.';

  console.log('💭 Query:', prompt);
  console.log('\n' + '-'.repeat(60) + '\n');

  const response = await agent.generate(prompt, { threadId });

  console.log('🤖 Agent Response:\n');
  console.log(response.text);
  console.log('\n' + '='.repeat(60) + '\n');

  console.log('✨ Session complete!');
  console.log('💡 Run "npm run example" to see more examples');
}

main().catch((error) => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
