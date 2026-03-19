const { Ollama } = require('ollama');

const ollama = new Ollama({
  host: 'http://3.208.3.66:11434',
});

async function runModel() {
  try {
    console.log("Sending request to EC2 Ollama...");

    const response = await fetch("http://3.208.3.66:11434/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama3:latest",
        prompt: "Solve step by step: 3x + 7 = 19",
        stream: false,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${await response.text()}`);
    }

    const data = await response.json();
    console.log("Model response:");
    console.log(data.response);
  } catch (error) {
    console.error("Full error:", error);
    console.error("Message:", error.message);
  }
}

runModel();