import OpenAI from "openai";

function extractText(resp) {
  // safest: collect all output_text chunks
  try {
    if (resp.output_text) return resp.output_text;
    let t = "";
    for (const item of resp.output || []) {
      for (const c of item.content || []) {
        if (c.type === "output_text" && c.text) t += c.text;
      }
    }
    return t;
  } catch {
    return "";
  }
}

function safeJsonParse(text) {
  const trimmed = String(text || "").trim();

  // try direct
  try { return JSON.parse(trimmed); } catch {}

  // try to extract first {...} block
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) {
    const maybe = trimmed.slice(start, end + 1);
    return JSON.parse(maybe);
  }

  throw new Error("Model did not return JSON");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const { imageDataUrl, topic, count = 10 } = req.body || {};
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: "Missing OPENAI_API_KEY on server" });
    }

    const client = new OpenAI({ apiKey });

    const n = Math.max(5, Math.min(30, Number(count) || 10));

    const prompt = `
Return ONLY valid JSON in this exact format:
{ "mcqs":[ { "q":"", "options":["","","",""], "ans":0 } ] }

Rules:
- Exactly ${n} questions
- options must be exactly 4 items
- ans must be 0,1,2,or 3
- Questions must be clear, exam-style, not too long
Topic: ${topic || "Use the notes image"}
`;

    const input = [{
      role: "user",
      content: [{ type: "input_text", text: prompt }],
    }];

    if (imageDataUrl) {
      input[0].content.push({
        type: "input_image",
        image_url: imageDataUrl,
      });
    }

    const response = await client.responses.create({
      // Use your allowed model here if needed:
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      input,
    });

    const text = extractText(response);
    const json = safeJsonParse(text);

    // normalize on server too
    const mcqs = Array.isArray(json.mcqs) ? json.mcqs : [];
    return res.status(200).json({ mcqs });
  } catch (err) {
    const msg = String(err?.message || err);
    return res.status(500).json({ error: "AI server error", details: msg });
  }
}
