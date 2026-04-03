/* ===== TEAM COLOR MAP ===== */
const TEAM_COLORS = {
    CSK:  '#D4A017',
    MI:   '#004BA0',
    RCB:  '#D4213D',
    DC:   '#0047AB',
    KKR:  '#3A225D',
    PBKS: '#DC2626',
    RR:   '#E73895',
    SRH:  '#FF822A',
    GT:   '#1B2133',
    LSG:  '#A4D65E',
};

function getTeamColor(short) {
    if (!short) return '#78716C';
    return TEAM_COLORS[short.toUpperCase()] || '#78716C';
}

function setTeamColors(teamAShort, teamBShort) {
    const root = document.documentElement;
    root.style.setProperty('--team-a-color', getTeamColor(teamAShort));
    root.style.setProperty('--team-b-color', getTeamColor(teamBShort));
}

/* ===== MAIN LOAD ===== */
document.addEventListener('DOMContentLoaded', async () => {
    requireAuth();

    try {
        const res = await fetchWithAuth('/predictions/latest');

        if (res.status === 404) {
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('no-data').classList.remove('hidden');
            return;
        }

        if (!res.ok) {
            let errorDetail = res.statusText;
            try {
                const errData = await res.json();
                if (errData.detail) errorDetail = errData.detail;
            } catch(e) {}
            throw new Error(`Server Error (${res.status}): ${errorDetail}`);
        }

        let data;
        try {
            data = await res.json();
        } catch (jsonErr) {
            throw new Error("Failed to parse JSON response from server.");
        }

        // Coming soon flow
        if (data.prediction_report && data.prediction_report.is_coming_soon) {
            const mi = data.match_info;
            setTeamColors(mi.team_a_short, mi.team_b_short);
            document.getElementById('cs-team-a').innerText = mi.team_a;
            document.getElementById('cs-team-b').innerText = mi.team_b;
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('coming-soon-ui').classList.remove('hidden');
            return;
        }

        try {
            renderDashboard(data);
        } catch (renderErr) {
            console.error("Render error:", renderErr);
            throw new Error(`UI Error: ${renderErr.message}`);
        }

        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard-ui').classList.remove('hidden');

    } catch (err) {
        console.error("Dashboard Error:", err);
        const el = document.getElementById('loading');
        el.style.color = 'var(--danger)';
        el.innerHTML = `
            <div style="font-weight: 800; font-size: 1.2rem; margin-bottom: 0.5rem;">Failed to load data</div>
            <div style="font-size: 0.9rem; margin-bottom: 1rem;">${err.message}</div>
            <button onclick="location.reload()" class="btn-logout">Retry</button>
        `;
    }
});

/* ===== RENDER ===== */
function renderDashboard(data) {
    const info = data.match_info;
    const pred = data.prediction_report;
    const sc = data.dimension_scoring;
    const fs = sc.final_scores;

    // Set dynamic team colors
    setTeamColors(info.team_a_short, info.team_b_short);

    const winnerIsA = pred.winner_short === info.team_a_short;
    const loserShort = winnerIsA ? info.team_b_short : info.team_a_short;
    const loserFull = winnerIsA ? info.team_b : info.team_a;

    // --- Correction Banner ---
    if (data.correction_notes) {
        const banner = document.getElementById('correction-banner');
        banner.innerText = data.correction_notes;
        banner.classList.remove('hidden');
    }

    // --- Result Banner ---
    const tossStatus = data.toss && data.toss.winner ? `Toss: ${data.toss.winner} elected to ${data.toss.decision}` : 'Toss pending';
    document.getElementById('result-tier').innerText = `Pre-match prediction · IPL ${info.season} Match ${info.match_number} · ${tossStatus}`;
    document.getElementById('result-winner').innerText = pred.winner;

    const pctA = fs.win_probability ? fs.win_probability.team_a_pct : 50;
    const pctB = fs.win_probability ? fs.win_probability.team_b_pct : 50;

    document.getElementById('result-sub').innerText = `Win probability: ${winnerIsA ? pctA : pctB}% · Confidence: ${(pred.confidence_level || '').toUpperCase()} · Score ${fs.team_b_total || '?'}/${fs.max_total || 90} vs ${info.team_a_short} ${fs.team_a_total || '?'}/${fs.max_total || 90}`;

    // --- Win Probability Gauge ---
    document.getElementById('gauge-team-a-name').innerText = info.team_a;
    document.getElementById('gauge-team-b-name').innerText = info.team_b;
    document.getElementById('gauge-team-a-pct').innerText = pctA + '%';
    document.getElementById('gauge-team-b-pct').innerText = pctB + '%';
    document.getElementById('bar-a').style.width = pctA + '%';
    document.getElementById('bar-b').style.width = pctB + '%';

    let confText = `${(pred.confidence_level || 'Medium').charAt(0).toUpperCase() + (pred.confidence_level || 'medium').slice(1)} confidence`;
    if (!data.toss || !data.toss.winner) confText += ' · Toss pending';
    document.getElementById('conf-pill').innerText = confText;

    // --- Key Highlights Metric Grid ---
    if (data.key_highlights && data.key_highlights.length > 0) {
        const grid = document.getElementById('highlights-grid');
        grid.classList.remove('hidden');
        const sentimentColors = {
            warning: 'var(--warning)',
            danger: 'var(--danger)',
            negative: 'var(--danger)',
            positive: 'var(--success)',
            info: 'var(--info)',
            neutral: 'var(--text-primary)',
        };
        grid.innerHTML = data.key_highlights.map(h => {
            const color = sentimentColors[h.sentiment] || 'var(--text-primary)';
            return `<div class="metric">
                <div class="metric-label">${esc(h.label)}</div>
                <div class="metric-val" style="color:${color}">${esc(h.value)}</div>
                ${h.note ? `<div class="metric-sub">${esc(h.note)}</div>` : ''}
            </div>`;
        }).join('');
    }

    // --- Toss Scenarios ---
    if (data.toss_scenarios && data.toss_scenarios.length > 0) {
        document.getElementById('toss-section').classList.remove('hidden');
        const tg = document.getElementById('toss-grid');
        tg.innerHTML = data.toss_scenarios.map(ts => {
            const displayTeam = ts.favored_team_override || ts.favored_team;
            const color = getTeamColor(displayTeam);
            return `<div class="toss-card">
                <div class="toss-title" style="color:${color}">${esc(ts.condition)}</div>
                <div class="toss-winner" style="color:${color}">${esc(displayTeam)} ${ts.probability_pct}%</div>
                <div class="toss-detail">${esc(ts.detail)}</div>
            </div>`;
        }).join('');
    }

    // --- Dimension Scoring Table ---
    const maxTotal = fs.max_total || 90;
    document.getElementById('dim-section-label').innerText = `4-dimension scoring (out of ${maxTotal})`;
    document.getElementById('dim-th-a').innerText = info.team_a_short;
    document.getElementById('dim-th-b').innerText = info.team_b_short;

    const dims = [
        { key: 'D1_team_strength', fallback: 'Strength & composition' },
        { key: 'D2_venue_environment', fallback: 'Venue & environment' },
        { key: 'D3_player_form_h2h', fallback: 'Player form & H2H' },
        { key: 'D4_momentum', fallback: 'Momentum & context' },
    ];

    let tbody = '';
    dims.forEach(d => {
        const dim = sc[d.key];
        if (!dim) return;
        const label = dim.label || d.fallback;
        const sub = dim.sub_label || '';
        const max = dim.max || 25;
        const aTotal = dim.team_a.total;
        const bTotal = dim.team_b.total;
        const aPct = Math.round((aTotal / max) * 100);
        const bPct = Math.round((bTotal / max) * 100);
        const edge = dim.edge || '';
        const edgeIsA = edge === info.team_a_short;
        const badgeClass = edgeIsA ? 'badge-team-a' : 'badge-team-b';

        tbody += `<tr>
            <td>
                <div>${esc(label)}</div>
                ${sub ? `<div class="dim-note">${esc(sub)}</div>` : ''}
            </td>
            <td>
                <span style="color:${getTeamColor(info.team_a_short)};font-weight:500">${aTotal}/${max}</span>
                <span class="mini-bar-wrap"><span class="mini-bar-fill" style="width:${aPct}%;background:${getTeamColor(info.team_a_short)}"></span></span>
            </td>
            <td>
                <span style="color:${getTeamColor(info.team_b_short)};font-weight:500">${bTotal}/${max}</span>
                <span class="mini-bar-wrap"><span class="mini-bar-fill" style="width:${bPct}%;background:${getTeamColor(info.team_b_short)}"></span></span>
            </td>
            <td><span class="winner-badge ${badgeClass}">${esc(edge)}</span></td>
        </tr>`;
    });

    // Total row
    const aTot = fs.team_a_total || 0;
    const bTot = fs.team_b_total || 0;
    const winnerLabel = pred.winner_short || (aTot > bTot ? info.team_a_short : info.team_b_short);
    const totalBadgeClass = aTot > bTot ? 'badge-team-a' : 'badge-team-b';
    tbody += `<tr class="dim-total-row">
        <td>Total</td>
        <td><span style="color:${getTeamColor(info.team_a_short)};font-weight:600">${aTot}/${maxTotal}</span></td>
        <td><span style="color:${getTeamColor(info.team_b_short)};font-weight:600">${bTot}/${maxTotal}</span></td>
        <td><span class="winner-badge ${totalBadgeClass}">${esc(winnerLabel)}</span></td>
    </tr>`;

    document.getElementById('dim-tbody').innerHTML = tbody;

    // --- Why Winner Wins (3 Reasons) ---
    const reasons = pred.three_reasons_winner_wins || pred.three_reasons_team_a_wins || [];
    document.getElementById('reasons-label').innerText = `Why ${pred.winner_short} wins — ${reasons.length} critical reasons`;

    const rl = document.getElementById('reasons-list');
    rl.innerHTML = reasons.map((r, i) => {
        const title = r.title || r.reason || '';
        const detail = r.detail || r.data || '';
        return `<div class="factor-row">
            <div class="factor-icon icon-pos">${i + 1}</div>
            <div class="factor-text"><strong>${esc(title)}</strong> ${esc(detail)}</div>
        </div>`;
    }).join('');

    // --- Key Matchups ---
    if (data.key_matchups && data.key_matchups.length > 0) {
        document.getElementById('matchups-section').classList.remove('hidden');
        const ml = document.getElementById('matchups-list');
        ml.innerHTML = data.key_matchups.map(m => {
            const edgeTeam = m.edge || '';
            const isA = edgeTeam === info.team_a_short;
            const badgeCls = isA ? 'badge-team-a' : 'badge-team-b';
            return `<div class="matchup-row">
                <div>
                    <div class="matchup-title">${esc(m.title)}</div>
                    <div class="matchup-detail">${esc(m.detail)}</div>
                </div>
                <span class="edge-badge ${badgeCls}">${esc(edgeTeam)} edge</span>
            </div>`;
        }).join('');
    } else if (data.head_to_head && data.head_to_head.key_player_matchups && data.head_to_head.key_player_matchups.length > 0) {
        // Fallback to old format
        document.getElementById('matchups-section').classList.remove('hidden');
        const ml = document.getElementById('matchups-list');
        ml.innerHTML = data.head_to_head.key_player_matchups.map(m => {
            return `<div class="matchup-row">
                <div>
                    <div class="matchup-title">⚔️ ${esc(m.batter)} vs ${esc(m.bowler)}</div>
                    <div class="matchup-detail">${esc(m.note)}</div>
                </div>
                <span class="edge-badge ${m.advantage === 'bowler' ? 'badge-team-b' : 'badge-team-a'}">${esc(m.advantage)} edge</span>
            </div>`;
        }).join('');
    }

    // --- Loser's Path to Victory ---
    const upsetReasons = pred.loser_path_to_victory || pred.team_b_path_to_victory || [];
    if (upsetReasons.length > 0) {
        document.getElementById('upset-section').classList.remove('hidden');
        document.getElementById('upset-label').innerText = `${loserShort}'s path to victory — all ${upsetReasons.length} must fire`;

        const ul = document.getElementById('upset-list');
        ul.innerHTML = upsetReasons.map((r, i) => {
            const title = typeof r === 'string' ? '' : (r.title || '');
            const detail = typeof r === 'string' ? r : (r.detail || '');
            return `<div class="factor-row">
                <div class="factor-icon icon-warn">!</div>
                <div class="factor-text">${title ? `<strong>${esc(title)}</strong> ` : ''}${esc(detail)}</div>
            </div>`;
        }).join('');
    }

    // --- Risk Register ---
    if (data.risk_register && data.risk_register.length > 0) {
        document.getElementById('risk-section').classList.remove('hidden');
        const rl2 = document.getElementById('risk-list');
        rl2.innerHTML = data.risk_register.map(r => {
            const sevClass = r.severity === 'high' ? 'risk-high' : (r.severity === 'medium' ? 'risk-med' : 'risk-low');
            return `<div class="risk-row">
                <div class="risk-label ${sevClass}">${esc(r.severity)}</div>
                <div class="risk-text"><strong>${esc(r.title)}</strong> ${esc(r.detail)}</div>
            </div>`;
        }).join('');
    }

    // --- Match Context ---
    const vs = data.venue_statistics || {};
    const w = data.weather || {};
    const h2h = data.head_to_head || {};

    const ctxCards = [
        { t: "Avg 1st Innings", v: vs.avg_first_innings_score || 'N/A', s: (vs.pitch_type || '').replace(/_/g, ' ') },
        { t: "Bat First Win %", v: `${vs.batting_first_win_pct || 0}%`, s: vs.toss_note || '' },
        { t: "H2H Overall", v: `${h2h.team_a_wins || 0} - ${h2h.team_b_wins || 0}`, s: '' },
        { t: "H2H Venue", v: h2h.at_this_venue ? `${h2h.at_this_venue.team_a_wins || 0} - ${h2h.at_this_venue.team_b_wins || 0}` : 'N/A', s: '' },
        { t: "Weather", v: `${w.temperature_c || 0}°C`, s: (w.conditions || '').replace(/_/g, ' ') },
        { t: "Dew", v: (w.dew_expected || 'Unknown'), s: w.dew_reason || '' },
    ];

    const ctxEl = document.getElementById('context-grid');
    ctxEl.innerHTML = ctxCards.map(c =>
        `<div class="glass-card">
            <div class="font-xs text-muted font-bold" style="margin-bottom:2px">${c.t}</div>
            <div style="font-size:1.1rem;font-weight:600;margin-bottom:2px">${c.v}</div>
            ${c.s ? `<div class="font-xs text-secondary">${c.s}</div>` : ''}
        </div>`
    ).join('');

    // --- Playing XI ---
    const xiA = data.playing_xi ? data.playing_xi.team_a : null;
    const xiB = data.playing_xi ? data.playing_xi.team_b : null;
    document.getElementById('xi-team-a').innerHTML = drawXi(info.team_a, info.team_a_short, xiA ? xiA.players : null);
    document.getElementById('xi-team-b').innerHTML = drawXi(info.team_b, info.team_b_short, xiB ? xiB.players : null);

    // --- Data Limitations ---
    const lims = pred.data_limitations || [];
    if (lims.length > 0) {
        document.getElementById('limitations-section').classList.remove('hidden');
        document.getElementById('limitations-list').innerHTML = lims.map(l => `<div style="margin-bottom:3px">• ${esc(l)}</div>`).join('');
    }
}

/* ===== HELPERS ===== */
function drawXi(teamName, teamShort, players) {
    const color = getTeamColor(teamShort);
    let h = `<h4 style="margin-bottom:0.75rem;font-size:1rem;color:${color}">${esc(teamName)}</h4>`;
    if (!players || players.length === 0) {
        h += '<div class="text-muted font-sm">XI not available</div>';
        return h;
    }
    players.forEach(p => {
        let badges = '';
        if (p.captain) badges += `<span class="badge bg-amber" style="font-size:0.6rem">C</span> `;
        if (p.wicketkeeper) badges += `<span class="badge" style="font-size:0.6rem">WK</span> `;
        if (p.overseas) badges += `<span class="badge" style="font-size:0.6rem" title="Overseas">✈</span> `;
        h += `<div class="player-row">
            <div><strong>${esc(p.name || 'Unknown')}</strong></div>
            <div class="text-muted font-sm">${badges}${(p.role || '').replace(/_/g, ' ')}</div>
        </div>`;
    });
    return h;
}

function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
}
