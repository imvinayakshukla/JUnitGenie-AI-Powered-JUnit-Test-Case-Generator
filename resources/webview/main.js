const vscode = acquireVsCodeApi();

// DOM elements
const sendBtn = document.getElementById('send-btn');
const clearBtn = document.getElementById('clear-chat');
const settingsBtn = document.getElementById('settings-btn');
const attachErrorBtn = document.getElementById('attach-error-btn');
const chatInput = document.getElementById('chat-input');
const messagesContainer = document.getElementById('messages');

// State
let isGenerating = false;
let conversationHistory = [];
let messageIdCounter = 0;

// Initialize the chat interface
function init() {
    setupEventListeners();
    loadConversationHistory();
    autoResizeTextarea();
}

function setupEventListeners() {
    // Send button
    sendBtn.addEventListener('click', handleSendMessage);
    
    // Clear chat button
    clearBtn.addEventListener('click', handleClearChat);
    
    // Settings button
    settingsBtn.addEventListener('click', handleOpenSettings);
    
    // Coverage button
    const coverageBtn = document.getElementById('coverage-btn');
    if (coverageBtn) {
        coverageBtn.addEventListener('click', handleCoverageAnalysis);
    }
    
    // Attach error button (initially hidden)
    attachErrorBtn.addEventListener('click', handleAttachError);
    
    // Input handling
    chatInput.addEventListener('keydown', handleKeyDown);
    chatInput.addEventListener('input', handleInputChange);
    
    // VS Code message handler
    window.addEventListener('message', handleVSCodeMessage);
}

function handleSendMessage() {
    const message = chatInput.value.trim();
    if (!message || isGenerating) return;
    
    sendMessage(message);
}

function sendMessage(content, type = 'text') {
    if (isGenerating) return;
    
    // Add user message to conversation
    const userMessage = addMessage('user', content, type);
    conversationHistory.push(userMessage);
    
    // Clear input
    chatInput.value = '';
    autoResizeTextarea();
    
    // Show loading message
    const loadingId = showLoadingMessage();
    
    // Send to extension
    vscode.postMessage({
        command: 'chat',
        content: content,
        type: type,
        conversationHistory: conversationHistory
    });
    
    setGenerating(true);
}

function addMessage(role, content, type = 'text', hasCodeActions = false) {
    const messageId = `msg-${++messageIdCounter}`;
    const timestamp = Date.now();
    
    const message = {
        id: messageId,
        role: role,
        content: content,
        timestamp: timestamp,
        type: type,
        hasCodeActions: hasCodeActions
    };
    
    const messageElement = createMessageElement(message);
    
    // Remove welcome message if it exists
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        welcomeMessage.remove();
    }
    
    messagesContainer.appendChild(messageElement);
    scrollToBottom();
    
    return message;
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}-message`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Create message header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${message.role}-avatar`;
    avatarDiv.textContent = message.role === 'user' ? 'U' : 'AI';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = message.role === 'user' ? 'You' : 'JUnit Test Generator';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-time';
    timeSpan.textContent = formatTime(message.timestamp);
    
    headerDiv.appendChild(avatarDiv);
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(timeSpan);
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (message.type === 'code') {
        contentDiv.appendChild(createCodeBlock(message.content, message.hasCodeActions));
    } else {
        contentDiv.appendChild(createTextContent(message.content));
    }
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    return messageDiv;
}

function createCodeBlock(code, hasActions = true) {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-block';
    
    if (hasActions) {
        // Add code block header with actions
        const headerDiv = document.createElement('div');
        headerDiv.className = 'code-block-header';
        
        const languageSpan = document.createElement('span');
        languageSpan.className = 'code-language';
        languageSpan.textContent = 'Java';
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'code-actions';
        
        // Copy button
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-action-btn';
        copyBtn.textContent = 'Copy';
        copyBtn.addEventListener('click', () => copyToClipboard(code));
        
        // Save button
        const saveBtn = document.createElement('button');
        saveBtn.className = 'code-action-btn';
        saveBtn.textContent = 'Save';
        saveBtn.addEventListener('click', () => saveTestFile(code));
        
        // Report Error button
        const errorBtn = document.createElement('button');
        errorBtn.className = 'code-action-btn';
        errorBtn.textContent = 'Report Error';
        errorBtn.addEventListener('click', () => reportError(code));
        
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(saveBtn);
        actionsDiv.appendChild(errorBtn);
        
        headerDiv.appendChild(languageSpan);
        headerDiv.appendChild(actionsDiv);
        
        codeContainer.appendChild(headerDiv);
    }
    
    // Add code content
    const codeElement = document.createElement('pre');
    codeElement.textContent = code;
    codeContainer.appendChild(codeElement);
    
    return codeContainer;
}

function createTextContent(text) {
    const textDiv = document.createElement('div');
    
    // Process text for markdown-like formatting
    const processedText = processMarkdown(text);
    textDiv.innerHTML = processedText;
    
    return textDiv;
}

function processMarkdown(text) {
    let processed = text;
    
    // Handle triple backtick code blocks with language specification
    processed = processed.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, language, code) => {
        const lang = language || 'java';
        const escapedCode = escapeHtml(code.trim());
        return `<pre class="code-block-content"><code class="language-${lang}">${escapedCode}</code></pre>`;
    });
    
    // Handle inline code
    processed = processed.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');
    
    // Handle **bold** text
    processed = processed.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Handle *italic* text
    processed = processed.replace(/\*(.*?)\*/g, '<em>$1</em>');
    
    // Handle line breaks
    processed = processed.replace(/\n/g, '<br>');
    
    return processed;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showLoadingMessage() {
    const loadingDiv = document.createElement('div');
    loadingDiv.className = 'loading-message';
    loadingDiv.id = 'loading-message';
    
    const spinnerDiv = document.createElement('div');
    spinnerDiv.className = 'loading-spinner';
    
    const textDiv = document.createElement('div');
    textDiv.className = 'loading-text';
    textDiv.textContent = 'Generating response...';
    
    loadingDiv.appendChild(spinnerDiv);
    loadingDiv.appendChild(textDiv);
    
    messagesContainer.appendChild(loadingDiv);
    scrollToBottom();
    
    return 'loading-message';
}

function hideLoadingMessage() {
    const loadingMessage = document.getElementById('loading-message');
    if (loadingMessage) {
        loadingMessage.remove();
    }
}

function handleClearChat() {
    if (isGenerating) return;
    
    conversationHistory = [];
    messageIdCounter = 0;
    
    // Clear messages except welcome
    messagesContainer.innerHTML = `
        <div class="welcome-message">
            <div class="copilot-avatar">
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 2L13.09 8.26L15 9L13.09 9.74L12 16L10.91 9.74L9 9L10.91 8.26L12 2Z"/>
                    <path d="M21 9L19.91 10.26L19 11L19.91 11.74L21 13L22.09 11.74L23 11L22.09 10.26L21 9Z"/>
                    <path d="M3 9L1.91 10.26L1 11L1.91 11.74L3 13L4.09 11.74L5 11L4.09 10.26L3 9Z"/>
                </svg>
            </div>
            <div class="welcome-content">
                <div class="welcome-title">🧪 JUnit Test Generator</div>
                <p>I'm here to help you generate comprehensive JUnit tests for your Java code. You can:</p>
                <ul>
                    <li>Paste Java code to generate tests</li>
                    <li>Ask questions about testing best practices</li>
                    <li>Get help fixing test compilation errors</li>
                </ul>
                <div class="keyboard-shortcut">
                    Press <span class="kbd">Ctrl+Enter</span> to send messages
                </div>
            </div>
        </div>
    `;
    
    saveConversationHistory();
}

function handleOpenSettings() {
    vscode.postMessage({
        command: 'openSettings'
    });
}

function handleCoverageAnalysis() {
    vscode.postMessage({
        command: 'runCoverage'
    });
}

function handleAttachError() {
    // Show error attachment dialog
    const errorText = prompt('Please paste the compilation error message:');
    if (errorText && errorText.trim()) {
        const message = `I'm getting this compilation error with the generated test:\n\n\`\`\`\n${errorText.trim()}\n\`\`\`\n\nCan you help me fix it?`;
        sendMessage(message, 'error');
    }
}

function handleKeyDown(e) {
    if (e.ctrlKey && e.key === 'Enter') {
        e.preventDefault();
        handleSendMessage();
    }
}

function handleInputChange() {
    autoResizeTextarea();
    
    // Show/hide attach error button based on content
    const hasContent = chatInput.value.trim().length > 0;
    const hasError = chatInput.value.toLowerCase().includes('error') || 
                     chatInput.value.toLowerCase().includes('exception') ||
                     chatInput.value.toLowerCase().includes('compilation');
    
    attachErrorBtn.style.display = hasError ? 'flex' : 'none';
}

function autoResizeTextarea() {
    chatInput.style.height = 'auto';
    const newHeight = Math.min(Math.max(chatInput.scrollHeight, 22), 200);
    chatInput.style.height = newHeight + 'px';
}

function handleVSCodeMessage(event) {
    const message = event.data;
    
    switch (message.command) {
        case 'preloadCode':
            if (message.code) {
                chatInput.value = `Please generate JUnit tests for this Java code:\n\n\`\`\`java\n${message.code}\n\`\`\``;
                autoResizeTextarea();
                
                if (message.fileName) {
                    showFileLoadedNotification(message.fileName);
                }
            }
            break;
            
        case 'response':
            hideLoadingMessage();
            const isCode = message.text && (message.text.includes('class') || message.text.includes('import'));
            const assistantMessage = addMessage('assistant', message.text, isCode ? 'code' : 'text', isCode);
            conversationHistory.push(assistantMessage);
            setGenerating(false);
            saveConversationHistory();
            break;
            
        case 'error':
            hideLoadingMessage();
            const errorMessage = addMessage('assistant', `❌ Error: ${message.text}`, 'text');
            conversationHistory.push(errorMessage);
            setGenerating(false);
            saveConversationHistory();
            break;
    }
}

function showFileLoadedNotification(fileName) {
    const notification = document.createElement('div');
    notification.className = 'success-message';
    notification.innerHTML = `
        <strong>📁 ${fileName} loaded</strong><br>
        The Java file has been loaded automatically. You can now generate tests or ask questions about it.
    `;
    
    const welcomeMessage = messagesContainer.querySelector('.welcome-message');
    if (welcomeMessage) {
        messagesContainer.insertBefore(notification, welcomeMessage.nextSibling);
        setTimeout(() => notification.remove(), 5000);
    }
}

function copyToClipboard(text) {
    vscode.postMessage({
        command: 'copyToClipboard',
        text: text
    });
    
    showToast('Code copied to clipboard!');
}

function saveTestFile(code) {
    // Extract class name for default filename
    const classMatch = code.match(/(?:public\s+)?class\s+(\w+)/);
    const className = classMatch ? classMatch[1] : 'GeneratedTest';
    
    vscode.postMessage({
        command: 'saveTests',
        tests: code,
        className: className
    });
}

function showToast(message, type = 'success') {
    // Remove existing toasts
    const existingToasts = document.querySelectorAll('.toast');
    existingToasts.forEach(toast => toast.remove());
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideInRight 0.3s ease-out reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

function showTypingIndicator() {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message assistant-message typing-message';
    typingDiv.id = 'typing-indicator';
    
    typingDiv.innerHTML = `
        <div class="message-header">
            <div class="message-avatar assistant-avatar">AI</div>
            <span>JUnit Test Generator</span>
            <span class="typing-indicator">
                <span class="typing-dots">
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                    <span class="typing-dot"></span>
                </span>
                <span>typing...</span>
            </span>
        </div>
    `;
    
    messagesContainer.appendChild(typingDiv);
    scrollToBottom();
    
    return 'typing-indicator';
}

function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

function createAdvancedCodeBlock(code, language = 'java', hasActions = true) {
    const codeContainer = document.createElement('div');
    codeContainer.className = 'code-block';
    
    if (hasActions) {
        // Add code block header with actions
        const headerDiv = document.createElement('div');
        headerDiv.className = 'code-block-header';
        
        const languageSpan = document.createElement('span');
        languageSpan.className = 'code-language';
        languageSpan.textContent = language.toUpperCase();
        
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'code-actions';
        
        // Copy button with icon
        const copyBtn = document.createElement('button');
        copyBtn.className = 'code-action-btn';
        copyBtn.title = 'Copy code';
        copyBtn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M0 6.75C0 5.784.784 5 1.75 5h1.5a.75.75 0 010 1.5h-1.5a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-1.5a.75.75 0 011.5 0v1.5A1.75 1.75 0 019.25 16h-7.5A1.75 1.75 0 010 14.25v-7.5z"/>
                <path d="M5 1.75C5 .784 5.784 0 6.75 0h7.5C15.216 0 16 .784 16 1.75v7.5A1.75 1.75 0 0114.25 11h-7.5A1.75 1.75 0 015 9.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h7.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25h-7.5z"/>
            </svg>
        `;
        copyBtn.addEventListener('click', () => {
            copyToClipboard(code);
            // Visual feedback
            const originalHTML = copyBtn.innerHTML;
            copyBtn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
            `;
            copyBtn.style.color = 'var(--vscode-terminal-ansiGreen)';
            setTimeout(() => {
                copyBtn.innerHTML = originalHTML;
                copyBtn.style.color = '';
            }, 1500);
        });
        
        // Save button with icon
        const saveBtn = document.createElement('button');
        saveBtn.className = 'code-action-btn';
        saveBtn.title = 'Save as file';
        saveBtn.innerHTML = `
            <svg viewBox="0 0 16 16" fill="currentColor">
                <path d="M1.75 2A1.75 1.75 0 000 3.75v9.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-9.5A1.75 1.75 0 0014.25 2H1.75zM1.5 3.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v9.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25v-9.5zM11.75 5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-4.5a.75.75 0 00-.75-.75zm-8.25.75a.75.75 0 011.5 0v4.5a.75.75 0 01-1.5 0v-4.5zM8 5a.75.75 0 00-.75.75v4.5a.75.75 0 001.5 0v-4.5A.75.75 0 008 5z"/>
            </svg>
        `;
        saveBtn.addEventListener('click', () => {
            saveTestFile(code);
            // Visual feedback
            const originalHTML = saveBtn.innerHTML;
            saveBtn.innerHTML = `
                <svg viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/>
                </svg>
            `;
            saveBtn.style.color = 'var(--vscode-terminal-ansiGreen)';
            setTimeout(() => {
                saveBtn.innerHTML = originalHTML;
                saveBtn.style.color = '';
            }, 1500);
        });
        
        actionsDiv.appendChild(copyBtn);
        actionsDiv.appendChild(saveBtn);
        
        headerDiv.appendChild(languageSpan);
        headerDiv.appendChild(actionsDiv);
        
        codeContainer.appendChild(headerDiv);
    }
    
    // Add code content
    const codeElement = document.createElement('div');
    codeElement.className = 'code-content';
    codeElement.textContent = code;
    codeContainer.appendChild(codeElement);
    
    return codeContainer;
}

function createMessageElement(message) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}-message`;
    messageDiv.setAttribute('data-message-id', message.id);
    
    // Create message header
    const headerDiv = document.createElement('div');
    headerDiv.className = 'message-header';
    
    const avatarDiv = document.createElement('div');
    avatarDiv.className = `message-avatar ${message.role}-avatar`;
    avatarDiv.textContent = message.role === 'user' ? 'U' : 'AI';
    
    const nameSpan = document.createElement('span');
    nameSpan.textContent = message.role === 'user' ? 'You' : 'JUnit Test Generator';
    
    const timeSpan = document.createElement('span');
    timeSpan.className = 'message-timestamp';
    timeSpan.textContent = formatTime(message.timestamp);
    
    headerDiv.appendChild(avatarDiv);
    headerDiv.appendChild(nameSpan);
    headerDiv.appendChild(timeSpan);
    
    // Create message content
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    
    if (message.type === 'code') {
        contentDiv.appendChild(createAdvancedCodeBlock(message.content, 'java', message.hasCodeActions));
    } else {
        contentDiv.appendChild(createTextContent(message.content));
    }
    
    messageDiv.appendChild(headerDiv);
    messageDiv.appendChild(contentDiv);
    
    // Add context menu for messages
    messageDiv.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        showContextMenu(e, message);
    });
    
    return messageDiv;
}

function showContextMenu(event, message) {
    // Remove existing context menu
    const existingMenu = document.querySelector('.context-menu');
    if (existingMenu) {
        existingMenu.remove();
    }
    
    const menu = document.createElement('div');
    menu.className = 'context-menu';
    
    const copyItem = document.createElement('div');
    copyItem.className = 'context-menu-item';
    copyItem.textContent = 'Copy message';
    copyItem.addEventListener('click', () => {
        copyToClipboard(message.content);
        menu.remove();
    });
    
    const regenerateItem = document.createElement('div');
    regenerateItem.className = 'context-menu-item';
    regenerateItem.textContent = 'Regenerate response';
    regenerateItem.addEventListener('click', () => {
        if (message.role === 'assistant') {
            regenerateResponse(message.id);
        }
        menu.remove();
    });
    
    const separator = document.createElement('div');
    separator.className = 'context-menu-separator';
    
    const deleteItem = document.createElement('div');
    deleteItem.className = 'context-menu-item';
    deleteItem.textContent = 'Delete message';
    deleteItem.addEventListener('click', () => {
        deleteMessage(message.id);
        menu.remove();
    });
    
    menu.appendChild(copyItem);
    if (message.role === 'assistant') {
        menu.appendChild(regenerateItem);
    }
    menu.appendChild(separator);
    menu.appendChild(deleteItem);
    
    // Position the menu
    menu.style.left = `${event.clientX}px`;
    menu.style.top = `${event.clientY}px`;
    
    document.body.appendChild(menu);
    
    // Close menu when clicking outside
    setTimeout(() => {
        document.addEventListener('click', function closeMenu() {
            menu.remove();
            document.removeEventListener('click', closeMenu);
        });
    }, 0);
}

function regenerateResponse(messageId) {
    // Find the message and regenerate
    const messageIndex = conversationHistory.findIndex(msg => msg.id === messageId);
    if (messageIndex > 0) {
        // Get the previous user message
        const userMessage = conversationHistory[messageIndex - 1];
        if (userMessage && userMessage.role === 'user') {
            // Remove the assistant's response and regenerate
            conversationHistory.splice(messageIndex, 1);
            
            // Remove the message from DOM
            const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
            if (messageElement) {
                messageElement.remove();
            }
            
            // Regenerate
            sendMessage(userMessage.content, userMessage.type);
        }
    }
}

function deleteMessage(messageId) {
    // Remove from conversation history
    conversationHistory = conversationHistory.filter(msg => msg.id !== messageId);
    
    // Remove from DOM
    const messageElement = document.querySelector(`[data-message-id="${messageId}"]`);
    if (messageElement) {
        messageElement.remove();
    }
    
    saveConversationHistory();
    showToast('Message deleted', 'success');
}

function enhanceInputHandling() {
    // Add character count
    const characterCount = document.createElement('div');
    characterCount.className = 'character-count';
    characterCount.textContent = '0 characters';
    
    const inputContainer = document.querySelector('.input-container');
    inputContainer.appendChild(characterCount);
    
    chatInput.addEventListener('input', () => {
        const count = chatInput.value.length;
        characterCount.textContent = `${count} character${count !== 1 ? 's' : ''}`;
        
        // Show warning if approaching limit
        if (count > 8000) {
            characterCount.style.color = 'var(--vscode-errorForeground)';
        } else if (count > 6000) {
            characterCount.style.color = 'var(--vscode-terminal-ansiYellow)';
        } else {
            characterCount.style.color = 'var(--vscode-descriptionForeground)';
        }
    });
    
    // Enhanced focus handling
    chatInput.addEventListener('focus', () => {
        document.querySelector('.input-wrapper').classList.add('focused');
    });
    
    chatInput.addEventListener('blur', () => {
        document.querySelector('.input-wrapper').classList.remove('focused');
    });
}

// Enhanced message handling
function showLoadingMessage() {
    hideTypingIndicator(); // Hide typing if showing
    return showTypingIndicator(); // Show new typing indicator
}

function hideLoadingMessage() {
    hideTypingIndicator();
}

function setGenerating(generating) {
    isGenerating = generating;
    sendBtn.disabled = generating;
    clearBtn.disabled = generating;
    
    if (generating) {
        sendBtn.style.opacity = '0.5';
        clearBtn.style.opacity = '0.5';
    } else {
        sendBtn.style.opacity = '1';
        clearBtn.style.opacity = '1';
    }
}

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function saveConversationHistory() {
    vscode.setState({ 
        conversationHistory: conversationHistory,
        messageIdCounter: messageIdCounter
    });
}

function loadConversationHistory() {
    const state = vscode.getState();
    if (state) {
        conversationHistory = state.conversationHistory || [];
        messageIdCounter = state.messageIdCounter || 0;
        
        // Restore messages
        if (conversationHistory.length > 0) {
            const welcomeMessage = messagesContainer.querySelector('.welcome-message');
            if (welcomeMessage) {
                welcomeMessage.remove();
            }
            
            conversationHistory.forEach(message => {
                const messageElement = createMessageElement(message);
                messagesContainer.appendChild(messageElement);
            });
            
            scrollToBottom();
        }
    }
}

// Initialize when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        init();
        enhanceInputHandling();
    });
} else {
    init();
    enhanceInputHandling();
}
