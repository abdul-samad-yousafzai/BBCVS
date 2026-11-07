// Provides a small FAQ chat with answer-source labels and optional feedback.
import { useEffect, useRef, useState } from "react";
import { askFaq, sendAssistantFeedback } from "../api.js";
import Button from "./Button.jsx";
import Card from "./Card.jsx";
import { formatSourceLabel } from "../lib/chat.js";

export default function ChatBox() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const messageEndRef = useRef(null);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    messageEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading]);

  function appendError(text) {
    setMessages((current) => [...current, {
      role: "assistant",
      text,
      isError: true,
    }]);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    const message = input.trim();
    if (!message || loading) return;
    if (message.length > 1000) {
      appendError("Please keep your question to 1000 characters or fewer.");
      return;
    }

    setInput("");
    setMessages((current) => [...current, { role: "user", text: message }]);
    setLoading(true);
    try {
      const response = await askFaq(message);
      setMessages((current) => [...current, {
        role: "assistant",
        text: response.reply,
        source: response.source,
        intent: response.intent,
        replyId: response.replyId,
      }]);
    } catch (error) {
      appendError(error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleFeedback(replyId, helpful) {
    setMessages((current) => current.map((message) => (
      message.replyId === replyId
        ? { ...message, feedback: "sending" }
        : message
    )));
    try {
      await sendAssistantFeedback(replyId, helpful);
      setMessages((current) => current.map((message) => (
        message.replyId === replyId
          ? { ...message, feedback: "submitted" }
          : message
      )));
    } catch (error) {
      setMessages((current) => current.map((message) => (
        message.replyId === replyId
          ? { ...message, feedback: undefined }
          : message
      )));
      appendError(error.message);
    }
  }

  return (
    <Card className="chat-box" aria-labelledby="chat-box-heading">
      <header className="chat-heading">
        <h2 id="chat-box-heading">Ask CertSure</h2>
        <p>Answers are limited to information about this system.</p>
      </header>

      <ol className="chat-messages" aria-live="polite" aria-busy={loading}>
        {messages.map((message, index) => (
          <li
            className={`chat-message ${message.role}${message.isError ? " chat-error" : ""}`}
            key={`${message.role}-${index}`}
            role={message.isError ? "alert" : undefined}
          >
            <p>{message.text}</p>
            {message.role === "assistant" && !message.isError && (
              <>
                <span className="chat-source">
                  {formatSourceLabel(message.source, message.intent)}
                </span>
                {message.replyId && (
                  <div className="chat-feedback">
                    {message.feedback === "submitted" ? (
                      <span role="status">Thanks for your feedback</span>
                    ) : (
                      <>
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          disabled={message.feedback === "sending"}
                          onClick={() => handleFeedback(message.replyId, true)}
                        >
                          Helpful
                        </Button>
                        <Button
                          variant="secondary"
                          size="small"
                          type="button"
                          disabled={message.feedback === "sending"}
                          onClick={() => handleFeedback(message.replyId, false)}
                        >
                          Not helpful
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
        {loading && <li className="chat-thinking">Thinking...</li>}
        <li className="chat-scroll-anchor" ref={messageEndRef} aria-hidden="true" />
      </ol>

      <form className="chat-form" onSubmit={handleSubmit}>
        <div className="chat-input-field">
          <label htmlFor="certsure-chat-input">Your question</label>
          <input
            id="certsure-chat-input"
            type="text"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            maxLength={1000}
            aria-describedby="certsure-chat-hint"
            disabled={loading}
          />
          <span id="certsure-chat-hint" className="chat-hint">
            Up to 1000 characters.
          </span>
        </div>
        <Button type="submit" disabled={loading || !input.trim()}>
          Send
        </Button>
      </form>
    </Card>
  );
}
