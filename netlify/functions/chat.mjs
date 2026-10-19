import { generateChatReply, normalizeChatMessages } from "../../lib/chat-service.js";

function jsonResponse(statusCode, data) {
  return {
    statusCode,
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify(data),
  };
}

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "Method not allowed." });
  }

  let body;
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, { error: "Request JSON valid nahi hai." });
  }

  try {
    const messages = normalizeChatMessages(body);
    const result = await generateChatReply(messages);
    return jsonResponse(200, result);
  } catch (error) {
    return jsonResponse(error.statusCode || 502, {
      error: error.message || "Chat request failed.",
    });
  }
}
