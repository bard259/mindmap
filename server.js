import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public')); // serves public/index.html

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// POST /api/mindmap  { "subject": "Finance" }
app.post('/api/mindmap', async (req, res) => {
  const subject = (req.body?.subject || 'Finance').trim();

  try {
    const r = await client.responses.create({
      model: "gpt-4.1-mini",
      // Ask for strict JSON via the new Responses API field:
      text: {
        format: {
          type: "json_schema",
          name: "MindMap",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["subject", "description", "subcategories"],
            properties: {
              subject: { type: "string" },
              description: { type: "string" },
              subcategories: {
                type: "array",
                minItems: 3,
                maxItems: 3,
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["name", "description"],
                  properties: {
                    name: { type: "string" },
                    description: { type: "string" }
                  }
                }
              }
            }
          }
        }
      },
      input: `You are a teacher for 18-year-olds.
Return ONLY JSON (no extra text) that matches the provided schema for the subject: "${subject}".`
    });

    // With structured outputs, this should be pure JSON text.
    const raw = r.output_text ?? "";

    // Primary parse
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      // Fallback if any stray formatting sneaks in
      const cleaned = raw
        .replace(/^\s*```(?:json)?\s*/i, "")
        .replace(/\s*```+\s*$/i, "")
        .trim();
      data = JSON.parse(cleaned);
    }

    // Basic shape check
    if (!data?.subject || !Array.isArray(data?.subcategories)) {
      return res.status(502).json({ error: "Model returned malformed JSON.", raw });
    }

    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err?.message || "OpenAI request failed" });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`Server on http://localhost:${PORT}`);
});

