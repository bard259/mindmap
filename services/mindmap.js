import OpenAI from 'openai';

// Demo responses for different subjects
const demoResponses = {
  finance: {
    description: "How money flows and is managed: earning, saving, investing, borrowing, and risk.",
    subcategories: [
      {
        name: "Personal Finance",
        description: "Managing individual or family money, including budgeting, saving, and investing."
      },
      {
        name: "Corporate Finance",
        description: "How businesses manage funds, make investments, and maximize shareholder value."
      },
      {
        name: "Investment",
        description: "Growing wealth through stocks, bonds, real estate, and other financial instruments."
      },
      {
        name: "Banking",
        description: "Financial institutions that accept deposits and provide loans and other services."
      }
    ]
  },
  technology: {
    description: "The application of scientific knowledge for practical purposes, especially in industry and daily life.",
    subcategories: [
      {
        name: "Artificial Intelligence",
        description: "Systems that can simulate human intelligence and perform tasks like learning and problem-solving."
      },
      {
        name: "Cloud Computing",
        description: "Delivery of computing services over the internet, including storage, processing, and software."
      },
      {
        name: "Cybersecurity",
        description: "Protection of computer systems and networks from information disclosure and theft."
      }
    ]
  }
};

let isDemo = false;
let apiCallCount = 0;
const API_LIMIT = 10; // 每个会话最多允许10次API调用
const API_COOLDOWN = 100; // 两次API调用之间至少间隔100毫秒
let lastApiCall = 0;

// Initialize OpenAI client only if API key is available
const openai = process.env.EXPO_PUBLIC_OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

// 重置API调用计数
export function resetApiCount() {
  apiCallCount = 0;
  lastApiCall = 0;
}

function buildPrompt({ subject, context = '', exclude = [], path = [], perspective = '', purpose = '' }) {
  return `
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
- Keep everything specific to the provided context/memory AND aligned to the reader perspective and purpose.
- Provide exactly 3 unique, concrete, immediate subcategories.
- One concise sentence for each "description". Use approachable wording for the audience.
`.trim();
};

export function setDemoMode(enabled) {
  isDemo = enabled;
}

export function canon(s) {
  return (s || "").toLowerCase().replace(/[\s\-_/]+/g, ' ').replace(/[^\p{L}\p{N} ]/gu, '').trim();
}

export async function generateMindMap({ 
  subject, 
  context = '', 
  exclude = [], 
  path = [], 
  perspective = '', 
  purpose = '' 
}) {
  // 如果在演示模式或没有API密钥，返回演示响应
  if (isDemo || !openai) {
    const normalizedSubject = canon(subject);
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }

  // 检查API调用限制
  if (apiCallCount >= API_LIMIT) {
    console.warn('API call limit reached, switching to demo mode');
    isDemo = true;
    const normalizedSubject = canon(subject);
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }

  // 检查API调用冷却时间
  const now = Date.now();
  if (now - lastApiCall < API_COOLDOWN) {
    console.warn('API call too frequent, using demo response');
    const normalizedSubject = canon(subject);
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }

  try {
    apiCallCount++;
    lastApiCall = now;
    console.log(`API call ${apiCallCount}/${API_LIMIT} for subject: ${subject}`);

    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { 
          role: "user", 
          content: buildPrompt({ subject, context, exclude, path, perspective, purpose })
        }
      ],
      temperature: 0.7,
      max_tokens: 1000,
      response_format: { type: "json_object" }
    });

    const result = JSON.parse(completion.choices[0].message.content);
    return {
      description: result.description,
      subcategories: result.subcategories || []
    };
  } catch (error) {
    console.error('OpenAI API error:', error);
    // 发生错误时切换到演示模式
    isDemo = true;
    const normalizedSubject = canon(subject);
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }
}
