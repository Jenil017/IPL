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

        if (data.prediction_report && data.prediction_report.is_coming_soon) {
            document.getElementById('cs-team-a').innerText = data.match_info.team_a;
            document.getElementById('cs-team-b').innerText = data.match_info.team_b;
            // document.getElementById('cs-meta').innerHTML = `Match ${data.match_info.match_number} · IPL ${data.match_info.season} <br> ${data.match_info.date || ''} · ${data.match_info.start_time_ist || 'Time TBA'}`;
            
            document.getElementById('loading').classList.add('hidden');
            document.getElementById('coming-soon-ui').classList.remove('hidden');
            return;
        }

        try {
            renderDashboard(data);
        } catch (renderErr) {
            console.error("Error during UI rendering:", renderErr);
            throw new Error(`UI Mapping Error: ${renderErr.message}. Check console for details.`);
        }
        
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('dashboard-ui').classList.remove('hidden');

    } catch (err) {
        console.error("Dashboard Load Error full trace:", err);
        const loadingEl = document.getElementById('loading');
        loadingEl.style.color = 'var(--danger)';
        loadingEl.innerHTML = `
            <div style="font-weight: 800; font-size: 1.2rem; margin-bottom: 0.5rem;">Failed to load data</div>
            <div style="font-size: 0.9rem; margin-bottom: 1rem;">${err.message}</div>
            <button onclick="location.reload()" class="btn-logout">Retry</button>
        `;
    }
});

function renderDashboard(data) {
    const info = data.match_info;
    const pred = data.prediction_report;
    const sc = data.dimension_scoring;
    
    // Check Toss
    if (!data.toss.winner) {
        document.getElementById('toss-banner').classList.remove('hidden');
    }
    
    // Match Hero
    document.getElementById('team-a').innerText = info.team_a;
    document.getElementById('team-b').innerText = info.team_b;
    document.getElementById('match-meta').innerHTML = `Match ${info.match_number} · IPL ${info.season} <br> ${info.date} · ${info.start_time_ist}`;
    document.getElementById('match-venue').innerText = info.venue_city;
    
    // Prediction Winner Card
    document.getElementById('pred-winner-name').innerText = pred.winner;
    document.getElementById('pred-confidence').innerText = `Confidence: ${pred.confidence_pct}% · ${pred.confidence_level.toUpperCase()}`;
    
    const pctA = sc.final_scores.win_probability.team_a_pct;
    const pctB = sc.final_scores.win_probability.team_b_pct;
    
    document.getElementById('bar-a').style.width = `${pctA}%`;
    document.getElementById('bar-b').style.width = `${pctB}%`;
    document.getElementById('label-a-pct').innerText = `${info.team_a_short} ${pctA}%`;
    document.getElementById('label-b-pct').innerText = `${info.team_b_short} ${pctB}%`;
    
    document.getElementById('pred-expected').innerHTML = `Expected score: ${info.team_a_short} ${pred.expected_team_a_score_range.join('-')} · ${info.team_b_short} ${pred.expected_team_b_score_range.join('-')}<br>Win by: ${sc.final_scores.expected_margin}`;
    
    // Scorecard
    document.getElementById('sc-team-a-lbl').innerText = info.team_a_short;
    document.getElementById('sc-team-b-lbl').innerText = info.team_b_short;
    
    const rows = [
        { name: "Team Strength & Comp / 25", d: sc.D1_team_strength },
        { name: "Venue & Environment / 20", d: sc.D2_venue_environment },
        { name: "Player Form & H2H / 30", d: sc.D3_player_form_h2h },
        { name: "Momentum / 15", d: sc.D4_momentum }
    ];
    
    let scHtml = '';
    rows.forEach(r => {
        const edgeColor = r.d.edge === info.team_a_short ? 'bg-pbks' : (r.d.edge === info.team_b_short ? 'bg-gt' : 'bg-amber');
        scHtml += `
            <div class="sc-row">
                <div>${r.name}</div>
                <div>${r.d.team_a.total}</div>
                <div>${r.d.team_b.total}</div>
                <div><span class="badge ${edgeColor}">${r.d.edge} +${r.d.margin}</span></div>
            </div>
        `;
    });
    // Add total
    scHtml += `
        <div class="sc-row" style="font-weight: 800; font-size: 1.1rem; border-top: 2px solid var(--border); border-bottom: none;">
            <div>Total / 90</div>
            <div>${sc.final_scores.team_a_total}</div>
            <div>${sc.final_scores.team_b_total}</div>
            <div><span class="badge ${sc.final_scores.score_difference > 0 ? (sc.final_scores.predicted_winner.includes(info.team_a_short) ? 'bg-pbks' : 'bg-gt') : ''}">${sc.final_scores.predicted_winner.split(' ')[0]} +${sc.final_scores.score_difference}</span></div>
        </div>
    `;
    document.getElementById('scorecard-rows').innerHTML = scHtml;
    
    // Context Grid
    const vs = data.venue_statistics;
    const w = data.weather;
    const h2h = data.head_to_head;
    
    const ctxCards = [
        { t: "Avg 1st Innings", v: vs.avg_first_innings_score || 'N/A', s: (vs.pitch_type || '').replace(/_/g, ' ') },
        { t: "Batting First Win %", v: `${vs.batting_first_win_pct || 0}%`, s: vs.toss_note || '' },
        { t: "H2H Overall", v: `${h2h.team_a_wins || 0} - ${h2h.team_b_wins || 0}`, s: "Perfectly balanced" },
        { t: "H2H at Venue", v: `${h2h.at_this_venue?.team_a_wins || 0} - ${h2h.at_this_venue?.team_b_wins || 0}`, s: "" },
        { t: "Weather", v: `${w.temperature_c || 0}°C`, s: (w.conditions || '').replace(/_/g, ' ') },
        { t: "Dew Expected", v: (w.dew_expected || 'Unknown').toUpperCase(), s: w.dew_reason || '' }
    ];
    
    let ctxHtml = '';
    ctxCards.forEach(c => {
        ctxHtml += `<div class="glass-card">
            <div class="font-sm text-muted mb-1 font-bold">${c.t}</div>
            <div style="font-size: 1.5rem; font-weight: 700; margin-bottom: 0.5rem;">${c.v}</div>
            <div class="font-sm text-muted">${c.s}</div>
        </div>`;
    });
    document.getElementById('context-grid').innerHTML = ctxHtml;
    
    // Playing XI
    const drawXi = (teamName, colorClass, players) => {
        let h = `<h4 class="${colorClass}" style="margin-bottom: 1rem; font-size: 1.2rem;">${teamName}</h4>`;
        if(!players) return h;
        players.forEach(p => {
            let badges = '';
            if (p.captain) badges += '<span class="badge bg-amber">C</span> ';
            if (p.wicketkeeper) badges += '<span class="badge">WK</span> ';
            if (p.overseas) badges += '<span class="badge" title="Overseas">✈</span> ';
            h += `<div class="player-row">
                <div><strong>${p.name || 'Unknown'}</strong></div>
                <div class="text-muted font-sm">${badges} ${(p.role || '').replace(/_/g, ' ')}</div>
            </div>`;
        });
        return h;
    };
    
    document.getElementById('xi-team-a').innerHTML = drawXi(info.team_a, "text-pbks", data.playing_xi.team_a.players);
    document.getElementById('xi-team-b').innerHTML = drawXi(info.team_b, "text-gt", data.playing_xi.team_b.players);
    
    // Reasons
    document.getElementById('reasons-title').innerText = `3 Reasons ${pred.winner_short} Wins`;
    let resHtml = '';
    pred.three_reasons_team_a_wins.forEach(r => {
        resHtml += `<div class="reason-card" style="border-left-color: ${pred.winner_short === info.team_a_short ? 'var(--pbks)' : 'var(--gt)'}">
            <div class="font-bold mb-1">${r.reason}</div>
            <div class="text-muted font-sm">${r.data}</div>
        </div>`;
    });
    document.getElementById('reasons-list').innerHTML = resHtml;
    
    // Upset
    const loser = pred.winner_short === info.team_a_short ? info.team_b_short : info.team_a_short;
    document.getElementById('upset-title').innerText = `${loser}'s Path To Victory`;
    let upsHtml = '';
    pred.team_b_path_to_victory.forEach(c => {
        upsHtml += `<div class="reason-card" style="border-left-color: var(--warning)">
            <div class="font-sm text-muted">${c}</div>
        </div>`;
    });
    document.getElementById('upset-list').innerHTML = upsHtml;
    document.getElementById('upset-prob').innerText = `If all 3 happen: ${pred.team_b_upset_probability_if_all_3_happen}% Win Probability`;
    
    // Matchups
    let muHtml = '';
    h2h.key_player_matchups.forEach(m => {
        muHtml += `<div class="glass-card">
            <div class="font-bold mb-1">⚔️ ${m.batter} vs ${m.bowler}</div>
            <div class="badge ${m.advantage === 'bowler' ? 'bg-gt' : (m.advantage === 'batter' ? 'bg-pbks' : 'bg-amber')} mt-1 mb-1">${m.advantage.toUpperCase()} EDGE</div>
            <div class="text-muted font-sm">${m.note}</div>
        </div>`;
    });
    document.getElementById('matchups-grid').innerHTML = muHtml;
    
    // Data Limitations
    document.getElementById('limitations-list').innerHTML = pred.data_limitations.map(l => `<div>• ${l}</div>`).join('');
}
