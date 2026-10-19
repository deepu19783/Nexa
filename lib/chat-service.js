const systemPrompt =
  "You are Nexa AI, a helpful assistant. Reply in the language used by the user, including Hindi and Hinglish. Be accurate and clear. If asked who created, built, developed, or made you, say that you were created by Md Ibrahim and his team.";

function createError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getConfiguredKey(env, name) {
  const key = env[name]?.trim();
  return key && key !== "put_your_api_key_here" ? key : null;
}

export function normalizeChatMessages(body) {
  if (!Array.isArray(body?.messages) || body.messages.length === 0 || body.messages.length > 20) {
    throw createError("1 se 20 chat messages bhejein.", 400);
  }

  const messages = body.messages
    .filter((item) =>
      item &&
      ["user", "assistant"].includes(item.role) &&
      typeof item.content === "string" &&
      item.content.trim().length > 0 &&
      item.content.length <= 12000
    )
    .map(({ role, content }) => ({ role, content: content.trim() }));

  if (messages.length === 0 || messages.at(-1).role !== "user") {
    throw createError("Aakhri message user ka hona chahiye.", 400);
  }

  return messages;
}

async function readProviderResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || `HTTP ${response.status}`);
  }
  return result;
}

async function generateWithGemini(messages, apiKey) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map(({ role, content }) => ({
          role: role === "assistant" ? "model" : "user",
          parts: [{ text: content }],
        })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );
  const result = await readProviderResponse(response);
  const reply = result?.candidates?.[0]?.content?.parts
    ?.map((part) => part.text || "")
    .join("")
    .trim();
  if (!reply) throw new Error("Gemini returned an empty response.");
  return reply;
}

async function generateWithOpenAICompatible(messages, apiKey, endpoint, model) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "system", content: systemPrompt }, ...messages],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  const result = await readProviderResponse(response);
  const reply = result?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new Error("Provider returned an empty response.");
  return reply;
}

export async function generateChatReply(messages, env = process.env) {
  const providers = [];
  const geminiKey = getConfiguredKey(env, "GEMINI_API_KEY");
  const groqKey = getConfiguredKey(env, "GROQ_API_KEY");

  if (geminiKey) {
    providers.push({
      name: "Gemini",
      generate: () => generateWithGemini(messages, geminiKey),
    });
  }
  if (groqKey) {
    providers.push({
      name: "Groq",
      generate: () => generateWithOpenAICompatible(
        messages,
        groqKey,
        "https://api.groq.com/openai/v1/chat/completions",
        "openai/gpt-oss-20b"
      ),
    });
  }

  const openAiKey = getConfiguredKey(env, "OPENAI_API_KEY");
  if (openAiKey && env.ENABLE_PAID_OPENAI_FALLBACK === "true") {
    providers.push({
      name: "OpenAI",
      generate: () => generateWithOpenAICompatible(
        messages,
        openAiKey,
        "https://api.openai.com/v1/chat/completions",
        "gpt-4o-mini"
      ),
    });
  }

  if (providers.length === 0) {
    throw createError(
      "Free options ke liye GEMINI_API_KEY ya GROQ_API_KEY configure karein. Paid OpenAI fallback optional hai.",
      503
    );
  }

  const failures = [];
  for (const provider of providers) {
    try {
      return { reply: await provider.generate(), selectedProvider: provider.name };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Request failed.";
      console.warn(`${provider.name} request failed: ${message}`);
      failures.push(`${provider.name}: ${message}`);
    }
  }

  throw createError(
    `Configured AI providers failed. Check API keys, free-tier quotas and model access. ${failures.join(" | ")}`,
    502
  );
}
