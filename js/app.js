
import { supabase, supabaseConfigured } from "./supabase.js";
import { applySavedTheme, toggleTheme } from "./theme.js";
import { resetChat, sendMessage } from "./chat.js";
import { initVoice } from "./voice.js";
import { initFiles } from "./files.js";
import { loadChatHistory } from "./history.js";

const $ = (id) => document.getElementById(id);

applySavedTheme();

$("themeButton").addEventListener("click", toggleTheme);

$("newChatButton").addEventListener("click", () => {
  resetChat();
  closeSidebar();
  $("messageInput").focus();
});

$("chatForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await sendMessage($("messageInput").value);
});

$("messageInput").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    $("chatForm").requestSubmit();
  }
});

$("messageInput").addEventListener("input", () => {
  const input = $("messageInput");
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 180)}px`;
});

document.querySelectorAll("[data-prompt]").forEach((button) => {
  button.addEventListener("click", () => {
    $("messageInput").value = button.dataset.prompt;
    $("chatForm").requestSubmit();
  });
});

function openSidebar() {
  $("sidebar").classList.add("open");
  $("mobileOverlay").classList.add("show");
}

function closeSidebar() {
  $("sidebar").classList.remove("open");
  $("mobileOverlay").classList.remove("show");
}

$("openSidebar").addEventListener("click", openSidebar);
$("closeSidebar").addEventListener("click", closeSidebar);
$("mobileOverlay").addEventListener("click", closeSidebar);

$("logoutButton").addEventListener("click", async () => {
  const { error } = await supabase.auth.signOut();
  if (error) alert(`Logout nahi hua: ${error.message}`);
});

async function updateAccountUI() {
  if (!supabaseConfigured || !supabase) {
    $("composerStatus").textContent = "Login aur history ke liye Supabase setup required hai.";
    await loadChatHistory();
    return;
  }

  const { data, error } = await supabase.auth.getSession();
  if (error) console.error("Could not read account session:", error);
  const user = data.session?.user;
  const signedIn = Boolean(user);

  $("accountLink").classList.toggle("hidden", signedIn);
  $("topAccountLink").classList.toggle("hidden", signedIn);
  $("accountRow").classList.toggle("hidden", !signedIn);

  if (signedIn) {
    const metadata = user.user_metadata || {};
    const name = metadata.full_name || metadata.name || user.email?.split("@")[0] || "Account";
    $("accountName").textContent = name;
    $("accountEmail").textContent = user.email || "";
    $("accountAvatar").textContent = name.trim().charAt(0).toUpperCase() || "N";
    $("composerStatus").textContent = "Nexa AI can make mistakes. Check important information.";
  } else {
    $("composerStatus").textContent = "Sign in to chat and save your history.";
  }

  await loadChatHistory();
}

if (supabaseConfigured && supabase) {
  supabase.auth.onAuthStateChange(() => {
    updateAccountUI();
  });
}

window.addEventListener("nexa:chat-updated", loadChatHistory);
initVoice();
initFiles();
updateAccountUI();
