// 1. Initialize history from localStorage (or start empty if first time)
let conversationHistory = JSON.parse(localStorage.getItem('myra_chat_history')) || [];
let uploadedDocument = null;

function appendMessage(role, text, extraClass = '') {
    const chatbox = document.getElementById('chatbox');
    const messageWrapper = document.createElement('div');
    messageWrapper.className = `message ${role} ${extraClass}`.trim();

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble';
    bubble.innerHTML = text;

    messageWrapper.appendChild(bubble);
    chatbox.appendChild(messageWrapper);
    chatbox.scrollTop = chatbox.scrollHeight;
}

function setUploadStatus(message, isError = false) {
    const status = document.getElementById('upload-status');
    if (status) {
        status.textContent = message;
        status.style.color = isError ? '#ffd4d4' : '#eaf7ff';
    }
}

async function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 8 * 1024 * 1024) {
        setUploadStatus('File is too large. Please use a file smaller than 8 MB.', true);
        return;
    }

    const name = file.name.toLowerCase();
    const isTextFile = /\.(txt|md|json|csv|rtf|html|htm|xml)$/i.test(name);
    const isPdf = name.endsWith('.pdf');
    const isOfficeFile = /\.(doc|docx|ppt|pptx|xls|xlsx)$/i.test(name);

    try {
        let text = '';

        if (isTextFile) {
            text = await file.text();
        } else if (isPdf || isOfficeFile) {
            const formData = new FormData();
            formData.append('file', file);

            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const data = await response.json();
            if (!response.ok || !data.text) {
                throw new Error(data.error || 'Unable to extract text from the file.');
            }
            text = data.text;
        } else {
            throw new Error('Unsupported file type. Please upload a text, PDF, or office-style document.');
        }

        uploadedDocument = { name: file.name, text };
        setUploadStatus(`Attached: ${file.name}`);
    } catch (error) {
        setUploadStatus(error.message || 'Could not read the file. Please upload a text, PDF, or office-style document.', true);
    }
}

async function sendMessage() {
    const inputElement = document.getElementById('user-input');
    const button = document.getElementById('send-btn');
    const message = inputElement.value.trim();

    if (!message) return;

    // Display user message and clear inputs
    appendMessage('user', message.replace(/\n/g, '<br>'));
    inputElement.value = '';
    button.disabled = true;
    inputElement.disabled = true;

    // 2. Save using your flat array style
    conversationHistory.push({ role: 'user', parts: { text: message } });
    localStorage.setItem('myra_chat_history', JSON.stringify(conversationHistory));

    // Show the "Thinking..." bubble
    const thinkingId = `thinking-${Date.now()}`;
    const thinkingWrapper = document.createElement('div');
    thinkingWrapper.className = 'message ai';
    thinkingWrapper.id = thinkingId;

    const bubble = document.createElement('div');
    bubble.className = 'message-bubble thinking';
    bubble.textContent = 'Thinking...';

    thinkingWrapper.appendChild(bubble);
    document.getElementById('chatbox').appendChild(thinkingWrapper);
    document.getElementById('chatbox').scrollTop = document.getElementById('chatbox').scrollHeight;

    try {
        const payload = { history: conversationHistory };
        if (uploadedDocument) {
            payload.documentName = uploadedDocument.name;
            payload.documentText = uploadedDocument.text;
        }

        const response = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload) 
        });

        const data = await response.json();
        
        // Remove the loading indicator bubble
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) {
            thinkingEl.remove();
        }
        
        // Render Myra's complete reply on screen
        appendMessage('ai', `<strong>MYRA:</strong> ${data.reply.replace(/\n/g, '<br>')}`);

        // 4. Record MYRA's reply into local history tracking
        conversationHistory.push({ role: 'model', parts: { text: data.reply } });
        localStorage.setItem('myra_chat_history', JSON.stringify(conversationHistory));

    } catch (error) {
        const thinkingEl = document.getElementById(thinkingId);
        if (thinkingEl) {
            thinkingEl.remove();
        }
        appendMessage('ai', '<span style="color:#ff6b6b;">Error connecting to server.</span>');
        
        // Revert last array add if network failed completely to keep memory clear
        conversationHistory.pop();
        localStorage.setItem('myra_chat_history', JSON.stringify(conversationHistory));
    } finally {
        // FIX: Clear the attachment from memory and clear the DOM file input
        uploadedDocument = null;
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = "";
        setUploadStatus(''); // Resets status bar text to blank after message sends

        button.disabled = false;
        inputElement.disabled = false;
        inputElement.focus();
    }
}

function clearConversationHistory() {
    localStorage.removeItem('myra_chat_history');
    conversationHistory = [];
    uploadedDocument = null;
    setUploadStatus('No document attached');
    const chatbox = document.getElementById('chatbox');
    if (chatbox) {
        chatbox.innerHTML = '';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const button = document.getElementById('send-btn');
    const input = document.getElementById('user-input');
    const clearButton = document.getElementById('clear-history-btn');
    const uploadButton = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');

    // 5. FIXED: Corrected text selection fallback so it reads previous chats safely without crashing
    conversationHistory.forEach(msg => {
        let msgText = "";
        if (msg.parts) {
            if (Array.isArray(msg.parts) && msg.parts[0]) {
                msgText = msg.parts[0].text || "";
            } else {
                msgText = msg.parts.text || "";
            }
        }
        
        if (msg.role === 'user') {
            appendMessage('user', msgText.replace(/\n/g, '<br>'));
        } else {
            appendMessage('ai', `<strong>MYRA:</strong> ${msgText.replace(/\n/g, '<br>')}`);
        }
    });

    if (button) {
        button.addEventListener('click', sendMessage);
    }

    if (input) {
        input.addEventListener('keydown', (event) => {
            if (event.key === 'Enter') {
                event.preventDefault();
                sendMessage();
            }
        });
    }

    if (clearButton) {
        clearButton.addEventListener('click', () => {
            clearConversationHistory();
        });
    }

    if (uploadButton && fileInput) {
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });

        fileInput.addEventListener('change', handleFileUpload);
    }
});

window.sendMessage = sendMessage;
