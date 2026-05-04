// LLM.js — Example usage of Groq SDK (uses .env for API key)
require('dotenv').config();
const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

async function main() {
    const completion = await groq.chat.completions.create({
        model: 'llama-3.1-8b-instant',
        messages: [{ role: 'user', content: 'Hello! What is AI ethics?' }],
        max_tokens: 200,
    });
    console.log(completion.choices[0].message.content);
}

main().catch(console.error);