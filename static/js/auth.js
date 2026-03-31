const API_BASE = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function setToken(token) {
    localStorage.setItem('token', token);
}

function removeToken() {
    localStorage.removeItem('token');
}

function parseJwt(token) {
    try {
        const base64Url = token.split('.')[1];
        const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = decodeURIComponent(atob(base64).split('').map(function(c) {
            return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2);
        }).join(''));
        return JSON.parse(jsonPayload);
    } catch (e) {
        return null;
    }
}

function getCurrentUser() {
    const token = getToken();
    if (!token) return null;
    const payload = parseJwt(token);
    if (!payload || payload.exp * 1000 < Date.now()) {
        removeToken();
        return null;
    }
    return payload; // {sub: "jainil", role: "admin", exp: ...}
}

function requireAuth(allowedRoles = ['admin', 'viewer']) {
    const user = getCurrentUser();
    if (!user) {
        window.location.href = '/static/index.html';
        return null;
    }
    if (!allowedRoles.includes(user.role)) {
        window.location.href = '/static/dashboard.html';
        return null;
    }
    setupNavbar(user);
    return user;
}

function setupNavbar(user) {
    const btnLogout = document.getElementById('btn-logout');
    if (btnLogout) {
        btnLogout.innerText = `Logout (${user.sub})`;
        btnLogout.addEventListener('click', () => {
            removeToken();
            window.location.href = '/static/index.html';
        });
    }

    if (user.role === 'admin') {
        document.querySelectorAll('.admin-only').forEach(el => el.classList.remove('hidden'));
    }
}

async function fetchWithAuth(url, options = {}) {
    const token = getToken();
    if (!token) throw new Error("No token");
    
    const headers = options.headers || {};
    if (!(options.body instanceof FormData)) {
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
    }
    headers['Authorization'] = `Bearer ${token}`;
    
    const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers
    });
    
    if (response.status === 401) {
        removeToken();
        window.location.href = '/static/index.html';
    }
    return response;
}
