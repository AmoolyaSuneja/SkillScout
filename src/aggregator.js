const axios = require('axios');
const { getDb } = require('./db');

// Helper: normalize resource record
function normalizeResource(skill, item) {
    const now = Date.now();
    return {
        skill_name: skill.toLowerCase(),
        title: item.title?.slice(0, 300) || 'Untitled',
        url: item.url,
        source: item.source || extractDomain(item.url),
        type: inferTypeFromTitleOrUrl(item.title, item.url),
        price: inferPrice(item),
        description: item.description?.slice(0, 1000) || '',
        rating: item.rating ?? null,
        num_reviews: item.num_reviews ?? null,
        published_at: item.published_at ?? null,
        fetched_at: now
    };
}

function extractDomain(url) {
    try { return new URL(url).hostname.replace('www.', ''); } catch { return ''; }
}

function inferTypeFromTitleOrUrl(title = '', url = '') {
    const t = `${title} ${url}`.toLowerCase();
    if (t.includes('udemy') || t.includes('course') || t.includes('coursera') || t.includes('class')) return 'course';
    if (t.includes('youtube') || t.includes('video') || t.includes('playlist')) return 'video';
    if (t.includes('book') || t.includes('pdf') || t.includes('ebook')) return 'book';
    if (t.includes('roadmap') || t.includes('path')) return 'roadmap';
    return 'article';
}

function inferPrice(item) {
    const text = `${item.title || ''} ${item.description || ''} ${item.url || ''}`.toLowerCase();
    if (text.includes('free') || text.includes('opensource') || text.includes('open-source')) return 'free';
    if (text.includes('subscription') || text.includes('paid') || text.includes('price')) return 'paid';
    return '';
}

// Scoring and ranking
function scoreResource(resource) {
    let score = 0;
    // recency
    if (resource.published_at) {
        const ageDays = (Date.now() - Number(resource.published_at)) / (1000*60*60*24);
        score += Math.max(0, 30 - Math.min(30, ageDays / 12)); // up to +30 for very recent
    }
    // ratings
    if (resource.rating) score += resource.rating * 5;
    if (resource.num_reviews) score += Math.min(20, Math.log10(1 + resource.num_reviews) * 8);
    // source authority (simple heuristic)
    const domain = resource.source || '';
    if (/coursera|udemy|edx|khanacademy|youtube|freecodecamp|roadmap\.sh|scrimba|egghead|frontendmasters/.test(domain)) score += 12;
    if (/github\.com/.test(resource.url)) score += 6;
    // type preference
    const typeBoost = { course: 10, roadmap: 8, video: 6, article: 4, book: 5 };
    score += typeBoost[resource.type] || 0;
    // price preference (favor free slightly)
    if (resource.price === 'free') score += 6;
    return score;
}

async function searchWeb(skill) {
    // Prefer Tavily API if available; fallback to DuckDuckGo lite API via RapidAPI-like endpoints not guaranteed.
    const tavilyKey = process.env.TAVILY_API_KEY;
    if (tavilyKey) {
        const resp = await axios.post('https://api.tavily.com/search', {
            api_key: tavilyKey,
            query: `${skill} how to learn best resources guide 2025`,
            search_depth: 'advanced',
            include_answer: false,
            include_images: false,
            max_results: 30
        }, { timeout: 15000 });
        const results = (resp.data?.results || []).map(r => ({
            title: r.title,
            url: r.url,
            description: r.snippet,
            source: extractDomain(r.url)
        }));
        return results;
    }
    // Fallback: use DuckDuckGo HTML lite via third-party JSON API if no key; keep very conservative
    const ddgResp = await axios.get(`https://r.jina.ai/http://duckduckgo.com/html/?q=${encodeURIComponent(skill + ' how to learn best resources 2025')}` , { timeout: 12000 });
    // jina.ai returns readable text; extract links heuristically
    const lines = String(ddgResp.data).split('\n');
    const urls = Array.from(new Set(lines.map(l => (l.match(/https?:\/\/[^\s\)\]]+/))?.[0]).filter(Boolean))).slice(0, 15);
    return urls.map(u => ({ title: u, url: u }));
}

async function fetchAndStoreResources(skill) {
    const db = getDb();
    const lower = skill.toLowerCase();
    const items = await searchWeb(skill);
    const normalized = items.map(it => normalizeResource(lower, it));
    const insert = db.prepare(`
        INSERT OR IGNORE INTO resources (
            skill_name, title, url, source, type, price, description, rating, num_reviews, published_at, fetched_at
        ) VALUES (@skill_name, @title, @url, @source, @type, @price, @description, @rating, @num_reviews, @published_at, @fetched_at)
    `);
    const tx = db.transaction((rows) => {
        rows.forEach(r => insert.run(r));
        db.prepare('INSERT OR IGNORE INTO skills (name, last_refreshed_at) VALUES (?, ?)').run(lower, Date.now());
        db.prepare('UPDATE skills SET last_refreshed_at = ? WHERE name = ?').run(Date.now(), lower);
    });
    tx(normalized);
    return normalized.length;
}

function getRankedResources({ skill, price = '', type = '', limit = 40 }) {
    const db = getDb();
    const lower = skill.toLowerCase();
    let query = 'SELECT * FROM resources WHERE skill_name = ?';
    const params = [lower];
    if (price) { query += ' AND price = ?'; params.push(price); }
    if (type) { query += ' AND type = ?'; params.push(type); }
    const rows = db.prepare(query).all(...params);
    const scored = rows.map(r => ({ ...r, _score: scoreResource(r) }))
        .sort((a, b) => b._score - a._score)
        .slice(0, limit)
        .map(({ _score, ...rest }) => rest);
    return { resources: scored };
}

module.exports = { fetchAndStoreResources, getRankedResources };


