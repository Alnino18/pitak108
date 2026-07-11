import { useEffect, useRef, useState } from 'react';
import { subscribeMessages, sendMessage } from './roomApi';
import { useLang } from './LangContext';

export default function Chat({ code, uid, name }) {
  const { t } = useLang();
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const endRef = useRef(null);

  useEffect(() => {
    const unsub = subscribeMessages(code, setMessages);
    return unsub;
  }, [code]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  async function handleSend(e) {
    e.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;
    setText('');
    await sendMessage(code, uid, name, trimmed);
  }

  return (
    <div className="chat">
      <div className="chat-log">
        {messages.map((m) => (
          <div key={m.id} className={`chat-msg ${m.uid === uid ? 'mine' : ''}`}>
            <span className="chat-author">{m.name}</span>
            <span className="chat-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
      </div>
      <form className="chat-form" onSubmit={handleSend}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t('chatPlaceholder')}
          maxLength={300}
        />
        <button type="submit">➤</button>
      </form>
    </div>
  );
}
