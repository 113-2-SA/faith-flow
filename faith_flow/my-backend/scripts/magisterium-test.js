// my-backend/scripts/magisterium-test.js
// 測試 API Key 版本的 magisteriumMcp.js
require("dotenv").config({ path: require("path").join(__dirname, "../.env") });

const mcp = require("../services/magisteriumMcp");

(async () => {
  console.log("=== 1. listTools ===");
  const tools = mcp.listTools();
  console.log(JSON.stringify(tools, null, 2));

  console.log("\n=== 2. search ===");
  const s = await mcp.search("What does the Catholic Church teach about confession?");
  console.log("results count:", s.results.length);
  console.log("first result:", JSON.stringify(s.results[0], null, 2));

  console.log("\n=== 3. chat ===");
  const c = await mcp.chat("What does the Catholic Church teach about confession?");
  console.log("answer (first 300 chars):", c.answer.slice(0, 300));
  console.log("citations count:", c.citations.length);
  if (c.citations.length > 0) {
    console.log("first citation:", JSON.stringify(c.citations[0], null, 2));
  }
})().catch((e) => {
  console.error("❌ test failed:", e.message);
  process.exit(1);
});