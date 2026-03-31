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
        }
    } catch (e) { console.error(e); }
}

function renderMatches(matches) {
    const tbody = document.getElementById('matches-body');
    if (!tbody) return;

    if (matches.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" class="text-muted">No uploaded matches found.</td></tr>';
        return;
    }

    const hasManualFeaturedMatch = matches.some(m => m.is_featured);
    let html = '';
    
    matches.forEach((m, index) => {
        const statusBadge = m.is_featured
            ? '<span class="badge bg-success" style="background:#10B981">LIVE ON DASHBOARD</span>'
            : (!hasManualFeaturedMatch && index === 0)
                ? '<span class="badge bg-amber">AUTO ON DASHBOARD</span>'
                : '<span class="text-muted font-sm">Standby</span>';
        
        const actionBtn = m.is_featured
            ? `<button class="btn-logout" style="border-color:var(--danger); color:var(--danger)" onclick="setFeatured(${m.id}, false)">Reset to Auto</button>`
            : `<button class="btn-logout" style="border-color:var(--gt); color:var(--gt)" onclick="setFeatured(${m.id}, true)">Set as Dashboard</button>`;
        
        html += `
            <tr>
                <td class="font-bold">${m.match_id}</td>
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
