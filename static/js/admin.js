function setComingSoonStatus(msg, isError) {
    const el = document.getElementById('coming-soon-status');
    if (!el) return;
    el.textContent = msg || '';
    el.className = 'font-sm';
    el.style.marginTop = '0.75rem';
    if (msg) el.style.color = isError ? 'var(--danger)' : 'var(--success)';
}

/** Keep dropdowns aligned with the single coming-soon row from the API (after save or on load). */
function syncComingSoonSelects(matches) {
    const t1 = document.getElementById('cs-t1');
    const t2 = document.getElementById('cs-t2');
    if (!t1 || !t2 || !Array.isArray(matches)) return;
    const slot = matches.find((m) => m.is_coming_soon_slot);
    if (!slot || !slot.team_a_short || !slot.team_b_short) return;
    const ok1 = [...t1.options].some((o) => o.value === slot.team_a_short);
    const ok2 = [...t2.options].some((o) => o.value === slot.team_b_short);
    if (ok1) t1.value = slot.team_a_short;
    if (ok2) t2.value = slot.team_b_short;
}

document.addEventListener('DOMContentLoaded', async () => {
    requireAuth(['admin']);
    await loadUsers();
    await loadMatches();

    document.getElementById('add-user-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const u = document.getElementById('new-username').value;
        const p = document.getElementById('new-password').value;
        const statusDiv = document.getElementById('add-status');
        
        try {
            const res = await fetchWithAuth('/admin/users', {
                method: 'POST',
                body: JSON.stringify({ username: u, password: p })
            });
            const data = await res.json();
            
            if (res.ok) {
                statusDiv.innerText = "User created successfully!";
                statusDiv.className = "text-success";
                document.getElementById('add-user-form').reset();
                await loadUsers();
            } else {
                statusDiv.innerText = `Error: ${data.detail}`;
                statusDiv.className = "text-danger";
            }
        } catch (e) {
            statusDiv.innerText = "Network error";
            statusDiv.className = "text-danger";
        }
    });

    const comingSoonForm = document.getElementById('coming-soon-form');
    if (comingSoonForm) {
        comingSoonForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            setComingSoonStatus('', false);
            const t1 = document.getElementById('cs-t1');
            const t2 = document.getElementById('cs-t2');
            const btn = e.target.querySelector('button');
            const originalText = btn.innerText;
            btn.innerText = "Updating...";
            btn.disabled = true;

            if (!t1.value || !t2.value) {
                setComingSoonStatus('Please choose both teams.', true);
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }
            if (t1.value === t2.value) {
                setComingSoonStatus('Home and away must be different teams.', true);
                btn.innerText = originalText;
                btn.disabled = false;
                return;
            }

            const body = {
                team_a: t1.options[t1.selectedIndex].text.split(' (')[0],
                team_b: t2.options[t2.selectedIndex].text.split(' (')[0],
                team_a_short: t1.value,
                team_b_short: t2.value,
            };

            try {
                const res = await fetchWithAuth('/admin/coming-soon', {
                    method: 'PUT',
                    body: JSON.stringify(body),
                });

                const data = await res.json().catch(() => ({}));
                if (res.ok) {
                    t1.value = body.team_a_short;
                    t2.value = body.team_b_short;
                    await loadMatches();
                    setComingSoonStatus('Saved. Dashboard is LIVE with these teams.', false);
                } else if (res.status === 404 || (data.detail && String(data.detail).includes('Not Found'))) {
                    setComingSoonStatus('Server is running old code: PUT /api/admin/coming-soon missing. Redeploy backend, then hard-refresh (Ctrl+Shift+R).', true);
                } else {
                    setComingSoonStatus(`Error: ${data.detail || res.statusText}`, true);
                }
            } catch (err) {
                setComingSoonStatus(`Network error: ${err.message}`, true);
            } finally {
                btn.innerText = originalText;
                btn.disabled = false;
            }
        });
    }
});

async function loadUsers() {
    try {
        const res = await fetchWithAuth('/admin/users');
        if (res.ok) {
            const users = await res.json();
            renderUsers(users);
        }
    } catch (e) { console.error(e); }
}

function renderUsers(users) {
    const tbody = document.getElementById('users-body');
    if (!tbody) return;

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No users found.</td></tr>';
        return;
    }

    let html = '';
    
    users.forEach(u => {
        const roleBadge = u.role === 'admin' ? '<span class="badge bg-gt">Admin</span>' : '<span class="badge bg-pbks">Viewer</span>';
        const activeBadge = u.is_active ? '<span class="text-success font-bold">Active</span>' : '<span class="text-danger font-bold">Inactive</span>';
        
        let actionBtn = '';
        if (u.role !== 'admin') {
            const btnText = u.is_active ? 'Deactivate' : 'Activate';
            actionBtn = `<button class="btn-logout" style="padding: 0.25rem 0.5rem; font-size: 0.8rem;" onclick="toggleUser(${u.id}, ${!u.is_active})">${btnText}</button>`;
        }
        
        html += `
            <tr>
                <td class="font-bold">${u.username}</td>
                <td>${roleBadge}</td>
                <td>${activeBadge}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });
    
    tbody.innerHTML = html;
}

window.toggleUser = async function(id, newState) {
    try {
        const res = await fetchWithAuth(`/admin/users/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ is_active: newState })
        });
        if (res.ok) {
            await loadUsers();
        } else {
            alert("Failed to update user");
        }
    } catch (e) { alert("Network error"); }
}

async function loadMatches() {
    try {
        const res = await fetchWithAuth('/admin/predictions');
        if (res.ok) {
            const matches = await res.json();
            renderMatches(matches);
            syncComingSoonSelects(matches);
        }
    } catch (e) { console.error(e); }
}

function adminMatchIdLabel(m) {
    if (m.is_coming_soon_slot) {
        return '<span class="text-muted font-sm">Coming soon slot</span><br><span class="font-bold" style="font-size:0.8rem;">(one row — teams from form above)</span>';
    }
    return `<span class="font-bold">${m.match_id}</span>`;
}

function renderMatches(matches) {
    const tbody = document.getElementById('matches-body');
    if (!tbody) return;

    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No uploaded matches found.</td></tr>';
        return;
    }

    const hasManualFeaturedMatch = matches.some(m => m.is_featured);
    const firstRealUpload = matches.find(m => !m.is_coming_soon_slot);
    const autoDashboardId = !hasManualFeaturedMatch && firstRealUpload ? firstRealUpload.id : null;

    let html = '';

    matches.forEach((m) => {
        const statusBadge = m.is_featured
            ? '<span class="badge bg-success" style="background:#10B981">LIVE ON DASHBOARD</span>'
            : (autoDashboardId && m.id === autoDashboardId)
                ? '<span class="badge bg-amber">AUTO ON DASHBOARD</span>'
                : '<span class="text-muted font-sm">Standby</span>';

        const actionBtn = m.is_featured
            ? `<button class="btn-logout" style="border-color:var(--danger); color:var(--danger)" onclick="setFeatured(${m.id}, false)">Reset to Auto</button>`
            : `<button class="btn-logout" style="border-color:var(--gt); color:var(--gt)" onclick="setFeatured(${m.id}, true)">Set as Dashboard</button>`;

        html += `
            <tr>
                <td>${adminMatchIdLabel(m)}</td>
                <td><span class="text-pbks font-bold">${m.team_a_short}</span> vs <span class="text-gt font-bold">${m.team_b_short}</span></td>
                <td>${statusBadge}</td>
                <td>${actionBtn}</td>
            </tr>
        `;
    });

    tbody.innerHTML = html;
}

window.setFeatured = async function(id, status) {
    try {
        const method = status ? 'PATCH' : 'DELETE';
        const url = `/admin/predictions/${id}/feature`;
        const res = await fetchWithAuth(url, { method });

        const text = await res.text();
        let data;
        try {
            data = JSON.parse(text);
        } catch (e) {
            alert(`Server error (${res.status}): ${text}`);
            return;
        }
        
        if (res.ok) {
            await loadMatches();
            alert(status ? "Dashboard is now showing this match!" : "Dashboard reset. It will now show the latest upload.");
        } else {
            alert("Failed to update dashboard settings: " + (data.detail || "Unknown error"));
        }
    } catch (e) { 
        console.error("Network error:", e); 
        alert("Network error: " + e.message); 
    }
}
