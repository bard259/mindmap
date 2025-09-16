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

// Initialize OpenAI client only if API key is available
const openai = process.env.EXPO_PUBLIC_OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
}) : null;

const systemPrompt = `You are a knowledgeable teacher helping to create a mind map. For any given subject:
1. Provide a clear, concise description (1-2 sentences)
2. List 3-5 key subcategories that are most important to understand this subject
3. For each subcategory, provide a brief description (1 sentence)

Format your response as a JSON object with this structure:
{
  "description": "Main subject description",
  "subcategories": [
    {
      "name": "Subcategory name",
      "description": "Subcategory description"
    }
  ]
}`;

export function setDemoMode(enabled) {
  isDemo = enabled;
}

export async function generateMindMap(subject) {
  // If in demo mode or no API key, return demo response
  if (isDemo || !openai) {
    const normalizedSubject = subject.toLowerCase();
    // Return specific demo response if available, otherwise return finance demo
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo-preview",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: `Create a mind map for: ${subject}` }
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
    // Switch to demo mode on error
    isDemo = true;
    // Return demo response based on subject
    const normalizedSubject = subject.toLowerCase();
    return demoResponses[normalizedSubject] || demoResponses.finance;
  }
}
