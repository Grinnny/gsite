// Chat functionality for the jackpot game
let chatSocket = null;
let isChatOpen = false;

// Initialize chat when page loads
document.addEventListener('DOMContentLoaded', function() {
    initializeChat();
});

function initializeChat() {
    // Connect to the same socket as the jackpot game
    if (typeof socket !== 'undefined' && socket) {
        chatSocket = socket;
        setupChatListeners();
        // Request chat history
        chatSocket.emit('request_chat_history');
    } else {
        // If no socket exists, create one for chat
        chatSocket = io();
        setupChatListeners();
        chatSocket.emit('request_chat_history');
    }
}

function setupChatListeners() {
    // Listen for chat messages
    chatSocket.on('chat_message', function(data) {
        addMessageToChat(data);
    });

    // Listen for chat history
    chatSocket.on('chat_history', function(data) {
        displayChatHistory(data.messages);
    });

    // Listen for chat errors
    chatSocket.on('chat_error', function(data) {
        showChatError(data.error);
    });
}

function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    const mainContent = document.getElementById('mainContent');
    const navbar = document.querySelector('nav');
    
    isChatOpen = !isChatOpen;
    
    if (isChatOpen) {
        chatPanel.classList.add('open');
        if (mainContent) mainContent.classList.add('chat-open');
        if (navbar) navbar.classList.add('chat-open');
    } else {
        chatPanel.classList.remove('open');
        if (mainContent) mainContent.classList.remove('chat-open');
        if (navbar) navbar.classList.remove('chat-open');
    }
}

function sendChatMessage() {
    const chatInput = document.getElementById('chatInput');
    const message = chatInput.value.trim();
    
    if (!message) return;
    
    // Send message to server
    chatSocket.emit('send_chat_message', { message: message });
    
    // Clear input
    chatInput.value = '';
}

function handleChatKeyPress(event) {
    if (event.key === 'Enter') {
        sendChatMessage();
    }
}

function addMessageToChat(messageData) {
    const chatMessages = document.getElementById('chatMessages');
    
    const messageElement = document.createElement('div');
    messageElement.className = 'chat-message';
    
    const time = new Date(messageData.timestamp).toLocaleTimeString([], { 
        hour: '2-digit', 
        minute: '2-digit' 
    });
    
    const profileUrl = messageData.user.profileUrl || '#';
    const isClickable = profileUrl !== '#';
    
    messageElement.innerHTML = `
        <img class="chat-message-avatar" src="${messageData.user.avatar || '/imgs/default-avatar.png'}" alt="${messageData.user.name}">
        <div class="chat-message-content">
            <div class="chat-message-name ${isClickable ? 'clickable' : ''}" 
                 ${isClickable ? `onclick="window.open('${profileUrl}', '_blank')" style="cursor: pointer;"` : ''}>
                ${escapeHtml(messageData.user.name)}
            </div>
            <div class="chat-message-text">${escapeHtml(messageData.message)}</div>
            <div class="chat-message-time">${time}</div>
        </div>
    `;
    
    // Add to top of messages (newest first)
    chatMessages.insertBefore(messageElement, chatMessages.firstChild);
    
    // Limit messages displayed (keep last 20)
    const messages = chatMessages.children;
    if (messages.length > 20) {
        chatMessages.removeChild(messages[messages.length - 1]);
    }
    
    // Auto-scroll to top for new messages
    chatMessages.scrollTop = 0;
}

function displayChatHistory(messages) {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.innerHTML = ''; // Clear existing messages
    
    // Display messages in reverse order (newest first)
    messages.reverse().forEach(message => {
        addMessageToChat(message);
    });
}

function showChatError(errorMessage) {
    // Create temporary error message
    const chatMessages = document.getElementById('chatMessages');
    
    const errorElement = document.createElement('div');
    errorElement.style.cssText = `
        background-color: #2d1b1b;
        border: 1px solid #d32f2f;
        border-radius: 8px;
        padding: 12px;
        margin-bottom: 12px;
        color: #ffcdd2;
        font-family: sansation;
        font-size: 14px;
    `;
    errorElement.textContent = errorMessage;
    
    chatMessages.insertBefore(errorElement, chatMessages.firstChild);
    
    // Remove error after 5 seconds
    setTimeout(() => {
        if (errorElement.parentNode) {
            errorElement.parentNode.removeChild(errorElement);
        }
    }, 5000);
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Auto-focus chat input when chat opens
document.addEventListener('DOMContentLoaded', function() {
    const chatPanel = document.getElementById('chatPanel');
    const chatInput = document.getElementById('chatInput');
    
    // Watch for chat panel opening
    const observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                if (chatPanel.classList.contains('open')) {
                    setTimeout(() => chatInput.focus(), 100);
                }
            }
        });
    });
    
    observer.observe(chatPanel, { attributes: true });
});
