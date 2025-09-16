// server.js (ESM)
// Requires: "type": "module" in package.json

import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import OpenAI from 'openai';

// ----- setup & safety -----
const KEY = (process.env.OPENAI_API_KEY || '').trim();
if (!KEY) {
  console.error('❌ OPENAI_API_KEY not found. Put it in .env next to package.json');
  process.exit(1);
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static('public')); // serves public/index.html

const client = new OpenAI({ apiKey: KEY });

// Optional health check
app.get('/health', (_req, res) => res.json({ ok: true }));

// ----- API: generate/expand a node -----
// Body: { subject, context?, exclude?: string[], path?: [{name,description}], perspective?, purpose? }
app.post('/api/mindmap', async (req, res) => {
  const subject = (req.body?.subject ?? '').toString().trim() || 'Finance';
  const context = (req.body?.context ?? '').toString().trim();
  const exclude = Array.isArray(req.body?.exclude) ? req.body.exclude : [];
  const path = Array.isArray(req.body?.path) ? req.body.path : [];
  const perspective = (req.body?.perspective ?? '').toString().trim();
  const purpose = (req.body?.purpose ?? '').toString().trim();

  try {
    const r = await client.responses.create({
      model: 'gpt-4.1-mini',
      text: {
        format: {
          type: 'json_schema',
          name: 'MindMap',
          strict: true,
          schema: {
            type: 'object',
            additionalProperties: false,
            required: ['subject', 'description', 'subcategories'],
            properties: {
              subject: { type: 'string' },
              description: { type: 'string' },
              subcategories: {
                type: 'array',
                minItems: 3, maxItems: 3,
                items: {
                  type: 'object',
                  additionalProperties: false,
                  required: ['name', 'description'],
                  properties: { name: { type: 'string' }, description: { type: 'string' } }
                }
              }
            }
          }
        }
      },
      input: `
You are a teacher tailoring explanations to the reader.

Reader perspective/audience: "${perspective || 'an interested learner'}".
Purpose/intent: "${purpose || 'learning and understanding'}".

Return ONLY JSON that matches the schema (no prose, no code fences).

Topic to expand: "${subject}".
${context ? `Context breadcrumb: "${context}".` : ''}

Ancestry memory (oldest → newest):
${path.map(p => `- ${p.name}: ${p.description || ''}`).join('\n') || '- (none)'}

Forbidden names (avoid exact/near duplicates; pick different on-topic items): ${exclude.join(', ') || '(none)'}.

Rules:
- The JSON "subject" MUST equal "${subject}".
- Keep everything specific to the provided context/memory AND aligned to the reader perspective and purpose.
- Provide exactly 3 unique, concrete, immediate subcategories of "${subject}".
- One concise sentence for each "description". Use approachable wording for the audience.
`.trim()
    });

    const raw = r.output_text ?? '';
    const data = JSON.parse(raw);

    if (!data?.subject || !Array.isArray(data?.subcategories)) {
      return res.status(502).json({ error: 'Model returned malformed JSON.', raw });
    }

    res.json(data);
  } catch (err) {
    console.error('OpenAI error:', {
      status: err.status || err.code || 'n/a',
      message: err.message,
      data: err.response?.data
    });
    res
      .status(err.status || 500)
      .json({ error: err?.response?.data?.error?.message || err.message || 'OpenAI request failed' });
  }
});

// ----- start server -----
const PORT = process.env.PORT || 8080;
app.listen(PORT, () => {
  console.log(`✅ Server on http://localhost:${PORT}`);
});
