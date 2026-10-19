
import { supabase, supabaseConfigured } from "./supabase.js";
import { openChat } from "./chat.js";

const $ = (id) => document.getElementById(id);

export async function loadChatHistory() {
  const list = $("historyList");
  if (!list) return;

  if (!supabaseConfigured) {
    list.innerHTML = '<p class="muted small">Connect Supabase to save chats.</p>';
    return;
  }

  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    list.innerHTML = '<p class="muted small">Sign in to save your chats.</p>';
    return;
  }

  const { data: chats, error } = await supabase
    .from("chats")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(50);

  if (error) {
    list.textContent = "History load nahi hui.";
    console.error(error);
    return;
  }

  list.replaceChildren();

  if (!chats || chats.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted small";
    empty.textContent = "Your chats will appear here.";
    list.appendChild(empty);
    return;
  }

  for (const chat of chats) {
    const row = document.createElement("div");
    row.className = "history-item";

    const openButton = document.createElement("button");
    openButton.className = "history-item";
    openButton.style.flex = "1";
    openButton.style.minWidth = "0";
    openButton.innerHTML = '<span aria-hidden="true">◷</span>';

    const title = document.createElement("span");
    title.className = "history-title";
    title.textContent = chat.title || "New chat";
    openButton.appendChild(title);

    openButton.addEventListener("click", async () => {
      const { error: openError } = await openChat(chat.id);
      if (openError) alert(openError);
    });

    const menu = document.createElement("button");
    menu.className = "history-menu";
    menu.textContent = "⋯";
    menu.title = "Chat options";

    menu.addEventListener("click", async () => {
      const choice = prompt(
        "Type R to rename this chat, or D to delete it."
      );

      if (!choice) return;

      if (choice.toLowerCase() === "r") {
        const newTitle = prompt("Enter a new chat title:", chat.title);

        if (!newTitle?.trim()) return;

        const { error } = await supabase
          .from("chats")
          .update({ title: newTitle.trim() })
          .eq("id", chat.id);

        if (error) alert(error.message);
        else loadChatHistory();
      }

      if (choice.toLowerCase() === "d") {
        if (!confirm("Delete this chat and its messages?")) return;

        const { error } = await supabase
          .from("chats")
          .delete()
          .eq("id", chat.id);

        if (error) alert(error.message);
        else loadChatHistory();
      }
    });

    row.append(openButton, menu);
    list.appendChild(row);
  }
}
