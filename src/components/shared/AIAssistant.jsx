import { useState, useRef, useEffect } from 'react';
import { Sparkles, Send, Bot, User, X, Loader2, Eraser } from 'lucide-react';
import { useAI } from '../../hooks/useAI';
import { useAuthStore } from '../../store/useAuthStore';
import Button from '../ui/Button';

export default function AIAssistant({ open, onClose }) {
  const [activeAgent, setActiveAgent] = useState('chatbase'); // 'chatbase' | 'custom'
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: 'Hello! I am your CommandCenter assistant. How can I help you manage your projects or issues today?',
    },
  ]);
  const [input, setInput] = useState('');
  const { generateInline, generating } = useAI();
  const { user } = useAuthStore();
  const scrollRef = useRef(null);

  const CHATBOT_ID = "bEmT4yEDV8-c9PK1KEFa0";

  // Auto-scroll to bottom for custom chat
  useEffect(() => {
    if (activeAgent === 'custom' && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, generating, activeAgent]);

  const handleSend = async (e) => {
    if (e) e.preventDefault();
    if (!input.trim() || generating) return;

    const userMessage = input.trim();
    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }]);

    try {
      const history = messages.slice(-5).map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`).join('\n');
      const prompt = `
You are the CommandCenter AI Assistant.
User: ${user?.user_metadata?.full_name || user?.email || 'User'}
History: ${history}
User Message: ${userMessage}
`.trim();

      const response = await generateInline('general_chat', { customPrompt: prompt });
      setMessages((prev) => [...prev, { role: 'assistant', content: response || 'I encountered an error.' }]);
    } catch (err) {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Error: ' + err.message }]);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-[450px] bg-bg-surface border-l border-border shadow-2xl z-[100] flex flex-col animate-slide-in-right">
      {/* Header */}
      <div className="p-4 border-b border-border space-y-4 bg-bg-elevated/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-accent">
              <Sparkles size={18} />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wider">AI Assistant</h3>
              <p className="text-[10px] text-text-muted">Direct Workspace Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-text-muted hover:text-danger hover:bg-danger/5 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Agent Switcher Flag */}
        <div className="flex p-1 rounded-lg bg-bg-base border border-border">
          <button
            onClick={() => setActiveAgent('chatbase')}
            className={`flex-1 py-1.5 rounded-md text-2xs font-bold transition-all ${
              activeAgent === 'chatbase'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Chatbase (Default)
          </button>
          <button
            onClick={() => setActiveAgent('custom')}
            className={`flex-1 py-1.5 rounded-md text-2xs font-bold transition-all ${
              activeAgent === 'custom'
                ? 'bg-accent text-white shadow-sm'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Custom AI (Zen/Gemini)
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative">
        {activeAgent === 'chatbase' ? (
          <iframe
            src={`https://www.chatbase.co/chatbot-iframe/${CHATBOT_ID}`}
            width="100%"
            height="100%"
            frameBorder="0"
            className="w-full h-full"
            title="Chatbase Assistant"
          />
        ) : (
          <div className="flex flex-col h-full">
            {/* Custom Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar"
            >
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center ${
                    msg.role === 'assistant' ? 'bg-accent/10 text-accent' : 'bg-bg-elevated border border-border text-text-muted'
                  }`}>
                    {msg.role === 'assistant' ? <Bot size={14} /> : <User size={14} />}
                  </div>
                  <div className={`max-w-[85%] p-3 rounded-2xl text-xs leading-relaxed ${
                    msg.role === 'assistant' ? 'bg-bg-elevated text-text-primary rounded-tl-none' : 'bg-accent text-white rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {generating && (
                <div className="flex gap-3 animate-pulse">
                  <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-accent"><Bot size={14} /></div>
                  <div className="bg-bg-elevated p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                    <Loader2 size={12} className="animate-spin text-accent" />
                    <span className="text-[10px] text-text-muted">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Input */}
            <div className="p-4 border-t border-border bg-bg-elevated/20">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Ask the custom assistant..."
                  className="w-full bg-bg-surface border border-border focus:border-accent rounded-full py-2.5 pl-4 pr-12 text-xs text-text-primary"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={generating}
                />
                <button type="submit" className="absolute right-1.5 p-1.5 rounded-full bg-accent text-white"><Send size={14} /></button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
