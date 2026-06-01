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
    <div className="fixed inset-y-0 right-0 w-[450px] bg-bg-surface border-l border-border shadow-2xl z-[100] flex flex-col animate-slide-in-right overflow-hidden">
      {/* Header */}
      <div className="p-5 border-b border-border space-y-5 bg-bg-elevated/30 backdrop-blur-md">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent shadow-sm">
              <Sparkles size={20} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-text-primary uppercase tracking-[0.1em]">AI Assistant</h3>
              <p className="text-[10px] text-text-muted font-bold uppercase tracking-wider">Direct Workspace Intelligence</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-text-muted hover:text-danger hover:bg-danger/5 transition-all active:scale-95"
          >
            <X size={20} />
          </button>
        </div>

        {/* Agent Switcher */}
        <div className="flex p-1 rounded-xl bg-bg-base/50 border border-border/60 shadow-inner">
          <button
            onClick={() => setActiveAgent('chatbase')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeAgent === 'chatbase'
                ? 'bg-accent text-white shadow-md'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Global Chat
          </button>
          <button
            onClick={() => setActiveAgent('custom')}
            className={`flex-1 py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${
              activeAgent === 'custom'
                ? 'bg-accent text-white shadow-md'
                : 'text-text-muted hover:text-text-primary'
            }`}
          >
            Custom Agent
          </button>
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-hidden relative bg-bg-base/20">
        {activeAgent === 'chatbase' ? (
          <div className="w-full h-full relative">
            <iframe
              src={`https://www.chatbase.co/chatbot-iframe/${CHATBOT_ID}`}
              width="100%"
              height="100%"
              frameBorder="0"
              className="w-full h-full block"
              title="Chatbase Assistant"
              style={{ display: 'block' }}
            />
          </div>
        ) : (
          <div className="flex flex-col h-full">
            {/* Custom Messages */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar"
            >
              {messages.map((msg, idx) => (
                <div key={idx} className={`flex gap-3 ${msg.role === 'assistant' ? 'flex-row' : 'flex-row-reverse'}`}>
                  <div className={`w-8 h-8 rounded-lg flex-shrink-0 flex items-center justify-center shadow-sm ${
                    msg.role === 'assistant' ? 'bg-accent/10 text-accent' : 'bg-bg-elevated border border-border text-text-muted'
                  }`}>
                    {msg.role === 'assistant' ? <Bot size={16} /> : <User size={16} />}
                  </div>
                  <div className={`max-w-[85%] p-4 rounded-2xl text-xs leading-relaxed shadow-sm ${
                    msg.role === 'assistant' ? 'bg-bg-surface text-text-primary rounded-tl-none border border-border/40' : 'bg-accent text-white rounded-tr-none'
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {generating && (
                <div className="flex gap-3 animate-pulse">
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center text-accent shadow-sm"><Bot size={16} /></div>
                  <div className="bg-bg-surface p-4 rounded-2xl rounded-tl-none flex items-center gap-3 border border-border/40 shadow-sm">
                    <Loader2 size={14} className="animate-spin text-accent" />
                    <span className="text-[10px] font-bold text-text-muted uppercase tracking-wider">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            {/* Custom Input */}
            <div className="p-5 border-t border-border bg-bg-surface/80 backdrop-blur-md">
              <form onSubmit={handleSend} className="relative flex items-center">
                <input
                  type="text"
                  placeholder="Ask the workspace assistant..."
                  className="w-full bg-bg-elevated border border-border focus:border-accent rounded-xl py-3 pl-5 pr-12 text-xs text-text-primary transition-all shadow-inner"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  disabled={generating}
                />
                <button 
                  type="submit" 
                  disabled={!input.trim() || generating}
                  className="absolute right-2 p-2 rounded-lg bg-accent text-white shadow-md hover:bg-accent-hover transition-all active:scale-90 disabled:opacity-50"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
