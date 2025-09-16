const form = document.getElementById('search-form');
const resultsEl = document.getElementById('results');
const statusEl = document.getElementById('status');

function resourceCard(r){
    const price = r.price ? `<span class="badge">${r.price}</span>` : '';
    const type = r.type ? `<span class="badge">${r.type}</span>` : '';
    const source = r.source ? `<span class="badge">${r.source}</span>` : '';
    return `
    <div class="card">
        <h3><a href="${r.url}" target="_blank" rel="noopener noreferrer">${escapeHtml(r.title)}</a></h3>
        <div class="meta">${price}${type}${source}</div>
        <div class="desc">${escapeHtml(r.description || '')}</div>
    </div>`;
}

function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
}

const loadingEl = document.getElementById('loading');

async function search(skill, type = '', price = ''){
    statusEl.textContent = 'Searching and ranking…';
    resultsEl.innerHTML = '';
    loadingEl?.classList.remove('hidden');
    const params = new URLSearchParams({ skill, type, price });
    const resp = await fetch(`/api/resources?${params.toString()}`);
    if (!resp.ok) {
        statusEl.textContent = 'Error fetching results';
        loadingEl?.classList.add('hidden');
        return;
    }
    const data = await resp.json();
    if (!data.resources?.length) {
        statusEl.textContent = 'No results yet. Populating… try again in a few seconds.';
        loadingEl?.classList.add('hidden');
        return;
    }
    statusEl.textContent = `${data.count} results for "${skill}"`;
    resultsEl.innerHTML = data.resources.map(resourceCard).join('');
    loadingEl?.classList.add('hidden');
}

form.addEventListener('submit', (e) => {
    e.preventDefault();
    const skill = document.getElementById('skill').value.trim();
    const type = document.getElementById('type').value;
    const price = document.getElementById('price').value;
    if (skill) search(skill, type, price);
});

// Suggested tags click
document.getElementById('suggested')?.addEventListener('click', (e) => {
    const target = e.target;
    if (target.tagName === 'BUTTON') {
        const skill = target.getAttribute('data-skill');
        document.getElementById('skill').value = skill;
        search(skill);
    }
});


