import fs from "node:fs";

const env = fs.readFileSync(".env.local", "utf8");
const match = env.match(/^INWORLD_API_KEY=(.*)$/m);
if (!match) {
  throw new Error("INWORLD_API_KEY missing");
}
const key = match[1].trim().replace(/^["']|["']$/g, "");
if (!key) {
  throw new Error("INWORLD_API_KEY empty");
}

const wav = fs.readFileSync("tmp-inworld-stt.wav");
const auth = key.toLowerCase().startsWith("basic ") ? key : `Basic ${key}`;
const response = await fetch("https://api.inworld.ai/stt/v1/transcribe", {
  method: "POST",
  headers: {
    Authorization: auth,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({
    transcribeConfig: {
      modelId: "inworld/inworld-stt-1",
      audioEncoding: "AUTO_DETECT",
      language: "en",
    },
    audioData: {
      content: wav.toString("base64"),
    },
  }),
});

const body = await response.text();
let preview = body.slice(0, 600);
preview = preview.replace(/sk-[a-zA-Z0-9-]+/g, "[redacted]");
console.log(
  JSON.stringify({
    status: response.status,
    ok: response.ok,
    preview,
  }),
);
