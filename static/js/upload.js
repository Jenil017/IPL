document.addEventListener('DOMContentLoaded', () => {
    requireAuth(['admin']);

    const form = document.getElementById('upload-form');
    const statusDiv = document.getElementById('upload-status');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const fileInput = document.getElementById('json-file');
        if (fileInput.files.length === 0) return;
        
        const file = fileInput.files[0];
        
        const formData = new FormData();
        formData.append('file', file);
        
        statusDiv.innerText = "Uploading...";
        statusDiv.className = "text-muted";
        
        try {
            const res = await fetchWithAuth('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await res.json();
            
            if (res.ok) {
                statusDiv.innerText = `Success! Prediction ID: ${data.id}`;
                statusDiv.className = "text-success";
                fileInput.value = "";
                setTimeout(() => {
                    window.location.href = '/static/dashboard.html';
                }, 1500);
            } else {
                statusDiv.innerText = `Error: ${data.detail || 'Upload failed'}`;
                statusDiv.className = "text-danger";
            }
        } catch (error) {
            statusDiv.innerText = "Network error";
            statusDiv.className = "text-danger";
        }
    });
});
