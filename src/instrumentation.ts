import 'dotenv/config';
import { NodeSDK } from "@opentelemetry/sdk-node";
import { LangfuseSpanProcessor } from "@langfuse/otel";

const processor = new LangfuseSpanProcessor({
  publicKey: process.env.LANGFUSE_PUBLIC_KEY,
  secretKey: process.env.LANGFUSE_SECRET_KEY,
  baseUrl: process.env.LANGFUSE_BASE_URL, // e.g. https://cloud.langfuse.com
  exportMode: process.env.NODE_ENV === 'production' ? 'batched' : 'immediate',
  environment: process.env.NODE_ENV || 'development',
});

const sdk = new NodeSDK({
  spanProcessors: [processor],
});

sdk.start();

process.on('beforeExit', async () => {
  await sdk.shutdown();
});
process.on('SIGTERM', async () => {
  await sdk.shutdown();
});
