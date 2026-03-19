const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const text = process.argv.slice(2).join(" ") || "Hello student";
const tmpFile = path.join(os.tmpdir(), `tts-${Date.now()}.mp3`);
const pythonPath = "/home/cephas/tts-env/.venv/bin/python";

const edge = spawn(pythonPath, [
  "-m",
  "edge_tts",
  "--voice",
  "en-US-AriaNeural",
  "--text",
  text,
  "--write-media",
  tmpFile
]);

edge.stderr.on("data", (err) => {
  process.stderr.write(err);
});

edge.on("close", (code) => {
  if (code !== 0) {
    process.exit(code);
    return;
  }

  const stream = fs.createReadStream(tmpFile);
  stream.pipe(process.stdout);

  stream.on("close", () => {
    fs.unlink(tmpFile, () => {});
  });
});

edge.on("error", (error) => {
  process.stderr.write(`Spawn error: ${error.message}\n`);
  process.exit(1);
});