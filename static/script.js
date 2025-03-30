// 🌐 DOM Elements
const chatbox = document.getElementById("chatbox");
const form = document.getElementById("chat-form");
const messageInput = document.getElementById("message");
const typingIndicator = document.getElementById("typing-indicator");
const micBtn = document.getElementById("mic-btn");
const newChatBtn = document.querySelector(".new-chat");

let isReading = false;
let conversationHistory = [];

// 📨 Submit Chat
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const inputText = messageInput.value.trim();
  if (!inputText) return;

  appendMessage("user", inputText);
  conversationHistory.push({ role: "user", content: inputText });
  messageInput.value = "";
  typingIndicator.style.display = "block";

  try {
    const response = await fetch("/get_notes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        subject: "General",
        topic: inputText,
        history: conversationHistory,
      }),
    });

    const data = await response.json();
    typingIndicator.style.display = "none";

    if (data.notes) {
      const formatted = formatAnswer(data.notes);
      appendMessage("bot", formatted);
      conversationHistory.push({ role: "assistant", content: data.notes });
    } else {
      appendMessage("bot", `❌ Error: ${data.error || "Unknown error"}`);
    }
  } catch (error) {
    typingIndicator.style.display = "none";
    appendMessage("bot", `❌ Error: ${error.message}`);
  }
});

// 💬 Append Chat Message
function appendMessage(sender, text) {
  const msgDiv = document.createElement("div");
  msgDiv.className = `message ${sender}`;
  msgDiv.innerHTML = text;
  chatbox.appendChild(msgDiv);
  chatbox.scrollTop = chatbox.scrollHeight;
}

// 🎨 Format Bot Response
function formatAnswer(text) {
  const lines = text.split("\n").filter(Boolean);
  let formatted = "";

  lines.forEach((line, index) => {
    const cleanedLine = line.replace(/^\*\*|\*\*$/g, "");
    if (index === 0) {
      formatted += `<div style="font-weight:bold;font-size:18px;margin-bottom:10px;color:#00ffc3;">${cleanedLine}</div>`;
    } else if (line.startsWith("-") || line.match(/^\d+\./)) {
      formatted += `<div style="padding:6px 10px; background:#2a2a2a; color:#ffffff; margin:4px 0; border-radius:6px;">${cleanedLine}</div>`;
    } else {
      formatted += `<div style="margin:6px 0; color:#dddddd;">${cleanedLine}</div>`;
    }
  });

  return formatted;
}

// 🎤 Hindi Voice Input
micBtn.addEventListener("click", () => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = "hi-IN";
  recognition.start();

  recognition.onresult = (event) => {
    messageInput.value = event.results[0][0].transcript;
  };

  recognition.onerror = (event) => {
    alert("🎤 Voice input error: " + event.error);
  };
});

// 🔊 Read Last Bot Message (Hindi)
function readAloud() {
  const lastBotMsg = [...chatbox.getElementsByClassName("bot")].pop();
  const readBtn = document.querySelector("button[onclick='readAloud()']");
  if (!lastBotMsg || !readBtn) return;

  if (!isReading) {
    isReading = true;
    readBtn.innerText = "🔇 Stop";
    responsiveVoice.speak(lastBotMsg.innerText, "Hindi Female", {
      onend: () => {
        isReading = false;
        readBtn.innerText = "🔊 Read";
      },
    });
  } else {
    responsiveVoice.cancel();
    isReading = false;
    readBtn.innerText = "🔊 Read";
  }
}

// 📋 Copy Last Bot Message
function copyResponse() {
  const lastBotMsg = [...chatbox.getElementsByClassName("bot")].pop();
  if (lastBotMsg) {
    navigator.clipboard.writeText(lastBotMsg.textContent).then(() => {
      alert("✅ Response copied to clipboard!");
    });
  }
}

// 📄 Download Chat as PDF

// 📄 Download Chat as PDF
function downloadPDF() {
  const chatBox = document.getElementById("chatbox");
  const allMessages = chatBox.querySelectorAll(".user, .bot");
  let printableContent = "";

  allMessages.forEach(message => {
    let role = message.classList.contains("user") ? "👤 You" : "🤖 NoteMate";
    printableContent += `
      <div class="${message.className}">
        <strong>${role}:</strong>
        <div>${message.innerHTML}</div>
      </div>
      <hr style="border-top: 1px solid #ccc; margin: 10px 0;">
    `;
  });

  const printWindow = window.open('', '', 'height=700,width=900');
  printWindow.document.write('<html><head><title>NoteMate Chat Export</title><style>');
  printWindow.document.write(`
    body { font-family: Arial, sans-serif; padding: 20px; color: #000; }
    .user, .bot { margin-bottom: 20px; }
    .user strong, .bot strong { font-size: 16px; margin-bottom: 5px; color: #333; display:block; }
    .user div, .bot div { font-size: 14px; line-height: 1.5; }
  `);
  printWindow.document.write('</style></head><body>');
  printWindow.document.write('<h2 style="text-align:center;">📝 NoteMate Chat Export</h2>');
  printWindow.document.write(printableContent);
  printWindow.document.write('</body></html>');
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 500);
}


// 🔄 Reset Chat
newChatBtn.addEventListener("click", () => {
  chatbox.innerHTML = "";
  conversationHistory = [];
  messageInput.value = "";
  if (isReading) {
    responsiveVoice.cancel();
    isReading = false;
    const readBtn = document.querySelector("button[onclick='readAloud()']");
    if (readBtn) readBtn.innerText = "🔊 Read";
  }
});


// 🌍 Ask Question from Website Content
async function askWebsite() {
  const url = document.getElementById("url").value.trim();
  const question = document.getElementById("question").value.trim();
  const answerBox = document.getElementById("answer");

  if (!url || !question) {
    answerBox.innerHTML = "<span style='color:red;'>❗ Please enter both URL and question.</span>";
    return;
  }

  answerBox.innerHTML = "<em>Generating answer...</em>";

  try {
    const response = await fetch("http://127.0.0.1:5000/fetch_answer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, question }),
    });

    const data = await response.json();

    if (data.answer) {
      answerBox.innerHTML = formatWebsiteAnswer(data.answer);
    } else {
      answerBox.innerHTML = "<span style='color:red;'>❌ Failed to generate answer.</span>";
    }
  } catch (error) {
    answerBox.innerHTML = "<span style='color:red;'>Error: Could not fetch answer. Check the backend.</span>";
    console.error("Fetch Error:", error);
  }
}

// 🧠 Format Website Answer
function formatWebsiteAnswer(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br>")
    .replace(/\d+\./g, (match) => `<br><strong>${match}</strong>`);
}

  document.getElementById("chat-form").addEventListener("submit", async function (e) {
    e.preventDefault();
    const input = document.getElementById("message").value.trim();
    if (input === "") return;

    // Check if it's a URL
    if (input.startsWith("http://") || input.startsWith("https://")) {
      askWebsite(input);
    } else {
      sendMessage(input); // Your existing function to handle normal messages
    }

    document.getElementById("message").value = "";
  });

  function askWebsite(url) {
    // You can enhance this as per your backend
    const question = prompt("What do you want to know from this website?");
    if (!question) return;
    // Handle website-based Q&A
    fetch("/get-answer-from-website", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ url, question }),
    })
    .then((res) => res.json())
    .then((data) => {
      const botMsg = document.createElement("div");
      botMsg.className = "bot";
      botMsg.innerText = data.answer;
      document.getElementById("chatbox").appendChild(botMsg);
    });
  }

  function sendMessage(msg) {
    // Normal message sending logic here (like you already have)
    const userMsg = document.createElement("div");
    userMsg.className = "user";
    userMsg.innerText = msg;
    document.getElementById("chatbox").appendChild(userMsg);
    
    // Simulate bot reply
    fetch("/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: msg }),
    })
    .then((res) => res.json())
    .then((data) => {
      const botMsg = document.createElement("div");
      botMsg.className = "bot";
      botMsg.innerText = data.answer;
      document.getElementById("chatbox").appendChild(botMsg);
    });
  }
