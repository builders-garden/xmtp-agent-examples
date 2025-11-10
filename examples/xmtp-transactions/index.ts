import { Agent, validHex } from "@xmtp/agent-sdk";
import { logDetails } from "@xmtp/agent-sdk/debug";
import { CommandRouter } from "@xmtp/agent-sdk/middleware";
import { ContentTypeWalletSendCalls } from "@xmtp/content-type-wallet-send-calls";
import { getEncryptionKeyFromString } from "../../utils/general";
import { USDCHandler } from "../../utils/usdc";
import { type TransactionReference } from "@xmtp/content-type-transaction-reference";
import dotenv from "dotenv";

dotenv.config();

const NETWORK_ID = process.env.NETWORK_ID || "base-mainnet";

const usdcHandler = new USDCHandler(NETWORK_ID);

const dbEncryptionKey = process.env.XMTP_DB_ENCRYPTION_KEY
  ? getEncryptionKeyFromString(process.env.XMTP_DB_ENCRYPTION_KEY)
  : undefined;
console.log("XMTP network from env", process.env.XMTP_ENV);
console.log("Base network from env", NETWORK_ID);

const agent = await Agent.createFromEnv({
  env: process.env.XMTP_ENV as "local" | "dev" | "production",
  dbEncryptionKey,
});

const router = new CommandRouter();

router.command("/balance", async (ctx) => {
  const agentAddress = agent.address;
  const senderAddress = await ctx.getSenderAddress();

  const agentBalance = await usdcHandler.getUSDCBalance(validHex(agentAddress));
  const senderBalance = await usdcHandler.getUSDCBalance(
    validHex(senderAddress),
  );

  await ctx.sendText(
    `My USDC balance is: ${agentBalance} USDC\n` +
      `Your USDC balance is: ${senderBalance} USDC`,
  );
});

router.command("/tx", async (ctx) => {
  const agentAddress = agent.address;
  const senderAddress = await ctx.getSenderAddress();

  const amount = parseFloat(ctx.message.content.split(" ")[1]);
  if (isNaN(amount) || amount <= 0) {
    await ctx.sendText("Please provide a valid amount. Usage: /tx <amount>");
    return;
  }

  // Convert amount to USDC decimals (6 decimal places)
  const amountInDecimals = Math.floor(amount * Math.pow(10, 6));

  const walletSendCalls = usdcHandler.createUSDCTransferCalls(
    validHex(senderAddress),
    validHex(agentAddress),
    amountInDecimals,
  );
  console.log("Replied with wallet sendcall");
  await ctx.conversation.send(walletSendCalls, ContentTypeWalletSendCalls);

  // Send a follow-up message about transaction references
  await ctx.sendText(
    `💡 After completing the transaction, you can send a transaction reference message to confirm completion.`,
  );
});

router.default(async (ctx) => {
  await ctx.sendText(
    "Available commands:\n" +
      "/balance - Check your USDC balance\n" +
      "/tx <amount> - Send USDC to the agent (e.g. /tx 0.1)",
  );
});

agent.on("start", () => {
  console.log(`Waiting for messages...`);
  console.log(`Address: ${agent.address}`);
  console.log(`🔗${logDetails(agent.client)}`);
});

agent.on("transaction-reference", async (ctx) => {
  const senderAddress = await ctx.getSenderAddress();
  console.log(`Transaction reference message received from ${senderAddress}`);

  // expected from xmtp.chat
  let transactionRef: TransactionReference;
  transactionRef = ctx.message.content;
  if (transactionRef.reference) {
    console.log("[XMTP CHAT] ctx.message received", ctx.message);
    // from xmtp.chat
    console.log(
      `[XMTP CHAT] Transaction reference message received ${transactionRef.reference}, networkId ${transactionRef.networkId}`,
    );
  } else {
    // from the base app
    console.log("[BASE APP] ctx.message received", ctx.message);
    console.log(
      `[BASE APP] EXPECTED transaction reference decoded ${transactionRef?.reference}, networkId ${transactionRef?.networkId}`,
    );
    transactionRef = (
      ctx.message.content as unknown as {
        transactionReference: TransactionReference;
      }
    ).transactionReference;
    console.log(
      `[BASE APP] REAL transaction reference decoded received ${transactionRef.reference}, networkId ${transactionRef.networkId}`,
    );
  }

  await ctx.sendText(
    `✅ Transaction confirmed!\n` +
      `🔗 Network: ${transactionRef.networkId}\n` +
      `📄 Hash: ${transactionRef.reference}\n` +
      `${transactionRef.metadata ? `📝 Transaction metadata received` : ""}`,
  );
});

agent.use(router.middleware());
await agent.start();
