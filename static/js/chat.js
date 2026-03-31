document.addEventListener('DOMContentLoaded', () => {
    const user = requireAuth();
    if (!user) return;

    const token = getToken();
    const username = user.sub;

    const chatMessages = document.getElementById('chat-messages');
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const imageInput = document.getElementById('image-input');
    const previewBar = document.getElementById('image-preview-bar');
    const previewThumb = document.getElementById('image-preview-thumb');
    const previewName = document.getElementById('image-preview-name');
    const statusDot = document.getElementById('ws-status-dot');
    const statusText = document.getElementById('ws-status-text');

    let socket = null;
    let selectedFile = null;

    // ── Load chat history ──
    async function loadHistory() {
        try {
            const response = await fetchWithAuth('/chat/history');
            if (response.ok) {
                const history = await response.json();
                chatMessages.innerHTML = '';
                if (history.length === 0) {
                    chatMessages.innerHTML = `
                        <div class="chat-empty">
                            <div class="chat-empty-icon">🏏</div>
                            No messages yet. Start the IPL discussion!
                        </div>`;
                }
                history.forEach(msg => appendMessage(msg, msg.sender === username));
                scrollToBottom();
            }
        } catch (error) {
            console.error('Failed to load chat history:', error);
            chatMessages.innerHTML = `
                <div class="chat-empty">
                    <div class="chat-empty-icon">⚠️</div>
                    Failed to load chat history
                </div>`;
        }
    }

    // ── WebSocket connection ──
    function connectWS() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/api/chat/ws?token=${token}`;

        setStatus('connecting');
        socket = new WebSocket(wsUrl);

        socket.onopen = () => {
            console.log('Connected to IPL Chat');
            setStatus('connected');
        };

        socket.onmessage = (event) => {
            const data = JSON.parse(event.data);
            // Remove empty placeholder if it exists
            const empty = chatMessages.querySelector('.chat-empty');
            if (empty) empty.remove();
            appendMessage(data, data.sender === username);
            scrollToBottom();
        };

        socket.onerror = () => setStatus('disconnected');

        socket.onclose = () => {
            setStatus('disconnected');
            setTimeout(connectWS, 3000);
        };
    }

    function setStatus(state) {
        statusDot.classList.remove('connected');
        if (state === 'connected') {
            statusDot.classList.add('connected');
            statusText.textContent = 'Connected';
        } else if (state === 'connecting') {
            statusText.textContent = 'Connecting...';
        } else {
            statusText.textContent = 'Reconnecting...';
        }
    }

    // ── Render a message bubble ──
    function appendMessage(msg, isSent) {
        const div = document.createElement('div');
        div.className = `message ${isSent ? 'sent' : 'received'}`;

        const time = new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const safeSender = escapeHtml(msg.sender);
        const safeContent = escapeHtml(msg.content);

        let imageHtml = '';
        if (msg.image_url) {
            imageHtml = `<img src="${msg.image_url}" class="message-image" onclick="window.open('${msg.image_url}')">`;
        }

        div.innerHTML = `
            <div class="message-sender">${safeSender}</div>
            ${safeContent ? `<div class="message-text">${safeContent}</div>` : ''}
            ${imageHtml}
            <div class="message-time">${time}</div>
        `;

        chatMessages.appendChild(div);
    }

    function escapeHtml(text) {
        if (!text) return '';
        const el = document.createElement('div');
        el.textContent = text;
        return el.innerHTML;
    }

    function scrollToBottom() {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // ── Send message ──
    async function sendMessage() {
        const content = chatInput.value.trim();
        if (!content && !selectedFile) return;
        if (!socket || socket.readyState !== WebSocket.OPEN) return;

        let imageUrl = null;

        if (selectedFile) {
            const formData = new FormData();
            formData.append('file', selectedFile);
            try {
                const res = await fetchWithAuth('/chat/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const data = await res.json();
                    imageUrl = data.url;
                } else {
                    return;
                }
            } catch { return; }
        }

        socket.send(JSON.stringify({ content, image_url: imageUrl }));
        chatInput.value = '';
        clearPreview();
        chatInput.focus();
    }

    // ── Image preview ──
    imageInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) { alert('Image must be under 5 MB'); return; }

        selectedFile = file;
        const reader = new FileReader();
        reader.onload = (ev) => {
            previewThumb.src = ev.target.result;
            previewName.textContent = file.name;
            previewBar.classList.add('active');
        };
        reader.readAsDataURL(file);
    };

    window.clearPreview = () => {
        selectedFile = null;
        imageInput.value = '';
        previewBar.classList.remove('active');
        previewThumb.src = '';
        previewName.textContent = '';
    };

    // ── Events ──
    sendBtn.onclick = sendMessage;
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // ── Boot ──
    loadHistory();
    connectWS();
});
