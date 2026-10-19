
import { supabase, supabaseConfigured } from "./supabase.js";

let conversation = [];
let currentChatId = null;
let isSending = false;

const $ = (id) => document.getElementById(id);
const nexaLogoUrl = new URL("../assets/nexa-logo.jpg", import.meta.url).href;

function addNexaAvatar(container) {
  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  const logo = document.createElement("img");
  logo.src = nexaLogoUrl;
  logo.alt = "Nexa AI";
  avatar.appendChild(logo);
  container.appendChild(avatar);
}

function showToast(message) {
  const toast = $("toast");
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2800);
}

function addMessage(role, content) {
  const messages = $("messages");
  const row = document.createElement("article");
  row.className = `message ${role}`;

  const contentBox = document.createElement("div");
  contentBox.className = "message-content";

  // Text is inserted safely; AI output is never treated as raw HTML.
  contentBox.textContent = content;

  if (role === "assistant") {
    addNexaAvatar(row);
    row.appendChild(contentBox);
  } else {
    row.append(contentBox);
  }

  messages.appendChild(row);
  $("welcome").classList.add("hidden");
  messages.classList.remove("hidden");
  row.scrollIntoView({ behavior: "smooth", block: "end" });

  return contentBox;
}

function showTyping() {
  const row = document.createElement("article");
  row.className = "message assistant";
  row.id = "typingIndicator";

  const dots = document.createElement("div");
  dots.className = "typing";
  dots.innerHTML = "<span></span><span></span><span></span>";

  addNexaAvatar(row);
  row.appendChild(dots);
  $("messages").appendChild(row);
  row.scrollIntoView({ behavior: "smooth", block: "end" });
}

function hideTyping() {
  $("typingIndicator")?.remove();
}

export function resetChat() {
  conversation = [];
  currentChatId = null;
  $("messages").replaceChildren();
  $("messages").classList.add("hidden");
  $("welcome").classList.remove("hidden");
  $("messageInput").value = "";
}

export async function sendMessage(text) {
  const message = text.trim();

  if (!message || isSending) return;

  if (!supabaseConfigured || !supabase) {
    showToast("Login aur history ke liye Supabase setup check karein.");
    return;
  }

  const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
  if (sessionError || !sessionData.session) {
    window.location.href = "login.html";
    return;
  }
  const userId = sessionData.session.user.id;

  isSending = true;
  $("sendButton").disabled = true;
  $("messageInput").value = "";

  conversation.push({ role: "user", content: message });
  addMessage("user", message);
  showTyping();

  try {
    await saveUserMessage(userId, message);

    const response = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: conversation.slice(-20) }),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      if (response.status === 404) {
        throw new Error(window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
          ? "Local server nahi chal raha. `npm start` chalakar app kholen."
          : "Chat function deploy nahi hui. Netlify Functions configuration check karein.");
      }
      if (response.status === 405) {
        throw new Error(window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
          ? "Live Server se chat API nahi chalti. Terminal me `npm start` chalayein."
          : "Chat endpoint par POST request allow nahi hui. Netlify function route check karein.");
      }
      throw new Error(data?.error || `Request failed (HTTP ${response.status}).`);
    }
    if (!data || typeof data.reply !== "string") {
      throw new Error("AI se valid response nahi mila.");
    }

    hideTyping();
    conversation.push({ role: "assistant", content: data.reply });
    const answer = addMessage("assistant", data.reply);

    const answerSource = document.createElement("small");
    answerSource.className = "answer-source";
    answerSource.textContent = "Answered by Nexa.";
    answer.appendChild(answerSource);

    try {
      await saveAssistantMessage(userId, data.reply);
    } catch (error) {
      console.error("Could not save chat history:", error);
      showToast("Answer mil gaya, lekin history save nahi hui. Database policies check karein.");
    }
  } catch (error) {
    hideTyping();
    conversation.pop();
    const message = error instanceof TypeError
      ? (window.location.hostname === "127.0.0.1" || window.location.hostname === "localhost"
        ? "Local AI server se connection nahi hua. `npm start` chalakar app kholen."
        : "Chat service se connection nahi hua. Netlify function deployment check karein.")
      : error.message || "Unknown error";
    addMessage("assistant", `Sorry, ${message}`);
  } finally {
    isSending = false;
    $("sendButton").disabled = false;
    $("messageInput").focus();
  }
}

async function saveUserMessage(userId, userMessage) {
  let createdChat = false;

  if (!currentChatId) {
    const { data: chat, error } = await supabase
      .from("chats")
      .insert({
        user_id: userId,
        title: userMessage.slice(0, 60) || "New chat",
      })
      .select("id")
      .single();

    if (error) throw error;
    currentChatId = chat.id;
    createdChat = true;
  }

  const { error: saveError } = await supabase.from("messages").insert({
    chat_id: currentChatId,
    user_id: userId,
    role: "user",
    content: userMessage,
  });

  if (saveError) {
    if (createdChat) {
      await supabase.from("chats").delete().eq("id", currentChatId);
      currentChatId = null;
    }
    throw saveError;
  }

  window.dispatchEvent(new CustomEvent("nexa:chat-updated"));
}

async function saveAssistantMessage(userId, assistantMessage) {
  const { error: saveError } = await supabase.from("messages").insert({
    chat_id: currentChatId,
    user_id: userId,
    role: "assistant",
    content: assistantMessage,
  });

  if (saveError) throw saveError;

  const { error: updateError } = await supabase
    .from("chats")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", currentChatId)
    .eq("user_id", userId);

  if (updateError) throw updateError;
  window.dispatchEvent(new CustomEvent("nexa:chat-updated"));
}

export function getCurrentConversation() {
  return {
    chatId: currentChatId,
    messages: [...conversation]
  };
}

export async function openChat(chatId) {
  if (!supabaseConfigured || !supabase) {
    return { error: "Supabase setup pending hai." };
  }

  const { data: chat, error: chatError } = await supabase
    .from("chats")
    .select("id")
    .eq("id", chatId)
    .single();

  if (chatError || !chat) return { error: "Chat nahi khul saki." };

  const { data: rows, error: messagesError } = await supabase
    .from("messages")
    .select("role, content")
    .eq("chat_id", chatId)
    .order("created_at", { ascending: true });

  if (messagesError) return { error: messagesError.message };

  currentChatId = chatId;
  conversation = [];
  $("messages").replaceChildren();
  $("welcome").classList.add("hidden");
  $("messages").classList.remove("hidden");

  for (const row of rows || []) {
    if (!["user", "assistant"].includes(row.role)) continue;
    conversation.push({ role: row.role, content: row.content });
    addMessage(row.role, row.content);
  }

  $("sidebar").classList.remove("open");
  $("mobileOverlay").classList.remove("show");
  return { error: null };
}
