// server.js — AI Ethics Advisor Backend
require('dotenv').config();
const express = require('express');
const path    = require('path');
const cors    = require('cors');
const Groq    = require('groq-sdk');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Validate API key on startup ───────────────────────────────
if (!process.env.GROQ_API_KEY) {
    console.error('❌ GROQ_API_KEY is missing from .env — chatbot will not work!');
    process.exit(1);
}

// ── Init Groq ─────────────────────────────────────────────────
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ── Middleware ────────────────────────────────────────────────
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// ── Root → project.html ───────────────────────────────────────
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'project.html'));
});

// ── Health check ──────────────────────────────────────────────
app.get('/health', (req, res) => {
    res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// ── Location ──────────────────────────────────────────────────
app.post('/api/location', (req, res) => {
    try {
        const { latitude, longitude, address } = req.body;
        if (!latitude || !longitude) return res.status(400).json({ error: 'Location missing' });
        console.log('📍 USER LOCATION:', { latitude, longitude, address });
        res.json({ success: true, message: 'Location received' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Daily Ethics Fact (Groq-powered) ─────────────────────────
app.get('/api/daily-fact', async (req, res) => {
    try {
        const topics = [
            'utilitarianism', 'deontological ethics', 'virtue ethics',
            'the trolley problem', 'the veil of ignorance by John Rawls',
            'the categorical imperative by Kant', 'the ethics of care',
            'moral relativism', 'existentialist ethics by Sartre',
            "Bentham's hedonic calculus", 'the golden rule across cultures',
            'AI alignment problem', 'data privacy as a moral right',
            'environmental ethics', 'bioethics and medical consent',
        ];
        const topic = topics[Math.floor(Math.random() * topics.length)];

        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: 'You are an engaging ethics educator. Share ONE fascinating, thought-provoking fact or insight about the given ethics topic. Keep it to 2-3 sentences max. Start with a captivating hook. Make it memorable and intellectually stimulating.',
                },
                { role: 'user', content: `Tell me a fascinating fact about: ${topic}` },
            ],
            temperature: 0.8,
            max_tokens: 120,
        });

        res.json({
            success: true,
            fact: completion.choices[0].message.content,
            topic,
            timestamp: new Date().toISOString(),
        });
    } catch (err) {
        console.error('daily-fact error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── Wikipedia Concept Lookup (proxied, cached) ────────────────
const conceptCache = new Map();

app.get('/api/concept/:term', async (req, res) => {
    try {
        const term = encodeURIComponent(req.params.term);
        if (conceptCache.has(term)) return res.json(conceptCache.get(term));

        const fetch = require('node-fetch');
        const url   = `https://en.wikipedia.org/api/rest_v1/page/summary/${term}`;
        const r     = await fetch(url, { headers: { 'User-Agent': 'AIEthicsAdvisor/2.0' } });

        if (!r.ok) return res.status(404).json({ error: 'Concept not found' });

        const data   = await r.json();
        const result = {
            success:   true,
            title:     data.title,
            extract:   data.extract,
            thumbnail: data.thumbnail?.source || null,
            pageUrl:   data.content_urls?.desktop?.page || null,
        };

        conceptCache.set(term, result);
        setTimeout(() => conceptCache.delete(term), 3_600_000); // 1 hr cache

        res.json(result);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── Open Library Books API (proxied) ─────────────────────────
app.get('/api/books/:subject', async (req, res) => {
    try {
        const subject = encodeURIComponent(req.params.subject);
        const fetch   = require('node-fetch');
        const url     = `https://openlibrary.org/subjects/${subject}.json?limit=5`;
        const r       = await fetch(url, { headers: { 'User-Agent': 'AIEthicsAdvisor/2.0' } });

        if (!r.ok) return res.status(404).json({ error: 'Books not found' });

        const data  = await r.json();
        const books = (data.works || []).slice(0, 5).map(w => ({
            title:   w.title,
            authors: (w.authors || []).map(a => a.name).join(', '),
            year:    w.first_publish_year || 'N/A',
            cover:   w.cover_id ? `https://covers.openlibrary.org/b/id/${w.cover_id}-M.jpg` : null,
            url:     `https://openlibrary.org${w.key}`,
        }));

        res.json({ success: true, subject: data.name || req.params.subject, books });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// ── AI Ethics Advisor (main chatbot) ─────────────────────────
app.post('/api/ethics', async (req, res) => {
    try {
        const { question, category = 'general', location } = req.body;
        if (!question) return res.status(400).json({ error: 'Question required' });

        const locationCtx = location?.address
            ? `\nUser is located in: ${location.address}. Consider any region-specific laws, cultural norms, or ethical precedents relevant to this location.`
            : '';

        const frameworkMap = {
            general:       'Consequentialism, Deontology, and Virtue Ethics',
            ai:            'AI alignment principles, Fairness, Accountability, Transparency (FAT), and IEEE/EU AI Ethics Guidelines',
            business:      'Stakeholder theory, Corporate Social Responsibility (CSR), and Business deontology',
            medical:       'Beneficence, Non-maleficence, Autonomy, and Justice (Beauchamp & Childress)',
            education:     'Epistemic justice, Academic integrity, and Paulo Freire\'s pedagogy of the oppressed',
            legal:         'GDPR principles, Right to privacy (ECHR Art.8), and Due process ethics',
            environmental: 'Deep ecology, Intergenerational justice, and the Precautionary Principle',
            social:        'Rawlsian justice, Intersectionality, and Social contract theory',
            technology:    'Tech ethics frameworks, Digital rights, and Value-sensitive design',
        };

        const frameworks = frameworkMap[category] || frameworkMap.general;

        const completion = await groq.chat.completions.create({
            model: 'llama-3.1-8b-instant',
            messages: [
                {
                    role: 'system',
                    content: `You are an expert ${category} Ethics Advisor applying ${frameworks}.${locationCtx}

STRICT RESPONSE FORMAT (follow exactly):

Situation:
(Summarize the ethical dilemma in 1-2 sentences)

Principles:
- List 2-3 relevant ethical principles that apply

Pros:
- List 2-3 clear benefits or ethical justifications

Cons:
- List 2-3 key risks, harms, or ethical concerns

Risk Level:
- Rate the overall ethical risk (Low/Medium/High) and provide a 1-sentence explanation

Possibility:
- Rate the practical possibility/feasibility of the recommendation (Low/Medium/High) and provide a 1-sentence explanation

Recommendation:
- Give ONE clear, principled recommendation

Alternatives:
- Suggest ONE ethical alternative approach

Framework Used:
- Name the primary ethical framework applied (e.g., Utilitarian, Kantian, Virtue Ethics)

(Keep total response under 220 words. Be precise and actionable.)`,
                },
                { role: 'user', content: question },
            ],
            temperature: 0.3,
            max_tokens:  400,
        });

        res.json({
            success:    true,
            answer:     completion.choices[0].message.content,
            category,
            frameworks,
            timestamp:  new Date().toISOString(),
        });
    } catch (err) {
        console.error('ethics API error:', err.message);
        res.status(500).json({ error: err.message });
    }
});

// ── 404 handler ───────────────────────────────────────────────
app.use((req, res) => {
    if (req.path.startsWith('/api')) return res.status(404).json({ error: 'Not found' });
    res.status(404).sendFile(path.join(__dirname, 'project.html'));
});

// ── Start ─────────────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`\n🚀 AI Ethics Advisor running at http://localhost:${PORT}`);
    console.log(`📚 APIs: /api/ethics | /api/daily-fact | /api/concept/:term | /api/books/:subject\n`);
});
