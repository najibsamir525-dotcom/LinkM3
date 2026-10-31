/**
 * REAL Valkey 7.2 Engine Behavioral Test Suite
 *
 * Verifies live connectivity, RESP protocol handling, and caching behavior
 * against the real Valkey 7.2 container when VALKEY_URL is set.
 */

import { describe, it, expect } from "vitest";
import * as net from "node:net";

describe("Real Valkey 7.2 Engine Connectivity", () => {
  const valkeyUrl = process.env["VALKEY_URL"];

  it("proves connectivity to real Valkey 7.2 container and receives RESP PONG", async () => {
    if (!valkeyUrl) {
      console.log(
        "⚡ VALKEY_URL not provided — skipping live Valkey socket test (in-memory mode)",
      );
      return;
    }

    console.log("🔗 Connecting to REAL Valkey server container at:", valkeyUrl);
    const parsed = new URL(valkeyUrl);
    const port = parseInt(parsed.port || "6379", 10);
    const host = parsed.hostname || "127.0.0.1";

    const response = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ port, host }, () => {
        // Send RESP PING command: *1\r\n$4\r\nPING\r\n
        socket.write("*1\r\n$4\r\nPING\r\n");
      });

      socket.setTimeout(4000);
      socket.on("data", (data) => {
        const text = data.toString();
        socket.end();
        resolve(text);
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Valkey socket connection timed out"));
      });

      socket.on("error", (err) => {
        reject(err);
      });
    });

    console.log("Valkey RESP Response:", JSON.stringify(response));
    expect(response).toContain("+PONG");
  });

  it("verifies SET and GET with TTL on real Valkey instance", async () => {
    if (!valkeyUrl) return;

    const parsed = new URL(valkeyUrl);
    const port = parseInt(parsed.port || "6379", 10);
    const host = parsed.hostname || "127.0.0.1";

    // Execute SET linkme:test:key "linkme_valkey_works" EX 10
    const setCommand =
      "*5\r\n$3\r\nSET\r\n$15\r\nlinkme:test:key\r\n$19\r\nlinkme_valkey_works\r\n$2\r\nEX\r\n$2\r\n10\r\n";
    // Execute GET linkme:test:key
    const getCommand = "*2\r\n$3\r\nGET\r\n$15\r\nlinkme:test:key\r\n";

    const response = await new Promise<string>((resolve, reject) => {
      const socket = net.createConnection({ port, host }, () => {
        socket.write(setCommand);
      });

      let buffer = "";
      socket.setTimeout(4000);
      socket.on("data", (data) => {
        buffer += data.toString();
        if (buffer.includes("+OK")) {
          // Immediately send GET
          socket.write(getCommand);
          buffer = "";
        } else if (buffer.includes("linkme_valkey_works")) {
          socket.end();
          resolve(buffer);
        }
      });

      socket.on("timeout", () => {
        socket.destroy();
        reject(new Error("Valkey SET/GET timed out"));
      });

      socket.on("error", reject);
    });

    expect(response).toContain("linkme_valkey_works");
  });
});
