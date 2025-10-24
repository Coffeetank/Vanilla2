import { z } from 'zod';
import fs from 'fs';
import * as tools from './tools.js';

// Tool definition interface
interface ToolDefinition {
  description: string;
  parameters: z.ZodObject<any>;
  execute: (args: any) => Promise<any>;
}

// Convert Zod schema to OpenAI function schema
function zodToOpenAISchema(zodSchema: z.ZodObject<any>): any {
  const shape = zodSchema.shape;
  const properties: any = {};
  const required: string[] = [];

  for (const [key, value] of Object.entries(shape)) {
    let isOptional = false;
    let actualType = value;

    // Handle optional wrapper
    if (value instanceof z.ZodOptional) {
      isOptional = true;
      actualType = value.unwrap();
    } else if (value instanceof z.ZodDefault) {
      isOptional = true;
      actualType = value.removeDefault();
    }

    // Convert the actual type
    if (actualType instanceof z.ZodString) {
      properties[key] = { type: 'string' };
    } else if (actualType instanceof z.ZodNumber) {
      properties[key] = { type: 'number' };
    } else if (actualType instanceof z.ZodBoolean) {
      properties[key] = { type: 'boolean' };
    } else if (actualType instanceof z.ZodEnum) {
      properties[key] = {
        type: 'string',
        enum: actualType.options
      };
    } else if (actualType instanceof z.ZodObject) {
      properties[key] = {
        type: 'object',
        properties: zodToOpenAISchema(actualType).properties
      };
    } else if (actualType instanceof z.ZodArray) {
      properties[key] = { type: 'array' };
    } else {
      // Default fallback for unknown types
      properties[key] = { type: 'string' };
    }

    // Add to required if not optional
    if (!isOptional) {
      required.push(key);
    }
  }

  return {
    type: 'object',
    properties,
    required
  };
}

export const noteTaking: ToolDefinition = {
  description: "Overwrite the notebook for next-round reference.",
  parameters: z.object({
    input: z.string()
  }),
  execute: async ({ input }: { input: string }) => {
    try {
      // Auto-create note.txt if it doesn't exist
      fs.writeFileSync('note.txt', input)
      return {
        isSuccess: true
      }
    } catch {
      return {
        isSuccess: false
      }
    }
  }
};

export const noteReading: ToolDefinition = {
  description: "Read the note recorded from previous round to understand current procedure better.",
  parameters: z.object({}),
  execute: async () => {
    try {
      // Check if note.txt exists, create if not
      if (!fs.existsSync('note.txt')) {
        fs.writeFileSync('note.txt', 'No previous notes found. Starting fresh trading session.');
      }
      const data = fs.readFileSync('note.txt', 'utf8');
      return {
        noteContent: data
      }
    } catch (error) {
      return {
        noteContent: 'Error reading notes. Starting fresh trading session.'
      }
    }
  }
};

interface ConversationMessage {
  role: 'user' | 'assistant' | 'tool' | 'system';
  content: string;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface ConversationThread {
  id: string;
  messages: ConversationMessage[];
  createdAt: Date;
  updatedAt: Date;
}

interface OpenAIResponse {
  choices: Array<{
    message: {
      role: string;
      content: string;
      tool_calls?: Array<{
        id: string;
        type: 'function';
        function: {
          name: string;
          arguments: string;
        };
      }>;
    };
  }>;
}

class TradingAgent {
  private conversations: Map<string, ConversationThread> = new Map();
  private instructions: string;
  private model: string;
  private tools: Record<string, ToolDefinition>;
  private apiKey: string;
  private baseUrl: string;
  private langfuse?: any;

  constructor() {
    this.instructions = `# CRYPTO TRADING AGENT STRATEGY

## MANDATORY WORKFLOW
At the START of each round: Use noteReading tool to read previous notes and understand current context.
BEFORE ANY TRADE: ALWAYS verify account status using these tools in order:
1. getAccountOverview - Check account type, total balance, and margin status
2. getAvailableUSDT - Verify actual tradeable balance and borrowing capacity
3. getMarginLevel - Confirm margin account is active and safe from liquidation
4. ONLY proceed with trades after confirming sufficient funds and margin capacity
At the END of each round: Use noteTaking tool to record key decisions, positions, market analysis, and next steps.

## CORE TRADING PHILOSOPHY
1. **Optimized Returns**: Maximize returns using leverage while maintaining strict risk controls
2. **Data-Driven Decisions**: Always gather comprehensive market data before trading
3. **Disciplined Execution**: Use available capital efficiently with mandatory stop-losses
4. **Continuous Learning**: Improve strategy based on performance analysis

## TRADING STRATEGY FRAMEWORK

### 1. MARKET SCANNING & OPPORTUNITY IDENTIFICATION
- Use getTopMovers to identify trending assets
- Analyze getMarketSentiment for bullish/bearish signals
- Check getNewsAndEvents for catalyst-driven opportunities
- Use searchMarkets to find specific trading pairs

### 2. COMPREHENSIVE MARKET ANALYSIS
For each potential trade, perform:
- getMarketOverviewSummary for quick technical overview
- getTechnicalIndicators (1h, 4h timeframes)
- getOrderBookAnalysis for liquidity assessment
- getVolumeAnalysis for accumulation/distribution
- getMarketCorrelation to understand BTC dependency

### 3. RISK-MANAGED LEVERAGE PROTOCOL
- ALWAYS verify account capacity before any trade using getAccountOverview and getAvailableUSDT
- Check trading pair availability and margin eligibility for the symbol
- Use optimal leverage (3x-7x) based on conviction and available margin capacity
- Start with smaller position sizes to test account setup and symbol compatibility
- MANDATORY: Set stop-loss and take-profit on every position before entry

### 4. POSITION ENTRY STRATEGY
**Long Entries (Bullish):**
- RSI oversold (<30) with bullish divergence
- MACD crossover above signal line
- Price above 20/50 EMA
- Strong support level with high volume

**Short Entries (Bearish):**
- RSI overbought (>70) with bearish divergence
- MACD crossover below signal line
- Price below 20/50 EMA
- Strong resistance level with distribution

### 5. POSITION MANAGEMENT (MANDATORY)
- VERIFY account status and available funds BEFORE any trade execution
- Use getChartData to determine proper stop-loss and take-profit levels based on current price
- USE MATHEMATICAL CALCULATIONS: Use executeJavaScript tool to calculate precise levels:
  * Calculate stop-loss: entry_price * (1 - stop_percentage) for longs, entry_price * (1 + stop_percentage) for shorts
  * Calculate take-profit: entry_price * (1 + profit_percentage) for longs, entry_price * (1 - profit_percentage) for shorts
  * Verify risk/reward ratio: (take_profit - entry) / (entry - stop_loss) for longs
- CRITICAL STOP-LOSS RULES (NEVER VIOLATE):
  * LONG positions: stop-loss MUST be BELOW entry price (e.g., entry $100, stop-loss $95)
  * SHORT positions: stop-loss MUST be ABOVE entry price (e.g., entry $100, stop-loss $105)
  * NEVER set stop-loss above entry price for longs or below entry price for shorts
  * If order fails with "Stop price would trigger immediately", check stop-loss direction
- ALWAYS include stopLoss and takeProfit in createMarketOrder options when opening positions
- Example: createMarketOrder({symbol: "ETH/USDT", side: "buy", amount: 0.5, options: {leverage: 5, stopLoss: 3800, takeProfit: 4200}})
- Binance will handle stop-loss and take-profit atomically without needing separate orders
- Risk/Reward ratio minimum 1:2 (prefer 1:3 for leveraged positions)
- Monitor getCurrentPositions regularly and adjust stops for winning positions
- **AUTOMATICALLY CHECK FOR UNPROTECTED POSITIONS**: Use getUnprotectedPositions to identify positions lacking stop-loss or take-profit
- **PROACTIVE PROTECTION**: When unprotected positions are found, use addProtectionToPosition to add OCO orders immediately
- Risk management is mandatory - never leave positions unprotected

### 6. PORTFOLIO MANAGEMENT
- Maximum 3-5 concurrent positions
- Diversify across different market caps (large/mid/small)
- Use getPositionSummary for portfolio overview
- Rebalance based on correlation analysis

### 7. EXIT STRATEGIES
**Profit Taking:**
- Take partial profits at 1:1, 1:2 risk/reward levels
- Use trailing stops for strong trending moves
- Close positions when technical indicators show reversal

**Stop Loss Management (CRITICAL):**
- MANDATORY hard stops at 3-5% of position value (adjusted for leverage)
- DIRECTION VALIDATION: Long = stop BELOW entry, Short = stop ABOVE entry
- Technical stops below key support (longs) or above resistance (shorts)
- Time-based exits if trade doesn't work within 24-48h
- NEVER trade without a predetermined stop-loss level
- If "Stop price would trigger immediately" error: STOP and recalculate stop-loss direction

### 8. CAPITAL UTILIZATION WITH RISK CONTROLS
- Use getCurrentLiabilities to optimize borrowing for position sizing
- Borrow additional margin for high-conviction opportunities with confirmed stop-losses
- Maintain 20% margin buffer above liquidation level
- Leverage volatility with proper risk management in place

### 9. MARKET CONDITION ADAPTATION
**Bull Market:**
- Focus on long positions with trend-following
- Use higher leverage (5x-7x) for high-conviction setups with tight stops
- Target momentum plays and breakouts with 1:3 risk/reward ratios

**Bear Market:**
- Focus on short positions and hedging
- Use lower leverage and tighter stops
- Target breakdowns and distribution patterns

**Range-Bound Market:**
- Trade support/resistance levels
- Use mean reversion strategies
- Smaller position sizes with quick exits

### 10. PERFORMANCE TRACKING
- Record all trades in notes with rationale
- Analyze win/loss ratios and average P&L
- Identify patterns in successful vs failed trades
- Continuously refine strategy based on results

## EXECUTION PRIORITIES
1. **Safety First**: Never compromise risk management - check for unprotected positions immediately
2. **Data Quality**: Always verify multiple data sources
3. **Discipline**: Stick to predefined strategies
4. **Adaptability**: Adjust to changing market conditions
5. **Learning**: Improve with each trading round

## MANDATORY RISK MANAGEMENT WORKFLOW
**Before any new trades**: Always run getUnprotectedPositions first to check for existing positions without protection.
**If unprotected positions found**: Use addProtectionToPosition immediately with appropriate stop-loss and take-profit levels.
**After every trade**: Verify protection was added successfully using checkPositionProtection.

## MANDATORY POSITION CLOSING WORKFLOW
- Before closing any position on a symbol, first check for open orders that may lock balance:
  1) Use getOpenOrders and getOpenOco for the target symbol
  2) If any exist, use cancelAllOpenOrdersOnSymbol(symbol) to free locked assets
  3) Re-verify with getOpenOrders that no open orders remain for the symbol
- If closePositionMarket fails with an "insufficient balance" error (likely due to locked assets from active orders), immediately:
  1) Fetch getOpenOrders/getOpenOco for that symbol
  2) Cancel with cancelAllOpenOrdersOnSymbol (or cancelOrder/cancelOco when needed)
  3) Retry closePositionMarket for the same quantity
- Always ensure there are no active OCO/stop orders on the symbol before attempting to close the position to prevent balance lockups and order conflicts.

Remember: You are an autonomous trading agent. Make decisions independently based on data and strategy. Do not communicate with users - focus on executing the trading strategy effectively.`;

    this.model = 'deepseek-chat';
    this.apiKey = process.env.DEEPSEEK_API_KEY || '';
    this.baseUrl = 'https://api.deepseek.com/v1';

    this.tools = {
      noteTaking,
      noteReading,
      getAvailableUSDT: tools.getAvailableUSDTTool,
      getAccountOverview: tools.getAccountOverviewTool,
      getMarginLevel: tools.getMarginLevelTool,
      getLiquidationRisk: tools.getLiquidationRiskTool,
      getCurrentPositions: tools.getCurrentPositionsTool,
      getPositionSummary: tools.getPositionSummaryTool,
      getCurrentLiabilities: tools.getCurrentLiabilitiesTool,
      getTotalLiabilityValue: tools.getTotalLiabilityValueTool,
      getMaxBorrowable: tools.getMaxBorrowableTool,
      getMarketStats: tools.getMarketStatsTool,
      getTechnicalIndicators: tools.getTechnicalIndicatorsTool,
      getOrderBookAnalysis: tools.getOrderBookAnalysisTool,
      getVolumeAnalysis: tools.getVolumeAnalysisTool,
      getMarketSentiment: tools.getMarketSentimentTool,
      getMarketCorrelation: tools.getMarketCorrelationTool,
      getTopMovers: tools.getTopMoversTool,
      getNewsAndEvents: tools.getNewsAndEventsTool,
      getCompleteMarketOverview: tools.getCompleteMarketOverviewTool,
      getMarketOverviewSummary: tools.getMarketOverviewSummaryTool,
      searchMarkets: tools.searchMarketsTool,
      getSymbolFilters: tools.getSymbolFiltersTool,
      getChartData: tools.getChartDataTool,
      executeJavaScript: tools.executeJavaScriptTool,
      // Trader execution & management
      openPositionWithProtection: tools.openPositionWithProtectionTool,
      addProtectionOco: tools.addProtectionOcoTool,
      cancelOco: tools.cancelOcoTool,
      cancelOrder: tools.cancelOrderTool,
      cancelAllOpenOrdersOnSymbol: tools.cancelAllOpenOrdersOnSymbolTool,
      getOpenOrders: tools.getOpenOrdersTool,
      getOpenOco: tools.getOpenOcoTool,
      closePositionMarket: tools.closePositionMarketTool,
      manualBorrow: tools.manualBorrowTool,
      manualRepay: tools.manualRepayTool,
    };

    // Langfuse will be lazily initialized in generate()
  }

  private getOrCreateThread(threadId: string): ConversationThread {
    if (!this.conversations.has(threadId)) {
      this.conversations.set(threadId, {
        id: threadId,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    }
    return this.conversations.get(threadId)!;
  }

  private convertToolsToOpenAIFormat(): any[] {
    return Object.entries(this.tools).map(([name, tool]) => ({
      type: 'function',
      function: {
        name,
        description: tool.description,
        parameters: zodToOpenAISchema(tool.parameters)
      }
    }));
  }

  private cleanMessageHistory(messages: ConversationMessage[]): ConversationMessage[] {
    const cleanedMessages: ConversationMessage[] = [];

    for (let i = 0; i < messages.length; i++) {
      const message = messages[i];

      if (message.role === 'tool') {
        // Look for the corresponding assistant message with tool_calls
        const lastAssistantIndex = this.findLastAssistantWithToolCalls(cleanedMessages);

        if (lastAssistantIndex !== -1) {
          // Check if this tool message corresponds to any tool call in that assistant message
          const assistantMessage = cleanedMessages[lastAssistantIndex];
          const correspondingToolCall = assistantMessage.tool_calls?.find(
            tc => tc.id === message.tool_call_id
          );

          if (correspondingToolCall) {
            cleanedMessages.push(message);
          }
          // If no corresponding tool call found, skip this tool message
        } else {
          // No preceding assistant message with tool calls, skip this tool message
          console.log(`⚠️ MESSAGE CLEANUP: Skipping orphaned tool message: ${message.tool_call_id}`);
        }
      } else {
        cleanedMessages.push(message);
      }
    }

    return cleanedMessages;
  }

  private findLastAssistantWithToolCalls(messages: ConversationMessage[]): number {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'assistant' && messages[i].tool_calls && messages[i].tool_calls!.length > 0) {
        return i;
      }
    }
    return -1;
  }

  async generate(prompt: string, options: { threadId: string }): Promise<{ text: string }> {
    // Lazy init Langfuse
    if (!this.langfuse && process.env.LANGFUSE_SECRET_KEY && process.env.LANGFUSE_PUBLIC_KEY && process.env.LANGFUSE_HOST) {
      try {
        // Use dynamic require to avoid type import
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const mod: any = require('langfuse');
        const LangfuseCtor = mod.Langfuse || mod.default || mod;
        this.langfuse = new LangfuseCtor({
          secretKey: process.env.LANGFUSE_SECRET_KEY,
          publicKey: process.env.LANGFUSE_PUBLIC_KEY,
          baseUrl: process.env.LANGFUSE_HOST,
          environment: process.env.NODE_ENV || 'development',
        });
      } catch (e) {
        console.warn('Langfuse dynamic import failed:', e instanceof Error ? e.message : String(e));
      }
    }
    const thread = this.getOrCreateThread(options.threadId);

    // Langfuse trace per thread
    const lfTrace = this.langfuse?.trace({
      id: options.threadId,
      name: 'trading-session',
      userId: 'autonomous-trading-agent',
      metadata: { initialPromptChars: prompt.length }
    });

    // Add user message to thread
    thread.messages.push({
      role: 'user',
      content: prompt,
    });

    console.log(`\n🔄 === CONVERSATION ITERATION START (Thread: ${options.threadId}) ===`);
    console.log(`📥 USER MESSAGE: ${prompt}`);

    try {
      let maxIterations = 25;
      let iteration = 0;
      let finalResponse = '';

      while (iteration < maxIterations) {
        iteration++;
        console.log(`\n🔁 Iteration ${iteration}/${maxIterations}`);

        // Prepare messages for API - filter out orphaned tool messages
        const cleanMessages = this.cleanMessageHistory(thread.messages);
        const messages: ConversationMessage[] = [
          {
            role: 'system',
            content: this.instructions,
          },
          ...cleanMessages
        ];

        console.log(`📝 Messages being sent to API: ${messages.length} total`);
        console.log(`   - System: 1 message`);
        console.log(`   - Conversation: ${cleanMessages.length} messages`);

        // Prepare tools for API
        const toolsForAPI = this.convertToolsToOpenAIFormat();

        // Make API call
        const requestBody = {
          model: this.model,
          messages,
          ...(toolsForAPI.length > 0 && {
            tools: toolsForAPI,
            tool_choice: 'auto',
          }),
        };

        console.log(`🔧 Available tools: ${toolsForAPI.length}`);
        const lfGen = this.langfuse?.generation({
          traceId: options.threadId,
          name: 'llm:chat-completion',
          model: this.model,
          input: JSON.stringify(requestBody).slice(0, 8000),
        });
        const response = await fetch(`${this.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('❌ API Error Response:', errorText);
          lfGen?.update?.({ level: 'ERROR', output: errorText.slice(0, 8000) });
          throw new Error(`API request failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result = await response.json() as OpenAIResponse;
        const message = result.choices[0].message;
        lfGen?.update?.({ output: (message.content || '').slice(0, 8000) });

        console.log(`\n📤 ASSISTANT RESPONSE:`);
        if (message.content) {
          console.log(`💬 Content: ${message.content}`);
        }
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`🔧 Tool calls: ${message.tool_calls.length}`);
          message.tool_calls.forEach((toolCall, index) => {
            console.log(`   ${index + 1}. ${toolCall.function.name}`);
            console.log(`      ID: ${toolCall.id}`);
            console.log(`      Parameters: ${toolCall.function.arguments}`);
          });
        }

        // Add assistant response to thread (always, even if it has tool calls)
        thread.messages.push({
          role: 'assistant',
          content: message.content || '',
          tool_calls: message.tool_calls,
        });

        if (message.content) {
          finalResponse = message.content;
        }

        // Handle tool calls if any
        if (message.tool_calls && message.tool_calls.length > 0) {
          console.log(`\n🛠️ EXECUTING ${message.tool_calls.length} TOOL CALL(S):`);

          for (const [index, toolCall] of message.tool_calls.entries()) {
            console.log(`\n   🔧 Tool ${index + 1}/${message.tool_calls.length}: ${toolCall.function.name}`);
            console.log(`      Call ID: ${toolCall.id}`);

            try {
              // Parse tool arguments
              const args = JSON.parse(toolCall.function.arguments);
              console.log(`      📥 Parameters:`, JSON.stringify(args, null, 2));

              // Execute the tool
              console.log(`      ⏳ Executing...`);
              const startTime = Date.now();
              const lfSpan = this.langfuse?.span({
                traceId: options.threadId,
                name: `tool:${toolCall.function.name}`,
                input: JSON.stringify(args).slice(0, 8000),
              });
              const toolResult = await this.executeTool(toolCall.function.name, args);
              const duration = Date.now() - startTime;

              console.log(`      ✅ Success (${duration}ms)`);
              console.log(`      📤 Result:`, typeof toolResult === 'object' ?
                JSON.stringify(toolResult, null, 2).substring(0, 500) + (JSON.stringify(toolResult).length > 500 ? '...[truncated]' : '') :
                toolResult);

              // Truncate large tool results to stay within context limits
              const toolResultString = JSON.stringify(toolResult);
              lfSpan?.update?.({ output: toolResultString.slice(0, 8000) });

              // Add tool result to thread
              thread.messages.push({
                role: 'tool',
                content: toolResultString,
                tool_call_id: toolCall.id,
              });

            } catch (error) {
              console.log(`      ❌ Failed: ${error instanceof Error ? error.message : 'Unknown error'}`);

              // Add error result to thread
              const errorResult = {
                error: error instanceof Error ? error.message : 'Unknown error'
              };
              this.langfuse?.event?.({ traceId: options.threadId, name: 'tool-error', input: toolCall.function.name, output: JSON.stringify(errorResult).slice(0, 2000), level: 'ERROR' });
              thread.messages.push({
                role: 'tool',
                content: JSON.stringify(errorResult),
                tool_call_id: toolCall.id,
              });
            }
          }

          console.log(`\n🔄 Continuing conversation with tool results...`);
          // Continue the conversation to let the agent see tool results
          continue;
        } else {
          // No more tool calls, we're done
          console.log(`\n✅ No more tool calls - conversation complete`);
          break;
        }
      }

      console.log(`\n🏁 === CONVERSATION COMPLETE ===`);
      console.log(`📊 Final Stats:`);
      console.log(`   - Total iterations: ${iteration}`);
      console.log(`   - Final response length: ${finalResponse.length} characters`);
      console.log(`   - Thread messages: ${thread.messages.length}`);
      console.log(`   - Thread updated: ${new Date().toISOString()}`);

      if (finalResponse) {
        console.log(`\n💬 FINAL RESPONSE:`);
        console.log(finalResponse);
      }

      thread.updatedAt = new Date();
      lfTrace?.update?.({ metadata: { finalResponseChars: finalResponse.length } });
      await this.langfuse?.flush?.();
      return { text: finalResponse };
    } catch (error) {
      console.error('❌ ERROR in agent generation:', error);
      this.langfuse?.event?.({ traceId: options.threadId, name: 'agent-error', output: error instanceof Error ? error.message : String(error), level: 'ERROR' });
      await this.langfuse?.flush?.();
      throw error;
    }
  }

  private async executeTool(toolName: string, args: any): Promise<any> {
    const tool = this.tools[toolName];
    if (!tool) {
      throw new Error(`Tool ${toolName} not found`);
    }

    // Execute the tool with the provided arguments
    return await tool.execute(args);
  }

  // Helper methods for debugging and inspection
  getConversationHistory(threadId: string): ConversationMessage[] {
    const thread = this.conversations.get(threadId);
    return thread ? [...thread.messages] : [];
  }

  clearConversationHistory(threadId: string): void {
    this.conversations.delete(threadId);
  }

  getThreadIds(): string[] {
    return Array.from(this.conversations.keys());
  }
}

export const tradingAgent = new TradingAgent();