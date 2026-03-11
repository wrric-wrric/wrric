const API = 'http://localhost:8000';
let token = localStorage.getItem('access_token');
let currentUser = null;
let currentProfile = null;
let currentConvProfileId = null;
let wsConnection = null;
let allEntities = [];

// ===================== INIT =====================
document.addEventListener('DOMContentLoaded', () => {
    setupAuthForms();
    setupNavigation();
    setupEntityModal();
    if (token) initApp();
    else showLogin();
});

// ===================== AUTH =====================
function setupAuthForms() {
    document.getElementById('login-form').addEventListener('submit', handleLogin);
    document.getElementById('register-form').addEventListener('submit', handleRegister);
    document.getElementById('logout-btn').addEventListener('click', logout);
    document.getElementById('goto-register').addEventListener('click', (e) => { e.preventDefault(); showRegister(); });
    document.getElementById('goto-login').addEventListener('click', (e) => { e.preventDefault(); showLogin(); });
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('login-btn');
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Signing in...';

    try {
        const fd = new URLSearchParams();
        fd.append('username', document.getElementById('login-email').value);
        fd.append('password', document.getElementById('login-password').value);
        const res = await fetch(`${API}/api/auth/jwt/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Login failed'); }
        const data = await res.json();
        token = data.access_token;
        localStorage.setItem('access_token', token);
        initApp();
    } catch (err) {
        errEl.textContent = err.message; errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = 'Sign In';
    }
}

async function handleRegister(e) {
    e.preventDefault();
    const btn = document.getElementById('register-btn');
    const errEl = document.getElementById('register-error');
    const sucEl = document.getElementById('register-success');
    errEl.style.display = 'none'; sucEl.style.display = 'none';
    btn.disabled = true; btn.textContent = 'Creating account...';

    try {
        const payload = {
            username: document.getElementById('reg-username').value,
            email: document.getElementById('reg-email').value,
            password: document.getElementById('reg-password').value,
            first_name: document.getElementById('reg-fname').value,
            last_name: document.getElementById('reg-lname').value,
            role: document.getElementById('reg-role').value,
            organization: document.getElementById('reg-org').value || null,
            recaptchaResponse: "dev-dummy-token"
        };

        const res = await fetch(`${API}/api/signup`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Registration failed'); }
        sucEl.textContent = 'Account created! Signing you in...'; sucEl.style.display = 'block';
        // Auto-login
        const fd = new URLSearchParams();
        fd.append('username', payload.email); fd.append('password', payload.password);
        const loginRes = await fetch(`${API}/api/auth/jwt/login`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: fd });
        if (loginRes.ok) { const ld = await loginRes.json(); token = ld.access_token; localStorage.setItem('access_token', token); setTimeout(initApp, 1000); }
    } catch (err) {
        errEl.textContent = err.message; errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = 'Create Account';
    }
}

function logout() {
    token = null; currentUser = null; currentProfile = null;
    localStorage.removeItem('access_token');
    if (wsConnection) wsConnection.close();
    showLogin();
}

// ===================== SHOW/HIDE =====================
function showLogin() {
    document.getElementById('login-page').style.display = 'flex';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('app').style.display = 'none';
}
function showRegister() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
}
function showApp() {
    document.getElementById('login-page').style.display = 'none';
    document.getElementById('register-page').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
}

// ===================== INIT APP =====================
async function initApp() {
    showApp();
    await loadCurrentUser();
    loadOverview();
    loadStats();
}

async function loadCurrentUser() {
    try {
        const res = await apiFetch('/api/profiles');
        if (res.ok) {
            const profiles = await res.json();
            if (profiles.length > 0) {
                currentProfile = profiles[0];
                document.getElementById('user-info').textContent = currentProfile.display_name || currentProfile.first_name || 'User';
                document.getElementById('hero-name').textContent = currentProfile.first_name || 'Researcher';
            }
        }
    } catch (e) { console.warn('Could not load current user', e); }
}

// ===================== API HELPER =====================
async function apiFetch(path, options = {}) {
    return fetch(`${API}${path}`, {
        ...options,
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', ...options.headers }
    });
}

// ===================== NAVIGATION =====================
function setupNavigation() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => switchView(item.dataset.view));
    });
    document.getElementById('header-logo').addEventListener('click', () => switchView('overview'));
}

function switchView(viewName) {
    document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    const nav = document.querySelector(`.nav-item[data-view="${viewName}"]`);
    const view = document.getElementById(`view-${viewName}`);
    if (nav) nav.classList.add('active');
    if (view) view.classList.add('active');

    if (viewName === 'entities') loadEntitiesView();
    if (viewName === 'matches') loadMatchesView();
    if (viewName === 'messages') loadConversations();
}

// ===================== STATS =====================
async function loadStats() {
    try {
        const res = await fetch(`${API}/api/labs?limit=200`);
        if (res.ok) { const data = await res.json(); document.getElementById('stat-entities').textContent = data.length; }
        const mRes = await apiFetch('/api/match_records/funders/matches');
        if (mRes.ok) { const md = await mRes.json(); document.getElementById('stat-matches').textContent = md.length || 0; }
    } catch (e) { }
    document.getElementById('stat-proposals').textContent = '–';
    document.getElementById('stat-messages').textContent = '–';
}

// ===================== OVERVIEW / ENTITIES =====================
async function loadOverview() {
    const container = document.getElementById('overview-entities');
    container.innerHTML = '<div class="loading-wrap"><div class="spinner"></div><p>Loading ecosystem...</p></div>';
    try {
        const res = await fetch(`${API}/api/labs?limit=6`);
        if (!res.ok) throw new Error('Failed');
        const entities = await res.json();
        allEntities = entities;
        container.innerHTML = '';
        if (!entities.length) { container.innerHTML = '<div class="empty-state"><h3>No entities yet</h3><p>Run the seed script or add one via Labs & Entities.</p></div>'; return; }
        entities.slice(0, 6).forEach(e => container.appendChild(buildEntityCard(e)));
    } catch (err) {
        container.innerHTML = `<div class="empty-state"><h3>Connection error</h3><p>${err.message}</p></div>`;
    }
}

async function loadEntitiesView() {
    const allGrid = document.getElementById('all-entities-grid');
    const loadEl = document.getElementById('entities-loading');
    allGrid.innerHTML = ''; loadEl.style.display = 'block';

    try {
        const res = await fetch(`${API}/api/labs?limit=100`);
        if (!res.ok) throw new Error('Failed to load labs');
        const entities = await res.json();
        allEntities = entities;
        loadEl.style.display = 'none';

        if (!entities.length) {
            allGrid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No labs found</h3><p>Click "+ Add Lab" to submit the first one.</p></div>';
            return;
        }
        entities.forEach(e => allGrid.appendChild(buildEntityCard(e)));

        // Search
        const searchInput = document.getElementById('entities-search');
        searchInput.oninput = () => {
            const q = searchInput.value.toLowerCase();
            document.querySelectorAll('#all-entities-grid .entity-card').forEach(card => {
                card.style.display = card.textContent.toLowerCase().includes(q) ? '' : 'none';
            });
        };
    } catch (err) {
        loadEl.style.display = 'none';
        allGrid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3>Error</h3><p>${err.message}</p></div>`;
    }

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.onclick = () => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            if (btn.dataset.tab === 'all-entities') {
                document.getElementById('all-entities-grid').style.display = 'grid';
                document.getElementById('my-entities-grid').style.display = 'none';
            } else {
                document.getElementById('all-entities-grid').style.display = 'none';
                loadMyEntities();
            }
        };
    });
}

async function loadMyEntities() {
    const grid = document.getElementById('my-entities-grid');
    grid.style.display = 'grid';
    grid.innerHTML = '<div class="loading-wrap" style="grid-column:1/-1"><div class="spinner"></div></div>';
    try {
        const res = await apiFetch('/api/user_entities/?limit=50');
        if (!res.ok) throw new Error('Could not load your entities');
        const data = await res.json();
        grid.innerHTML = '';
        if (!data.length) { grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No submissions yet</h3><p>Add your lab via "+ Add Lab".</p></div>'; return; }
        data.forEach(e => grid.appendChild(buildEntityCard(e)));
    } catch (e) {
        grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><p>${e.message}</p></div>`;
    }
}

function buildEntityCard(entity) {
    const tags = (entity.climate_tech_focus || []).filter(Boolean);
    const tag = tags[0] || entity.entity_type || 'Research';
    const tagColors = ['', 'green', 'orange', 'purple'];
    const tagColor = tagColors[Math.floor(Math.random() * tagColors.length)];
    const div = document.createElement('div');
    div.className = 'entity-card';
    div.innerHTML = `
        <span class="entity-tag ${tagColor}">${tag}</span>
        <div class="entity-title">${entity.university || 'Unknown Entity'}</div>
        <div class="entity-desc">${entity.research_abstract || 'No description available.'}</div>
        <div class="entity-footer">
            <span>Type: ${entity.entity_type || 'lab'}</span>
            ${entity.website ? `<a href="${entity.website}" target="_blank" style="color:var(--primary);text-decoration:none;font-size:12px;">Visit →</a>` : ''}
        </div>`;
    div.onclick = () => openEntityDetail(entity);
    return div;
}

function openEntityDetail(entity) {
    const tags = (entity.climate_tech_focus || []).join(', ') || '—';
    document.getElementById('entity-detail-content').innerHTML = `
        <h2>${entity.university || 'Research Entity'}</h2>
        <p class="modal-subtitle">${entity.entity_type || 'lab'} • ${tags}</p>
        <div style="margin:20px 0;padding:16px;background:var(--primary-dim);border-radius:10px;font-size:14px;line-height:1.7;">
            ${entity.research_abstract || 'No abstract available.'}
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;font-size:13px;color:var(--text-dim);">
            <div><strong style="color:var(--text)">Focus Areas</strong><br>${tags}</div>
            <div><strong style="color:var(--text)">Type</strong><br>${entity.entity_type}</div>
            ${entity.website ? `<div><strong style="color:var(--text)">Website</strong><br><a href="${entity.website}" target="_blank" style="color:var(--primary)">${entity.website}</a></div>` : ''}
            ${entity.like_count !== undefined ? `<div><strong style="color:var(--text)">👍 Likes</strong><br>${entity.like_count}</div>` : ''}
        </div>`;
    document.getElementById('entity-detail-modal').classList.add('open');
}

// ===================== MATCHES =====================
async function loadMatchesView() {
    const loadEl = document.getElementById('matches-loading');
    const listEl = document.getElementById('matches-list');
    const emptyEl = document.getElementById('matches-empty');
    loadEl.style.display = 'block'; listEl.style.display = 'none'; emptyEl.style.display = 'none';

    try {
        const res = await apiFetch('/api/match_records/funders/matches');
        loadEl.style.display = 'none';
        if (res.status === 404 || res.status === 403) {
            document.getElementById('no-profile-banner').style.display = 'flex';
            emptyEl.style.display = 'block'; return;
        }
        if (!res.ok) throw new Error('Failed to load matches');
        const matches = await res.json();
        if (!matches.length) { emptyEl.style.display = 'block'; return; }

        listEl.innerHTML = '';
        matches.forEach(m => listEl.appendChild(buildMatchCard(m)));
        listEl.style.display = 'flex'; listEl.style.flexDirection = 'column';
    } catch (err) {
        loadEl.style.display = 'none';
        document.getElementById('no-profile-banner').style.display = 'flex';
        emptyEl.style.display = 'block';
    }
}

function buildMatchCard(match) {
    const score = match.score ? (match.score * 100).toFixed(1) : '--';
    const entity = match.entity || {};
    const funder = match.funder || {};
    const status = match.status || 'suggested';
    const div = document.createElement('div');
    div.className = 'match-card';
    div.innerHTML = `
        <div class="match-info">
            <h3>${entity.university || funder.name || 'Match Record'}</h3>
            <div class="match-meta">${entity.research_abstract?.slice(0, 100) || match.reason || '—'}...</div>
            <span class="match-status ${status}">${status}</span>
        </div>
        <div class="match-score-wrap">
            <div class="match-score">${score}%</div>
            <div class="match-score-label">AI Score</div>
        </div>`;
    return div;
}

// ===================== MESSAGES =====================
async function loadConversations() {
    const convList = document.getElementById('conv-list');
    convList.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    if (!currentProfile) {
        const pRes = await apiFetch('/api/profiles/me');
        if (pRes.ok) {
            const pd = await pRes.json();
            currentProfile = Array.isArray(pd) ? pd[0] : pd;
        }
    }

    if (!currentProfile) {
        convList.innerHTML = '<div style="padding:20px;color:var(--text-dim);font-size:13px;">No profile found. Register with a role to start messaging.</div>';
        return;
    }

    document.getElementById('no-profile-msg-banner').style.display = 'none';

    try {
        const res = await apiFetch(`/api/messages/conversations?profile_id=${currentProfile.id}`);
        if (!res.ok) throw new Error();
        const convs = await res.json();
        convList.innerHTML = '';
        if (!convs.length) { convList.innerHTML = '<div style="padding:20px;color:var(--text-dim);font-size:13px;">No conversations yet.</div>'; return; }
        convs.forEach(c => {
            const item = document.createElement('div');
            item.className = 'conv-item';
            const other = c.other_profile || {};
            item.innerHTML = `<h4>${other.display_name || other.first_name || 'Unknown'}</h4><p>${c.last_message?.content?.slice(0, 40) || 'No messages yet'}...</p>`;
            item.onclick = () => openConversation(c, other);
            convList.appendChild(item);
        });
    } catch (e) {
        convList.innerHTML = '<div style="padding:20px;color:var(--text-dim);font-size:13px;">Could not load conversations.</div>';
    }
}

async function openConversation(conv, otherProfile) {
    currentConvProfileId = otherProfile.id;
    document.getElementById('conv-placeholder').style.display = 'none';
    const chatArea = document.getElementById('chat-area');
    chatArea.style.display = 'flex'; chatArea.style.flexDirection = 'column';
    document.getElementById('chat-title').textContent = otherProfile.display_name || otherProfile.first_name || 'Chat';

    const msgContainer = document.getElementById('chat-messages');
    msgContainer.innerHTML = '<div class="loading-wrap"><div class="spinner"></div></div>';

    try {
        const res = await apiFetch(`/api/messages/conversation/${otherProfile.id}?profile_id=${currentProfile.id}&limit=50`);
        if (!res.ok) throw new Error();
        const messages = await res.json();
        renderMessages(messages);
    } catch (e) { msgContainer.innerHTML = '<div style="padding:20px;color:var(--text-dim)">Could not load messages.</div>'; }

    // Send button
    document.getElementById('chat-send-btn').onclick = sendMessage;
    document.getElementById('chat-input').onkeydown = (e) => { if (e.key === 'Enter') sendMessage(); };

    // Connect WebSocket
    initWebSocket(otherProfile.id);
}

function renderMessages(messages) {
    const container = document.getElementById('chat-messages');
    container.innerHTML = '';
    messages.forEach(msg => {
        const mine = msg.sender_profile_id === currentProfile?.id;
        const div = document.createElement('div');
        div.className = `chat-msg ${mine ? 'mine' : 'theirs'}`;
        const time = msg.created_at ? new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
        div.innerHTML = `<div class="bubble">${msg.content || '[attachment]'}</div><div class="time">${time}</div>`;
        container.appendChild(div);
    });
    container.scrollTop = container.scrollHeight;
}

async function sendMessage() {
    const input = document.getElementById('chat-input');
    const content = input.value.trim();
    if (!content || !currentConvProfileId || !currentProfile) return;
    input.value = '';

    try {
        const fd = new FormData();
        fd.append('receiver_profile_id', currentConvProfileId);
        fd.append('content', content);
        fd.append('message_type', 'text');
        fd.append('metadata', '{}');
        const res = await fetch(`${API}/api/messages/send?profile_id=${currentProfile.id}`, {
            method: 'POST', headers: { 'Authorization': `Bearer ${token}` }, body: fd
        });
        if (res.ok) {
            const msg = await res.json();
            const container = document.getElementById('chat-messages');
            const div = document.createElement('div');
            div.className = 'chat-msg mine';
            div.innerHTML = `<div class="bubble">${content}</div><div class="time">Just now</div>`;
            container.appendChild(div); container.scrollTop = container.scrollHeight;
        }
    } catch (e) { console.error('Send message failed', e); }
}

function initWebSocket(otherProfileId) {
    if (wsConnection) wsConnection.close();
    try {
        wsConnection = new WebSocket(`ws://localhost:8000/ws/messages?token=${token}&profile_id=${currentProfile.id}`);
        wsConnection.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.sender_profile_id === otherProfileId || data.receiver_profile_id === otherProfileId) {
                const container = document.getElementById('chat-messages');
                const mine = data.sender_profile_id === currentProfile.id;
                const div = document.createElement('div');
                div.className = `chat-msg ${mine ? 'mine' : 'theirs'}`;
                div.innerHTML = `<div class="bubble">${data.content}</div><div class="time">Now</div>`;
                container.appendChild(div); container.scrollTop = container.scrollHeight;
            }
        };
    } catch (e) { console.warn('WebSocket not available', e); }
}

// ===================== ENTITY MODAL =====================
function setupEntityModal() {
    document.getElementById('add-entity-btn')?.addEventListener('click', () => {
        document.getElementById('add-entity-modal').classList.add('open');
    });
    document.getElementById('close-entity-modal').addEventListener('click', () => {
        document.getElementById('add-entity-modal').classList.remove('open');
    });
    document.getElementById('close-detail-modal').addEventListener('click', () => {
        document.getElementById('entity-detail-modal').classList.remove('open');
    });
    document.getElementById('add-entity-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('add-entity-modal')) document.getElementById('add-entity-modal').classList.remove('open');
    });
    document.getElementById('entity-detail-modal').addEventListener('click', (e) => {
        if (e.target === document.getElementById('entity-detail-modal')) document.getElementById('entity-detail-modal').classList.remove('open');
    });
    document.getElementById('entity-form').addEventListener('submit', handleEntityCreate);
}

async function handleEntityCreate(e) {
    e.preventDefault();
    const btn = document.getElementById('entity-submit-btn');
    const errEl = document.getElementById('entity-form-error');
    errEl.style.display = 'none'; btn.disabled = true; btn.textContent = 'Submitting...';

    try {
        const payload = {
            university: document.getElementById('ef-university').value,
            research_abstract: document.getElementById('ef-abstract').value,
            climate_tech_focus: [document.getElementById('ef-focus').value].filter(Boolean),
            website: document.getElementById('ef-url').value || null,
            entity_type: document.getElementById('ef-type').value,
            source: 'user'
        };
        const res = await apiFetch('/api/user_entities/', { method: 'POST', body: JSON.stringify(payload) });
        if (!res.ok) { const d = await res.json(); throw new Error(d.detail || 'Failed to create entity'); }
        document.getElementById('add-entity-modal').classList.remove('open');
        document.getElementById('entity-form').reset();
        loadEntitiesView(); loadStats();
    } catch (err) {
        errEl.textContent = err.message; errEl.style.display = 'block';
    } finally {
        btn.disabled = false; btn.textContent = 'Submit Entity';
    }
}
