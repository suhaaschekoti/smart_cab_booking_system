import React, { useState, useRef, useEffect } from "react";
import { planTour } from "../api/attractions";

const QUICK_PROMPTS = [
  "Half-day scenic trip for family",
  "Adventure & trekking spots nearby",
  "Calm nature viewpoints & waterfalls",
  "Heritage & historic tour"
];

export default function TourChatbot({ userCoords, onSelectDestination }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      sender: "bot",
      text: "👋 Hi! I'm your AI Tour Concierge. Tell me what kind of trip you want, how many hours you have, or tap a suggestion below.",
      itinerary: null
    }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, loading, isOpen]);

  const handleSend = async (userText) => {
    const textToSend = userText || input;
    if (!textToSend.trim() || loading) return;

    const newMessages = [...messages, { sender: "user", text: textToSend }];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    try {
      const data = await planTour({
        prompt: textToSend,
        pickup_lat: userCoords?.lat || 9.6700,
        pickup_lng: userCoords?.lng || 76.6300,
        duration_hours: 4.0
      });

      setMessages([
        ...newMessages,
        {
          sender: "bot",
          text: data.summary || "Here is a custom itinerary curated just for you:",
          itinerary: data
        }
      ]);
    } catch (err) {
      setMessages([
        ...newMessages,
        {
          sender: "bot",
          text: "Sorry, I couldn't reach the trip planner service right now. Please verify your backend server."
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating Launcher Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 9999,
          display: "flex",
          alignItems: "center",
          gap: "8px",
          background: "linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)",
          color: "#fff",
          border: "none",
          borderRadius: "50px",
          padding: "12px 20px",
          boxShadow: "0 8px 24px rgba(79, 70, 229, 0.4)",
          cursor: "pointer",
          fontWeight: "600",
          fontSize: "14px",
          transition: "transform 0.2s ease, box-shadow 0.2s ease"
        }}
        onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
        onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
      >
        <span style={{ fontSize: "16px" }}>✨</span>
        <span>{isOpen ? "Close Assistant" : "AI Tour Planner"}</span>
      </button>

      {/* Slide-Up Chat Window */}
      {isOpen && (
        <div
          style={{
            position: "fixed",
            bottom: "84px",
            right: "24px",
            zIndex: 9999,
            width: "380px",
            maxWidth: "calc(100vw - 32px)",
            height: "560px",
            background: "#161b26",
            border: "1px solid rgba(255, 255, 255, 0.12)",
            borderRadius: "18px",
            boxShadow: "0 16px 40px rgba(0, 0, 0, 0.6)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            fontFamily: "inherit"
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "14px 16px",
              background: "#1c2232",
              borderBottom: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  background: "rgba(79, 70, 229, 0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "14px"
                }}
              >
                ✨
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "600", color: "#f1f5f9" }}>
                  Smart Cab Tour Guide
                </h4>
                <p style={{ margin: 0, fontSize: "11px", color: "#10b981", fontWeight: "500" }}>
                  ● Powered by Groq LLaMA
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                fontSize: "18px",
                cursor: "pointer",
                padding: "4px"
              }}
            >
              ✕
            </button>
          </div>

          {/* Messages Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "16px",
              display: "flex",
              flexDirection: "column",
              gap: "12px"
            }}
          >
            {messages.map((msg, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: msg.sender === "user" ? "flex-end" : "flex-start"
                }}
              >
                <div
                  style={{
                    maxWidth: "88%",
                    padding: "10px 14px",
                    borderRadius: "14px",
                    fontSize: "13px",
                    lineHeight: "1.45",
                    color: "#f8fafc",
                    background:
                      msg.sender === "user"
                        ? "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)"
                        : "#20283a",
                    border:
                      msg.sender === "user"
                        ? "none"
                        : "1px solid rgba(255, 255, 255, 0.08)",
                    borderBottomRightRadius: msg.sender === "user" ? "2px" : "14px",
                    borderBottomLeftRadius: msg.sender === "bot" ? "2px" : "14px"
                  }}
                >
                  <p style={{ margin: 0 }}>{msg.text}</p>

                  {/* Render Structured Itinerary */}
                  {msg.itinerary && (
                    <div
                      style={{
                        marginTop: "10px",
                        paddingTop: "10px",
                        borderTop: "1px solid rgba(255, 255, 255, 0.1)"
                      }}
                    >
                      <div
                        style={{
                          fontSize: "12px",
                          fontWeight: "700",
                          color: "#818cf8",
                          letterSpacing: "0.5px",
                          marginBottom: "8px"
                        }}
                      >
                        {msg.itinerary.title} • {msg.itinerary.total_estimated_time}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        {msg.itinerary.stops?.map((stop, sIdx) => (
                          <div
                            key={sIdx}
                            style={{
                              background: "rgba(15, 23, 42, 0.6)",
                              borderRadius: "8px",
                              padding: "8px 10px",
                              border: "1px solid rgba(255, 255, 255, 0.06)"
                            }}
                          >
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                fontWeight: "600",
                                color: "#f1f5f9",
                                fontSize: "12px"
                              }}
                            >
                              <span>
                                {sIdx + 1}. {stop.name}
                              </span>
                              <span
                                style={{
                                  fontSize: "10px",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  background: "rgba(79, 70, 229, 0.3)",
                                  color: "#a5b4fc"
                                }}
                              >
                                {stop.recommended_duration || "45m"}
                              </span>
                            </div>

                            {stop.why_visit && (
                              <p
                                style={{
                                  margin: "4px 0 0 0",
                                  fontSize: "11px",
                                  color: "#94a3b8"
                                }}
                              >
                                {stop.why_visit}
                              </p>
                            )}

                            {onSelectDestination && (
                            <button
                                onClick={() => {
                                onSelectDestination(stop);
                                setIsOpen(false); // Close chat drawer so the user sees the booking card immediately
                                }}
                                style={{
                                marginTop: "6px",
                                width: "100%",
                                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                                border: "none",
                                color: "#ffffff",
                                fontSize: "11px",
                                fontWeight: "600",
                                padding: "7px 10px",
                                borderRadius: "6px",
                                cursor: "pointer",
                                textAlign: "center",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "4px"
                                }}
                            >
                                <span>📍</span>
                                <span>Book Ride to {stop.name.split(" ")[0]}</span>
                            </button>
                            )}
                          </div>
                        ))}
                      </div>

                      {msg.itinerary.tips && (
                        <div
                          style={{
                            marginTop: "8px",
                            fontSize: "11px",
                            color: "#fbbf24",
                            background: "rgba(251, 191, 36, 0.1)",
                            padding: "6px 8px",
                            borderRadius: "6px"
                          }}
                        >
                          💡 <strong>Tip:</strong> {msg.itinerary.tips}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "#94a3b8",
                  padding: "8px 12px",
                  background: "#1c2232",
                  borderRadius: "12px",
                  width: "fit-content"
                }}
              >
                <span>⚡ Planning your itinerary with Groq...</span>
              </div>
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Quick Prompts Suggestions */}
          <div
            style={{
              padding: "8px 12px",
              background: "#141923",
              borderTop: "1px solid rgba(255, 255, 255, 0.06)",
              display: "flex",
              gap: "6px",
              overflowX: "auto",
              whiteSpace: "nowrap"
            }}
          >
            {QUICK_PROMPTS.map((p, idx) => (
              <button
                key={idx}
                disabled={loading}
                onClick={() => handleSend(p)}
                style={{
                  background: "#222a3d",
                  border: "1px solid rgba(255, 255, 255, 0.1)",
                  color: "#cbd5e1",
                  fontSize: "11px",
                  padding: "4px 10px",
                  borderRadius: "20px",
                  cursor: "pointer",
                  flexShrink: 0
                }}
              >
                {p}
              </button>
            ))}
          </div>

          {/* Input & Send Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSend();
            }}
            style={{
              padding: "10px 12px",
              background: "#1c2232",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
              display: "flex",
              gap: "8px"
            }}
          >
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="e.g. 3 hours peaceful nature trip..."
              style={{
                flex: 1,
                background: "#0f141f",
                border: "1px solid rgba(255, 255, 255, 0.12)",
                borderRadius: "8px",
                padding: "8px 12px",
                color: "#fff",
                fontSize: "12px",
                outline: "none"
              }}
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              style={{
                background: "linear-gradient(135deg, #4f46e5 0%, #6366f1 100%)",
                border: "none",
                borderRadius: "8px",
                padding: "8px 14px",
                color: "#fff",
                fontSize: "12px",
                fontWeight: "600",
                cursor: loading || !input.trim() ? "not-allowed" : "pointer",
                opacity: loading || !input.trim() ? 0.6 : 1
              }}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}