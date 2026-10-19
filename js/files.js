
export function initFiles() {
  const fileInput = document.getElementById("fileInput");
  const messageInput = document.getElementById("messageInput");

  const allowedExtensions = [
    "txt", "md", "csv", "json", "html", "css", "js", "py"
  ];

  fileInput.addEventListener("change", async () => {
    const file = fileInput.files[0];
    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!allowedExtensions.includes(extension)) {
      alert("Abhi sirf text-based files supported hain. PDF support baad mein add hoga.");
      fileInput.value = "";
      return;
    }

    if (file.size > 100 * 1024) {
      alert("Demo version mein file 100 KB se chhoti honi chahiye.");
      fileInput.value = "";
      return;
    }

    try {
      const content = await file.text();

      messageInput.value =
        `Please analyze this file: ${file.name}\n\n` +
        "File content:\n```\n" + content + "\n```\n\n" +
        "Explain the important parts and any issues.";

      messageInput.dispatchEvent(new Event("input"));
      messageInput.focus();
    } catch {
      alert("File read nahi ho saki.");
    }

    fileInput.value = "";
  });
}
