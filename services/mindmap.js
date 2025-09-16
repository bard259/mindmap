import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.EXPO_PUBLIC_OPENAI_API_KEY,
  dangerouslyAllowBrowser: true
});

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

export async function generateMindMap(subject) {
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
    // Return a demo response for testing or when API fails
    return {
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
    };
  }
}
