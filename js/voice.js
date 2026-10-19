
export function initVoice() {
  const button = document.getElementById("voiceButton");
  const input = document.getElementById("messageInput");

  const SpeechRecognition =
    window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRecognition) {
    button.addEventListener("click", () => {
      alert("Voice input is browser mein supported nahi hai. Chrome try karo.");
    });
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "hi-IN";
  recognition.interimResults = false;
  recognition.continuous = false;

  let listening = false;

  button.addEventListener("click", () => {
    if (listening) {
      recognition.stop();
      return;
    }

    try {
      recognition.start();
      listening = true;
      button.innerHTML = "🔴 <span>Listening...</span>";
    } catch {
      alert("Mic start nahi hua. Microphone permission check karo.");
    }
  });

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    input.value = `${input.value} ${transcript}`.trim();
    input.dispatchEvent(new Event("input"));
    input.focus();
  };

  recognition.onerror = () => {
    listening = false;
    button.innerHTML = "🎙 <span>Voice</span>";
  };

  recognition.onend = () => {
    listening = false;
    button.innerHTML = "🎙 <span>Voice</span>";
  };
}
