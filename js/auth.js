import { supabase, supabaseConfigured } from "./supabase.js";

const message = document.getElementById("authMessage");

function showMessage(text, state = "") {
  if (!message) return;
  message.textContent = text;
  message.classList.toggle("error", state === "error");
  message.classList.toggle("success", state === "success");
}

function setBusy(form, busy, label) {
  const button = form.querySelector('button[type="submit"]');
  button.disabled = busy;
  button.textContent = busy ? "Please wait..." : label;
}

function checkSupabase() {
  if (supabaseConfigured && supabase) return true;
  showMessage("Supabase sign-in is not configured. Please contact the site administrator.", "error");
  return false;
}

const loginForm = document.getElementById("loginForm");
if (loginForm) {
  const submitLabel = loginForm.querySelector('button[type="submit"]').textContent;
  showMessage("");

  loginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!checkSupabase()) return;

    setBusy(loginForm, true, submitLabel);
    showMessage("");
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: document.getElementById("email").value.trim(),
        password: document.getElementById("password").value,
      });
      if (error) throw error;
      window.location.assign("index.html");
    } catch (error) {
      showMessage(error.message || "Login failed. Please try again.", "error");
      setBusy(loginForm, false, submitLabel);
    }
  });

  const googleButton = document.getElementById("googleSignIn");
  googleButton?.addEventListener("click", async () => {
    if (!checkSupabase()) return;
    googleButton.disabled = true;
    showMessage("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: new URL("index.html", window.location.href).href },
      });
      if (error) throw error;
    } catch (error) {
      showMessage(error.message || "Google sign-in failed. Please try again.", "error");
      googleButton.disabled = false;
    }
  });
}

const signupForm = document.getElementById("signupForm");
if (signupForm) {
  const submitLabel = signupForm.querySelector('button[type="submit"]').textContent;
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
      showMessage("Passwords do not match.", "error");
      return;
    }
    if (!checkSupabase()) return;

    setBusy(signupForm, true, submitLabel);
    showMessage("");
    try {
      const { data, error } = await supabase.auth.signUp({
        email: document.getElementById("email").value.trim(),
        password,
        options: { emailRedirectTo: new URL("index.html", window.location.href).href },
      });
      if (error) throw error;
      if (data.session) {
        window.location.assign("index.html");
        return;
      }
      showMessage("Account created. Check your email to confirm your account.", "success");
      setBusy(signupForm, false, submitLabel);
    } catch (error) {
      showMessage(error.message || "Account creation failed. Please try again.", "error");
      setBusy(signupForm, false, submitLabel);
    }
  });
}

const resetForm = document.getElementById("resetForm");
if (resetForm) {
  const submitButton = document.getElementById("resetSubmit");
  const submitLabel = submitButton.textContent;
  const emailInput = document.getElementById("email");
  const newPassword = document.getElementById("newPassword");
  const emailLabel = document.getElementById("emailLabel");
  const newPasswordLabel = document.getElementById("newPasswordLabel");
  const resetHeading = document.getElementById("resetHeading");
  const resetDescription = document.getElementById("resetDescription");
  let recoveryMode = new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery";

  function setRecoveryMode(enabled) {
    recoveryMode = enabled;
    emailLabel.classList.toggle("hidden", enabled);
    emailInput.required = !enabled;
    newPasswordLabel.classList.toggle("hidden", !enabled);
    newPassword.required = enabled;
    resetHeading.textContent = enabled ? "Choose a new password" : "Reset password";
    resetDescription.textContent = enabled
      ? "Enter a new password for your account."
      : "Enter your account email and we'll send a reset link.";
    submitButton.textContent = enabled ? "Update password" : "Send reset link";
  }

  setRecoveryMode(recoveryMode);
  if (supabase) {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") setRecoveryMode(true);
    });
  }

  resetForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!checkSupabase()) return;

    setBusy(resetForm, true, recoveryMode ? "Update password" : submitLabel);
    showMessage("");
    try {
      if (recoveryMode) {
        const { error } = await supabase.auth.updateUser({ password: newPassword.value });
        if (error) throw error;
        showMessage("Password updated. You can now sign in.", "success");
        setBusy(resetForm, false, "Update password");
      } else {
        const redirectTo = new URL("reset-password.html", window.location.href).href;
        const { error } = await supabase.auth.resetPasswordForEmail(emailInput.value.trim(), { redirectTo });
        if (error) throw error;
        showMessage("If an account exists for that email, a reset link has been sent.", "success");
        setBusy(resetForm, false, submitLabel);
      }
    } catch (error) {
      showMessage(error.message || "Password reset failed. Please try again.", "error");
      setBusy(resetForm, false, recoveryMode ? "Update password" : submitLabel);
    }
  });
}