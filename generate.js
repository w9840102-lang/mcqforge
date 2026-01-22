import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { imageDataUrl, count = 5 } = req.body || {};

    if (!imageDataUrl) {
      return res.status(400).json({ error: "No image provided" });
    }

    const client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });

    const prompt = `
Return ONLY valid JSON:
{
  "questions": [
    {
      "q": "Question text",
      "options": ["A", "B", "C", "D"],
      "ans": 0
    }
  ]
}

Rules:
- Exactly ${count} questions
- 4 options each
- ans must be 0–3
- Clean school-level MCQs
`;

    const input = [
      {
        role: "user",
        content: [
          { type: "input_text", text: prompt },
          { type: "input_image", image_url: imageDataUrl }
        ],
      },
    ];

    const response = await client.responses.create({
      model: "gpt-5-mini",
      input,
    });

    const text = response.output_text?.trim();

    if (!text) {
      return res.status(500).json({ error: "Empty AI response" });
    }

    const json = JSON.parse(text);
    return res.status(200).json(json);

  } catch (err) {
    console.error("AI ERROR:", err);
    return res.status(500).json({
      error: "AI server error",
      details: String(err?.message || err),
    });
  }
}
