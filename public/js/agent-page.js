(function() {
  const listEl = document.getElementById('conversation-list');
  const messagesWindow = document.getElementById('messages-window');
  const inputEl = document.getElementById('agent-input');
  const sendBtn = document.getElementById('agent-send');
  const newBtn = document.getElementById('new-convo-btn');
  const activeTitle = document.getElementById('active-title');
  const activeMeta = document.getElementById('active-meta');

  if (!listEl || !messagesWindow) return; // Not on agent page

  let activeConversationId = null;
  let isSending = false;

  function getCountry() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('country')) return url.searchParams.get('country').toUpperCase();
    const countrySelect = document.querySelector('.country-selector');
    if (countrySelect && countrySelect.value) return countrySelect.value.toUpperCase();
    return 'UK';
  }

  function pageContext() {
    return { route: window.location.pathname, country: getCountry() };
  }

  function renderMessage(role, content) {
    const wrapper = document.createElement('div');
    wrapper.className = `message ${role}`;
    const roleLabel = document.createElement('div');
    roleLabel.className = 'role';
    roleLabel.textContent = role;
    const bubble = document.createElement('div');
    bubble.className = 'bubble';
    bubble.textContent = content;
    wrapper.appendChild(roleLabel);
    wrapper.appendChild(bubble);
    messagesWindow.appendChild(wrapper);
  }

  function clearMessages() {
    messagesWindow.innerHTML = '';
  }

  async function loadConversations() {
    try {
      const res = await fetch('/api/ai/conversations');
      const data = await res.json();
      if (!data.ok) return;
      listEl.innerHTML = '';
      if (!data.conversations.length) {
        activeConversationId = null;
        activeTitle.textContent = 'New Conversation';
        activeMeta.textContent = 'Route: ' + (pageContext().route || '/dashboard');
        clearMessages();
        renderMessage('assistant', 'No history yet. Ask your first question to start a thread.');
        return;
      }
      data.conversations.forEach((c, idx) => {
        const item = document.createElement('div');
        item.className = 'conversation-item';
        item.dataset.id = c.id;
        if (c.id === activeConversationId || (!activeConversationId && idx === 0)) {
          item.classList.add('active');
          if (!activeConversationId) activeConversationId = c.id;
        }
        item.innerHTML = `<div class="conversation-title">${c.title || 'Untitled'}</div><div class="conversation-meta">Updated ${new Date(c.updatedAt).toLocaleString()}</div>`;
        item.addEventListener('click', () => {
          activeConversationId = c.id;
          highlightActive();
          loadMessages();
        });
        listEl.appendChild(item);
      });
      highlightActive();
      if (activeConversationId) loadMessages();
    } catch (err) {
      console.error('load conversations failed', err);
    }
  }

  function highlightActive() {
    listEl.querySelectorAll('.conversation-item').forEach((el) => {
      if (Number(el.dataset.id) === Number(activeConversationId)) {
        el.classList.add('active');
      } else {
        el.classList.remove('active');
      }
    });
  }

  async function loadMessages() {
    if (!activeConversationId) return;
    clearMessages();
    renderMessage('assistant', 'Loading conversation...');
    try {
      const res = await fetch(`/api/ai/conversations/${activeConversationId}/messages`);
      const data = await res.json();
      if (!data.ok) throw new Error(data.error || 'Unable to load');
      messagesWindow.innerHTML = '';
      activeTitle.textContent = data.conversation.title || 'Conversation';
      activeMeta.textContent = `Route: ${data.conversation.pageRoute || 'mixed'}`;
      data.messages.forEach((m) => renderMessage(m.role, m.content || ''));
      messagesWindow.scrollTop = messagesWindow.scrollHeight;
    } catch (err) {
      clearMessages();
      renderMessage('assistant', 'Unable to load messages.');
    }
  }

  async function sendMessage() {
    if (isSending) return;
    const text = inputEl.value.trim();
    if (!text) return;
    isSending = true;
    renderMessage('user', text);
    inputEl.value = '';
    messagesWindow.scrollTop = messagesWindow.scrollHeight;
    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: text,
          pageContext: pageContext(),
        })
      });
      const data = await res.json();
      if (data.ok) {
        if (!activeConversationId) activeConversationId = data.conversationId;
        renderMessage('assistant', data.message || '');
        loadConversations(); // refresh ordering and titles
      } else {
        renderMessage('assistant', data.error || 'Error');
      }
    } catch (err) {
      renderMessage('assistant', 'Network error');
    } finally {
      isSending = false;
    }
  }

  newBtn?.addEventListener('click', () => {
    activeConversationId = null;
    clearMessages();
    renderMessage('assistant', 'New conversation started. Ask away!');
  });

  sendBtn?.addEventListener('click', sendMessage);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  loadConversations();
})();
