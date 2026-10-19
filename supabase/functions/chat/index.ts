
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type ChatMessage = { role: "user" | "assistant"; content: string };
type Candidate = { provider: string; reply: string };
type Provider = {
  name: string;
  generate: (messages: ChatMessage[]) => Promise<string>;
};

const systemPrompt =
  "You are Nexa AI, a helpful, honest and friendly AI assistant. " +
  "Respond in the language used by the user. Support Hindi, Hinglish " +
  "and English. Explain coding step by step when helpful. Never claim " +
  "you performed an action you did not perform. If unsure, say so.";

async function generateWithGemini(
  messages: ChatMessage[],
  apiKey: string
): Promise<string> {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent",
    {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: messages.map((item) => ({
          role: item.role === "assistant" ? "model" : "user",
          parts: [{ text: item.content }],
        })),
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || `HTTP ${response.status}`);
  }

  const reply = result?.candidates?.[0]?.content?.parts
    ?.map((part: { text?: string }) => part.text || "")
    .join("")
    .trim();
  if (!reply) throw new Error("Gemini returned an empty response.");
  return reply;
}

async function generateWithOpenAICompatible(
  messages: ChatMessage[],
  apiKey: string,
  endpoint: string,
  model: string
): Promise<string> {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result?.error?.message || `HTTP ${response.status}`);
  }

  const reply = result?.choices?.[0]?.message?.content?.trim();
  if (typeof reply !== "string" || !reply) {
    throw new Error("Provider returned an empty response.");
  }
  return reply;
}

async function selectBestAnswer(
  question: string,
  candidates: Candidate[],
  judges: Provider[]
): Promise<{ candidate: Candidate; selectedBy: string }> {
  if (candidates.length === 1) {
    return { candidate: candidates[0], selectedBy: candidates[0].provider };
  }

  const prompt =
    "Choose the most accurate, relevant, complete and clear answer to the user's question. " +
    "Do not prefer an answer just because it is longer. If uncertain, choose the safest " +
    "well-supported answer. Return only the candidate number.\n\n" +
    `Question:\n${question}\n\nCandidates:\n${candidates.map((item, index) =>
      `${index + 1}. ${item.provider}: ${item.reply.slice(0, 6000)}`
    ).join("\n\n")}`;

  for (const judge of judges) {
    try {
      const result = await judge.generate([{ role: "user", content: prompt }]);
      const match = result.match(/^\s*([1-9]\d*)\s*$/);
      const index = match ? Number(match[1]) - 1 : -1;
      if (index >= 0 && index < candidates.length) {
        return { candidate: candidates[index], selectedBy: judge.name };
      }
    } catch (error) {
      console.warn(`${judge.name} could not rank AI answers:`, error);
    }
  }

  return { candidate: candidates[0], selectedBy: "first available provider" };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const geminiKey = Deno.env.get("GEMINI_API_KEY");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const groqKey = Deno.env.get("GROQ_API_KEY");

  if (!supabaseUrl || !serviceRoleKey) {
    const missingSecrets = [
      ["SUPABASE_URL", supabaseUrl],
      ["SUPABASE_SERVICE_ROLE_KEY", serviceRoleKey],
    ].filter(([, value]) => !value).map(([name]) => name);
    return jsonResponse({
      error: `Missing Edge Function configuration: ${missingSecrets.join(", ")}.`,
    }, 500);
  }

  const providers: Provider[] = [];
  if (geminiKey) {
    providers.push({
      name: "Gemini",
      generate: (messages) => generateWithGemini(messages, geminiKey),
    });
  }
  if (openaiKey) {
    providers.push({
      name: "OpenAI",
      generate: (messages) => generateWithOpenAICompatible(
        messages,
        openaiKey,
        "https://api.openai.com/v1/chat/completions",
        "gpt-4o-mini"
      ),
    });
  }
  if (groqKey) {
    providers.push({
      name: "Groq",
      generate: (messages) => generateWithOpenAICompatible(
        messages,
        groqKey,
        "https://api.groq.com/openai/v1/chat/completions",
        "llama-3.3-70b-versatile"
      ),
    });
  }
  if (providers.length === 0) {
    return jsonResponse({
      error: "Configure at least one AI key: GEMINI_API_KEY, OPENAI_API_KEY, or GROQ_API_KEY.",
    }, 500);
  }

  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Please sign in first." }, 401);
  }

  const token = authorization.slice("Bearer ".length);

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: authError } =
    await admin.auth.getUser(token);

  if (authError || !userData.user) {
    return jsonResponse({ error: "Invalid or expired login session." }, 401);
  }

  const userId = userData.user.id;

  let body: {
    messages?: Array<{ role: string; content: string }>;
    chatId?: string | null;
  };

  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body." }, 400);
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return jsonResponse({ error: "A message is required." }, 400);
  }

  if (body.messages.length > 20) {
    return jsonResponse({ error: "Too many messages in one request." }, 400);
  }

  const messages: ChatMessage[] = body.messages
    .filter(
      (item) =>
        item &&
        ["user", "assistant"].includes(item.role) &&
        typeof item.content === "string" &&
        item.content.length <= 12000
    )
    .map((item) => ({
      role: item.role as ChatMessage["role"],
      content: item.content.trim(),
    }))
    .filter((item) => item.content.length > 0);

  const latestMessage = messages[messages.length - 1];

  if (!latestMessage || latestMessage.role !== "user") {
    return jsonResponse({ error: "Last message must be from the user." }, 400);
  }

  let chatId = body.chatId || null;

  if (chatId) {
    const { data: existingChat, error: chatError } = await admin
      .from("chats")
      .select("id")
      .eq("id", chatId)
      .eq("user_id", userId)
      .maybeSingle();

    if (chatError || !existingChat) {
      return jsonResponse({ error: "Chat not found or access denied." }, 404);
    }
  } else {
    const title = latestMessage.content.slice(0, 60) || "New chat";

    const { data: newChat, error: createError } = await admin
      .from("chats")
      .insert({ user_id: userId, title })
      .select("id")
      .single();

    if (createError || !newChat) {
      return jsonResponse({ error: "Could not create chat." }, 500);
    }

    chatId = newChat.id;
  }

  try {
    const results = await Promise.allSettled(
      providers.map(async (provider) => ({
        provider: provider.name,
        reply: await provider.generate(messages),
      }))
    );
    const candidates = results.flatMap((result) =>
      result.status === "fulfilled" ? [result.value] : []
    );

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        console.error(`${providers[index].name} request failed:`, result.reason);
      }
    });

    if (candidates.length === 0) {
      return jsonResponse({
        error: "All configured AI providers failed. Check their API keys, model access and quotas.",
      }, 502);
    }

    const { candidate, selectedBy } = await selectBestAnswer(
      latestMessage.content,
      candidates,
      providers
    );
    const reply = candidate.reply;

    const { error: saveMessagesError } = await admin.from("messages").insert([
      {
        chat_id: chatId,
        user_id: userId,
        role: "user",
        content: latestMessage.content,
      },
      {
        chat_id: chatId,
        user_id: userId,
        role: "assistant",
        content: reply,
      },
    ]);

    if (saveMessagesError) {
      console.error("Could not save chat messages:", saveMessagesError);
      return jsonResponse({ error: "Reply generated, but chat history could not be saved." }, 500);
    }

    await admin
      .from("chats")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", chatId)
      .eq("user_id", userId);

    return jsonResponse({
      reply,
      chatId,
      selectedProvider: candidate.provider,
      providerCount: candidates.length,
      selectedBy,
    });
  } catch (error) {
    console.error("Chat function error:", error);
    return jsonResponse({ error: "Could not contact the AI service." }, 502);
  }
});
