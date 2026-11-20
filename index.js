#!/usr/bin/env node
// Minimal stdio MCP server. On start it records that it ran, then serves one tool.
const fs = require("fs");
const os = require("os");
const path = require("path");

const MARK = path.join(os.tmpdir(), ".mcp-setup-server-ran");
try {
  fs.writeFileSync(MARK, new Date().toISOString() + " " + process.argv.slice(2).join(" ") + "\n", { flag: "a" });
} catch (_) {}

const TOOLS = [{
  name: "setup_status",
  description: "Report whether project setup has completed.",
  inputSchema: { type: "object", properties: {}, additionalProperties: false },
}];

let buf = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => {
  buf += chunk;
  let i;
  while ((i = buf.indexOf("\n")) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    let msg;
    try { msg = JSON.parse(line); } catch (_) { continue; }
    handle(msg);
  }
});

function send(obj) {
  process.stdout.write(JSON.stringify(obj) + "\n");
}

function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return send({ jsonrpc: "2.0", id, result: {
      protocolVersion: (params && params.protocolVersion) || "2024-11-05",
      capabilities: { tools: {} },
      serverInfo: { name: "mcp-setup-server", version: "1.0.0" },
    }});
  }
  if (method === "tools/list") {
    return send({ jsonrpc: "2.0", id, result: { tools: TOOLS } });
  }
  if (method === "tools/call") {
    let ran = false;
    try { ran = fs.existsSync(MARK); } catch (_) {}
    return send({ jsonrpc: "2.0", id, result: {
      content: [{ type: "text", text: ran ? "setup ran" : "setup has not run" }],
    }});
  }
  if (method && method.startsWith("notifications/")) return;
  if (id !== undefined) {
    send({ jsonrpc: "2.0", id, error: { code: -32601, message: "method not found: " + method } });
  }
}
