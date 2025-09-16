# SkillScout

Find the best and latest learning resources for any skill. Enter a skill, get ranked resources from free to paid, auto-refreshed on a schedule.

## Quick start

1. Requirements: Node.js 18+
2. Install dependencies:

```
npm install
```

3. (Optional) Add a Tavily API key for higher-quality results:

Create a `.env` file in the project root:

```
TAVILY_API_KEY=your_key_here
PORT=3000
POPULAR_SKILLS=python,javascript,react,data science,ui ux,devops
```

4. Run the app:

```
npm start
```

Open `http://localhost:3000` and search for a skill. The first search seeds the cache and triggers a background refresh.

## Tech
- Express API
- SQLite (better-sqlite3)
- Node Cron for auto-refresh
- Vanilla JS frontend

## Notes
- Without `TAVILY_API_KEY`, the app falls back to a generic search heuristic; results may be noisier.
- Data is stored in `data.db` in the project root by default. Configure with `DB_PATH`.

## API
- GET `/api/resources?skill=react&type=course&price=free`

Returns `{ skill, count, resources }`.


