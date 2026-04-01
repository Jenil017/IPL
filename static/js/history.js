let currentMatches = [];
let currentAdminUser = null;

document.addEventListener('DOMContentLoaded', async () => {
    currentAdminUser = requireAuth();
    
    await loadAccuracy();
    await loadHistory();
    
    document.getElementById('btn-cancel-modal').addEventListener('click', () => {
        document.getElementById('result-modal').classList.add('hidden');
    });
});

async function loadAccuracy() {
    try {
        const res = await fetchWithAuth('/accuracy');
        if (res.ok) {
            const data = await res.json();
            document.getElementById('acc-total').innerText = data.total;
            document.getElementById('acc-pct').innerText = `${data.accuracy_pct}%`;
            document.getElementById('acc-correct').innerText = data.correct;
            document.getElementById('acc-incorrect').innerText = data.incorrect;
            
            document.getElementById('acc-high').innerText = `${data.high_accuracy_pct}%`;
            document.getElementById('acc-med').innerText = `${data.medium_accuracy_pct}%`;
            document.getElementById('acc-low').innerText = `${data.low_accuracy_pct}%`;
        }
    } catch (e) { console.error(e); }
}

async function loadHistory() {
    try {
        const res = await fetchWithAuth('/predictions');
        if (res.ok) {
            currentMatches = await res.json();
            
            currentMatches.sort((a, b) => {
                const numA = (a.match_number != null && a.match_number !== '')
                    ? parseInt(a.match_number, 10)
                    : (parseInt(String(a.match_id).replace(/\D/g, ''), 10) || 0);
                const numB = (b.match_number != null && b.match_number !== '')
                    ? parseInt(b.match_number, 10)
                    : (parseInt(String(b.match_id).replace(/\D/g, ''), 10) || 0);
                return numA - numB;
            });
            
            renderTable();
        }
    } catch (e) { console.error(e); }
}

function formatMatchLabel(m) {
    const n = (m.match_number != null && m.match_number !== '')
        ? parseInt(m.match_number, 10)
        : (parseInt(String(m.match_id).replace(/\D/g, ''), 10) || 0);
    return 'M' + String(n).padStart(2, '0');
}

function renderTable() {
    const tbody = document.getElementById('history-body');
    let html = '';
    
    currentMatches.forEach(m => {
        let resultHtml = '';
        let actionHtml = '';
        
        if (m.is_correct === null) {
            resultHtml = '<span class="badge bg-amber">Pending</span>';
            if (currentAdminUser && currentAdminUser.role === 'admin') {
                actionHtml = `<button class="btn-logout" style="padding: 0.25rem 0.5rem; font-size: 0.75rem;" onclick="openResultModal(${m.id})">Mark Result</button>`;
            }
        } else {
            const icon = m.is_correct ? '✅' : '❌';
            const color = m.is_correct ? 'text-success' : 'text-danger';
            resultHtml = `<span class="${color} font-bold">${icon} ${m.actual_winner_short}</span>`;
            actionHtml = `<span class="text-muted font-sm">—</span>`;
        }
        
        const adminClass = (currentAdminUser && currentAdminUser.role === 'admin') ? '' : 'hidden';
        const ready = m.prediction_ready === true;
        const predCell = ready && m.predicted_winner_short
            ? `<td class="font-bold">${m.predicted_winner_short}</td>`
            : '<td class="text-muted">—</td>';
        const confCell = ready && m.confidence_pct != null
            ? `<td class="font-sm">${m.confidence_pct}%</td>`
            : '<td class="text-muted">—</td>';
        
        html += `
            <tr>
                <td class="font-bold">${formatMatchLabel(m)}</td>
                <td class="text-muted font-sm">${m.match_date}</td>
                <td><span class="text-pbks font-bold">${m.team_a_short}</span> vs <span class="text-gt font-bold">${m.team_b_short}</span></td>
                ${predCell}
                ${confCell}
                <td>${resultHtml}</td>
                <td class="action-col ${adminClass}">${actionHtml}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
    
    if (currentAdminUser && currentAdminUser.role === 'admin') {
        document.querySelectorAll('.action-col').forEach(e => e.classList.remove('hidden'));
    }
}

let activeMatchId = null;

window.openResultModal = function(id) {
    const match = currentMatches.find(m => m.id === id);
    if (!match) return;
    
    activeMatchId = id;
    document.getElementById('modal-match-title').innerText = `${match.team_a_short} vs ${match.team_b_short}`;
    
    const btnA = document.getElementById('btn-win-a');
    const btnB = document.getElementById('btn-win-b');
    
    btnA.innerText = match.team_a_short + ' WINS';
    btnA.onclick = () => submitResult(match.team_a_short, match.team_a_short); 
    
    btnB.innerText = match.team_b_short + ' WINS';
    btnB.onclick = () => submitResult(match.team_b_short, match.team_b_short);
    
    document.getElementById('result-modal').classList.remove('hidden');
}

async function submitResult(winner, winner_short) {
    if (!activeMatchId) return;
    
    try {
        const res = await fetchWithAuth(`/predictions/${activeMatchId}/result`, {
            method: 'PATCH',
            body: JSON.stringify({ actual_winner: winner, actual_winner_short: winner_short })
        });
        
        if (res.ok) {
            document.getElementById('result-modal').classList.add('hidden');
            await loadHistory();
            await loadAccuracy();
        } else {
            alert("Failed to update result");
        }
    } catch (e) {
        alert("Network error");
    }
}
