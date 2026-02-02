(function() {
  const widget = document.getElementById('chat-widget');
  if (!widget) return;

  const toggleBtn = document.getElementById('chat-widget-toggle');
  const closeBtn = document.getElementById('chat-widget-close');
  const panel = widget.querySelector('.chat-panel');
  const messagesEl = document.getElementById('chat-widget-messages');
  const inputEl = document.getElementById('chat-widget-input');
  const sendBtn = document.getElementById('chat-widget-send');

  let activeConversationId = sessionStorage.getItem('agent:conversationId') || null;
  let isSending = false;

  function getCountry() {
    const url = new URL(window.location.href);
    if (url.searchParams.get('country')) return url.searchParams.get('country').toUpperCase();
    const countrySelect = document.querySelector('.country-selector');
    if (countrySelect && countrySelect.value) return countrySelect.value.toUpperCase();
    return 'UK';
  }

  function pageContext() {
    return {
      route: window.location.pathname,
      country: getCountry(),
    };
  }

  function appendMessage(role, content) {
    const div = document.createElement('div');
    div.className = 'chat-bubble ' + role;
    div.textContent = content;
    messagesEl.appendChild(div);
    messagesEl.scrollTop = messagesEl.scrollHeight;
  }

  async function ensureConversation() {
    if (activeConversationId) return activeConversationId;
    // Create by sending a blank intro? We'll start a new convo on first real send.
    return null;
  }

  async function sendMessage() {
    if (isSending) return;
    const text = inputEl.value.trim();
    if (!text) return;
    isSending = true;
    appendMessage('user', text);
    inputEl.value = '';

    try {
      const body = {
        conversationId: activeConversationId,
        message: text,
        pageContext: pageContext(),
      };
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (data.ok) {
        activeConversationId = data.conversationId;
        sessionStorage.setItem('agent:conversationId', activeConversationId);
        appendMessage('assistant', data.message || '');
      } else {
        appendMessage('assistant', data.error || 'Something went wrong.');
      }
    } catch (err) {
      appendMessage('assistant', 'Network error.');
    } finally {
      isSending = false;
    }
  }

  toggleBtn?.addEventListener('click', () => {
    panel.classList.add('open');
    inputEl.focus();
  });

  closeBtn?.addEventListener('click', () => {
    panel.classList.remove('open');
  });

  sendBtn?.addEventListener('click', sendMessage);
  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });
})();
