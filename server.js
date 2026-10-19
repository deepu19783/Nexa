import { createServer } from "node:http";
import { readFile, readFileSync } from "node:fs";
import { extname, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { generateChatReply, normalizeChatMessages } from "./lib/chat-service.js";

const root = resolve(fileURLToPath(new URL(".", import.meta.url)));
const port = Number(process.env.PORT || 3000);

function loadLocalEnv() {
  try {
    const contents = readFileSync(resolve(root, ".env"), "utf8");
    for (const line of contents.split(/\r?\n/)) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!match || match[1] in process.env) continue;

      let value = match[2];
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      process.env[match[1]] = value;
    }
  } catch {
  }
}

loadLocalEnv();

function getConfiguredKey(name) {
  const key = process.env[name]?.trim();
  return key && key !== "put_your_api_key_here" ? key : null;
}

function sendJson(response, status, data) {
  response.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

async function readJson(request) {
  const chunks = [];
  let size = 0;

  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Request body is too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function handleChat(request, response) {
  let body;
  try {
    body = await readJson(request);
  } catch (error) {
    sendJson(response, error.statusCode || 400, { error: "Request JSON valid nahi hai." });
    return;
  }

  try {
    const messages = normalizeChatMessages(body);
    const result = await generateChatReply(messages);
    sendJson(response, 200, result);
  } catch (error) {
    sendJson(response, error.statusCode || 502, { error: error.message || "Chat request failed." });
  }
}

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
};

const server = createServer(async (request, response) => {
  const requestUrl = new URL(request.url, `http://127.0.0.1:${port}`);

  if (requestUrl.pathname === "/api/chat" && request.method === "POST") {
    await handleChat(request, response);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    sendJson(response, 405, { error: "Method not allowed." });
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(requestUrl.pathname);
  } catch {
    sendJson(response, 400, { error: "Invalid URL." });
    return;
  }

  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  if (relativePath.split(/[\\/]/).some((part) => part.startsWith("."))) {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  const filePath = resolve(root, relativePath);
  if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  readFile(filePath, (error, contents) => {
    if (error) {
      sendJson(response, 404, { error: "Not found." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream",
    });
    response.end(request.method === "HEAD" ? undefined : contents);
  });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Nexa AI local server: http://127.0.0.1:${port}`);
  const available = ["GEMINI_API_KEY", "GROQ_API_KEY"]
    .filter((name) => getConfiguredKey(name));
  if (process.env.ENABLE_PAID_OPENAI_FALLBACK === "true" && getConfiguredKey("OPENAI_API_KEY")) {
    available.push("OpenAI paid fallback");
  }
  console.log(available.length ? `Configured providers: ${available.join(", ")}` : "Add a Gemini or Groq key to .env before chatting.");
});