import { useEffect, useRef, useState } from "react";
import { api } from "../api/client";
import { useAuth } from "../context/AuthContext";
import { useI18n } from "../i18n/I18nContext";

// Floating assistant. Answers come from live database data on the server, in the UI language.
export default function ChatBot() {
  const { user } = useAuth();
  const { t, lang } = useI18n();
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState([]);
  const [suggestions, setSuggestions] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, open]);
  useEffect(() => { setMsgs([]); setSuggestions([]); }, [lang, user?.id]);

  const send = async (message) => {
    const m = message.trim();
    if (!m || busy) return;
    setMsgs((x) => [...x, { from: "me", text: m }]);
    setText(""); setBusy(true);
    try {
      const r = await api("/chat", { method: "POST", body: { message: m, lang } });
      setMsgs((x) => [...x, { from: "bot", text: r.reply }]);
      setSuggestions(r.suggestions || []);
    } catch (e) {
      setMsgs((x) => [...x, { from: "bot", text: e.message }]);
    } finally {
      setBusy(false);
    }
  };

  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (next && msgs.length === 0) send("hello");
  };

  if (!user) return null;

  return (
    <>
      {open && (
        <section className="chat-panel" aria-label={t("c.title")}>
          <header><strong>{t("c.title")}</strong><button className="btn-small" onClick={toggle} aria-label={t("c.close")}>✕</button></header>
          <div className="chat-body" aria-live="polite">
            {msgs.map((m, i) => <p key={i} className={`bubble ${m.from}`}>{m.text}</p>)}
            {busy && <p className="bubble bot muted">{t("c.thinking")}</p>}
            <div ref={endRef} />
          </div>
          <div className="chips">
            {suggestions.map((s) => <button key={s} onClick={() => send(s)}>{s}</button>)}
          </div>
          <form onSubmit={(e) => { e.preventDefault(); send(text); }}>
            <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t("c.placeholder")} maxLength={500} />
            <button className="btn-primary btn-compact" disabled={busy}>{t("c.send")}</button>
          </form>
        </section>
      )}
      <button className="chat-fab" onClick={toggle} aria-label={t("c.open")}>💬</button>
    </>
  );
}
