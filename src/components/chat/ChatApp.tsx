"use client";

import { useState, useEffect, useRef } from "react";
import ChatHeader from "./ChatHeader";
import MessageList from "./MessageList";
import ChatInput, { ChatInputRef } from "./ChatInput";
import Sidebar from "./Sidebar";
import { v4 as uuidv4 } from "uuid";

import type { WidgetOptions } from "../../types";

export type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  image_url?: string;
};

export type Conversation = {
  id: string;
  title: string;
  messages: Message[];
  updatedAt: number;
  isPinned?: boolean;
};

interface ChatAppProps {
  options?: WidgetOptions;
  onClose?: () => void;
}

export default function ChatApp({ options, onClose }: ChatAppProps) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useState(options?.defaultModel || "google/gemini-2.5-flash");
  const [isStreaming, setIsStreaming] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(() => typeof window !== 'undefined' ? window.innerWidth > 768 : false);
  const chatInputRef = useRef<ChatInputRef>(null);

  useEffect(() => {
    const saved = localStorage.getItem("vibe-chat-history");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // eslint-disable-next-line
        setConversations(parsed);
        if (parsed.length > 0) {
          // If there are previous chats, pick the most recent one
          setActiveId(parsed[0].id);
        } else {
          setActiveId(null);
        }
      } catch {
        console.error("Failed to parse chat history");
        setActiveId(null);
      }
    } else {
      setActiveId(null);
    }
    
    setIsInitialized(true);
  }, []);

  useEffect(() => {
    if (isInitialized) {
      // Sort by pinned status first, then by updatedAt descending
      const sorted = [...conversations].sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return b.updatedAt - a.updatedAt;
      });
      localStorage.setItem("vibe-chat-history", JSON.stringify(sorted));
    }
  }, [conversations, isInitialized]);

  const activeConversation = conversations.find((c) => c.id === activeId) || null;

  const handleDelete = (id: string) => {
    setConversations((prev) => prev.filter(c => c.id !== id));
    if (activeId === id) setActiveId(null);
  };

  const handleRename = (id: string, newTitle: string) => {
    setConversations((prev) => prev.map(c => c.id === id ? { ...c, title: newTitle } : c));
  };

  const handleTogglePin = (id: string) => {
    setConversations((prev) => prev.map(c => c.id === id ? { ...c, isPinned: !c.isPinned } : c));
  };

  const handleClearChat = () => {
    if (window.confirm("Are you sure you want to delete all messages? This action cannot be undone.")) {
      setConversations([]);
      localStorage.removeItem("vibe-chat-history");
    }
  };

  const handleSend = async (text: string, imageBase64?: string) => {
    let currentId = activeId;
    let newConversation = false;

    if (!currentId) {
      currentId = uuidv4();
      newConversation = true;
      setActiveId(currentId);
    }

    const userMessage: Message = {
      id: uuidv4(),
      role: "user",
      content: text,
      image_url: imageBase64,
    };

    setConversations((prev) => {
      const existing = prev.find(c => c.id === currentId);
      if (!existing) {
        return [
          { id: currentId!, title: text.slice(0, 30) || "Image Message" + "...", messages: [userMessage], updatedAt: Date.now() },
          ...prev,
        ];
      }
      return prev.map((c) => {
        if (c.id === currentId) {
          return { ...c, messages: [...c.messages, userMessage], updatedAt: Date.now() };
        }
        return c;
      });
    });

    setIsStreaming(true);



    try {
      // Fetch fresh conversation to include new message
      const messagesPayload = (activeConversation?.messages || []).concat(userMessage).map(msg => {
        if (msg.image_url) {
          return {
            role: msg.role,
            content: [
              { type: "text", text: msg.content },
              { type: "image_url", image_url: { url: msg.image_url } }
            ]
          };
        }
        return {
          role: msg.role,
          content: msg.content
        };
      });

      const openRouterKey = options?.openRouterKey || "YOUR_OPENROUTER_API_KEY_HERE";
      
      if (!openRouterKey || openRouterKey === "YOUR_OPENROUTER_API_KEY_HERE") {
        throw new Error("Missing OpenRouter API Key. Please provide it in the Widget initialization options.");
      }

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.href,
          "X-Title": "Vibe Chat Widget",
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          stream: true,
        }),
      });

      if (!response.ok || !response.body) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || errorData?.error?.message || "Failed to fetch response from OpenRouter");
      }

      const assistantMessageId = uuidv4();
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentId) {
            return {
              ...c,
              messages: [...c.messages, { id: assistantMessageId, role: "assistant", content: "" }],
            };
          }
          return c;
        })
      );

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let done = false;
      let assistantResponse = "";
      let buffer = "";

      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";
          
          for (const line of lines) {
            const trimmedLine = line.trim();
            if (trimmedLine.startsWith("data: ") && trimmedLine !== "data: [DONE]") {
              try {
                const data = JSON.parse(trimmedLine.slice(6));
                const textChunk = data.choices[0]?.delta?.content || "";
                assistantResponse += textChunk;
                
                setConversations((prev) =>
                  prev.map((c) => {
                    if (c.id === currentId) {
                      const updatedMessages = [...c.messages];
                      updatedMessages[updatedMessages.length - 1].content = assistantResponse;
                      return { ...c, messages: updatedMessages, updatedAt: Date.now() };
                    }
                    return c;
                  })
                );
              } catch {
                // Ignore parse errors on partial chunks
              }
            }
          }
        }
      }
    } catch (error: any) {
      console.error("Error during chat:", error);
      
      const errorMessageId = uuidv4();
      const errorMessageText = `**Error:** ${error.message || "Something went wrong."}`;
      
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === currentId) {
            return {
              ...c,
              messages: [...c.messages, { id: errorMessageId, role: "assistant", content: errorMessageText }],
              updatedAt: Date.now()
            };
          }
          return c;
        })
      );
    } finally {
      setIsStreaming(false);
    }
  };

  if (!isInitialized) return null;

  return (
    <div className="flex h-full w-full bg-zinc-50 dark:bg-zinc-950 overflow-hidden text-zinc-900 dark:text-zinc-50 relative rounded-inherit">
      <Sidebar 
        conversations={conversations}
        activeId={activeId}
        onSelect={setActiveId}
        onNewChat={() => setActiveId(null)}
        onDelete={handleDelete}
        onRename={handleRename}
        onTogglePin={handleTogglePin}
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
      />
      <div className="flex-1 flex flex-col h-full overflow-hidden relative min-h-0 min-w-0">
        <ChatHeader 
          onClearChat={handleClearChat}
          onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
          onClose={onClose}
        />
        
        <MessageList 
          messages={activeConversation?.messages || []} 
          isStreaming={isStreaming} 
          onSuggestionClick={(prompt) => handleSend(prompt)}
          onEditMessage={(text) => chatInputRef.current?.setText(text)}
        />
        
        <div className="shrink-0 w-full flex justify-center pb-4 pt-2">
          <div className="w-full max-w-2xl px-4">
            <ChatInput 
              ref={chatInputRef}
              onSend={handleSend} 
              disabled={isStreaming}
              model={model}
              setModel={setModel}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
