const vscode = acquireVsCodeApi();
const generateBtn = document.getElementById('generate-btn');
const codeInput = document.getElementById('code-input');
const messagesContainer = document.getElementById('messages');

let isGenerating = false;

function addMessage(type, content) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';

    const headerDiv = document.createElement('div');
    headerDiv.className = `message-header ${type}-header`;
    headerDiv.textContent = type === 'user' ? 'You' : 'JUnit Test Generator';

    const contentDiv = document.createElement('div');
    contentDiv.className = `message-content ${type === 'assistant' ? 'assistant-content' : ''}`;
    contentDiv.textContent = content;

    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    messagesContainer.appendChild(messageDiv);

    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }

    scrollToBottom();
}

function addLoadingMessage() {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message loading-message';
    messageDiv.innerHTML = `
        <div class="message-header assistant-header">JUnit Test Generator</div>
        <div class="message-content assistant-content loading">
            <div class="spinner"></div>
            Generating JUnit tests...
        </div>
    `;
    messagesContainer.appendChild(messageDiv);
    scrollToBottom();
}

function removeLoadingMessage() {
    const loadingMessage = messagesContainer.querySelector('.loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function generateTests() {
    const code = codeInput.value.trim();
    if (!code || isGenerating) return;

    isGenerating = true;
    generateBtn.disabled = true;
    generateBtn.textContent = 'Generating...';

    addMessage('user', code);
    addLoadingMessage();

    vscode.postMessage({
        command: 'generate',
        text: code
    });

    codeInput.value = '';
}

generateBtn.addEventListener('click', generateTests);

codeInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        generateTests();
    }
});

// Auto-resize textarea
codeInput.addEventListener('input', () => {
    const minHeight = 80;
    const maxHeight = 200;
    codeInput.style.height = 'auto';
    const newHeight = Math.min(Math.max(codeInput.scrollHeight, minHeight), maxHeight);
    codeInput.style.height = newHeight + 'px';
});

window.addEventListener('message', event => {
    const message = event.data;
    switch (message.command) {
        case 'preloadCode':
            codeInput.value = message.code;
            // Auto-resize the textarea after loading content
            const minHeight = 80;
            const maxHeight = 200;
            codeInput.style.height = 'auto';
            const newHeight = Math.min(Math.max(codeInput.scrollHeight, minHeight), maxHeight);
            codeInput.style.height = newHeight + 'px';
            
            // Show a message indicating the file was loaded
            if (message.fileName) {
                const welcomeMessage = messagesContainer.querySelector('.welcome-message');
                if (welcomeMessage) {
                    const loadedMessage = document.createElement('div');
                    loadedMessage.className = 'loaded-file-message';
                    loadedMessage.innerHTML = `
                        <div style="text-align: center; padding: 20px; background-color: var(--vscode-inputValidation-infoBackground); border: 1px solid var(--vscode-inputValidation-infoBorder); border-radius: 4px; margin-bottom: 16px;">
                            <div style="font-weight: 600; color: var(--vscode-inputValidation-infoForeground);">
                                📁 ${message.fileName} loaded automatically
                            </div>
                            <div style="font-size: 11px; color: var(--vscode-descriptionForeground); margin-top: 4px;">
                                Ready to generate tests for your Java code
                            </div>
                        </div>
                    `;
                    messagesContainer.insertBefore(loadedMessage, welcomeMessage);
                }
            }
            break;
        case 'response':
            removeLoadingMessage();
            addMessage('assistant', message.text);
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Tests';
            break;
        case 'error':
            removeLoadingMessage();
            addMessage('assistant', `Error: ${message.text}`);
            isGenerating = false;
            generateBtn.disabled = false;
            generateBtn.textContent = 'Generate Tests';
            break;
    }
});

// Restore state if available
const state = vscode.getState();
if (state && state.messages) {
    messagesContainer.innerHTML = state.messages;
    scrollToBottom();
}

// Save state on changes
const observer = new MutationObserver(() => {
    vscode.setState({ messages: messagesContainer.innerHTML });
});
observer.observe(messagesContainer, { childList: true, subtree: true });
