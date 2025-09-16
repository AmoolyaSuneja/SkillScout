const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const { getDb } = require('./src/db');
const { fetchAndStoreResources, getRankedResources } = require('./src/aggregator');
const cron = require('node-cron');

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const PORT = process.env.PORT || 3000;

// Initialize DB
getDb();

// API: search resources by skill (returns cached + triggers refresh in background)
app.get('/api/resources', async (req, res) => {
    try {
        const skill = String(req.query.skill || '').trim();
        const price = String(req.query.price || '').trim(); // 'free' | 'paid' | ''
        const type = String(req.query.type || '').trim();   // 'course' | 'book' | 'video' | 'article' | ''
        if (!skill) {
            return res.status(400).json({ error: 'Missing skill query parameter' });
        }

        let { resources } = getRankedResources({ skill, price, type, limit: 40 });
        if (!resources.length) {
            await fetchAndStoreResources(skill);
            resources = getRankedResources({ skill, price, type, limit: 40 }).resources;
        } else {
            // Fire and forget background refresh for freshness
            fetchAndStoreResources(skill).catch(() => {});
        }

        res.json({ skill, count: resources.length, resources });
    } catch (err) {
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health
app.get('/api/health', (req, res) => {
    res.json({ ok: true });
});

// Static frontend
app.use(express.static(path.join(__dirname, 'public')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Cron: refresh popular skills hourly (can be configured)
const POPULAR_SKILLS = (process.env.POPULAR_SKILLS || 'python,javascript,react,data science,ui ux,devops').split(',').map(s => s.trim()).filter(Boolean);
cron.schedule('15 * * * *', () => {
    POPULAR_SKILLS.forEach(skill => {
        fetchAndStoreResources(skill).catch(() => {});
    });
});

app.listen(PORT, () => {
    console.log(`Server listening on http://localhost:${PORT}`);
});


