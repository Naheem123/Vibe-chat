import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, Bot } from "lucide-react";
import { Message } from "./ChatApp";

interface MessageListProps {
  messages: Message[];
  isStreaming: boolean;
  onSuggestionClick?: (prompt: string) => void;
  onEditMessage?: (text: string) => void;
}

export default function MessageList({ messages, isStreaming, onSuggestionClick, onEditMessage }: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  if (messages.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center p-4 md:p-8 text-center text-zinc-500 overflow-y-auto">
        <Bot size={48} className="mb-4 text-zinc-300 dark:text-zinc-700" />
        <h2 className="text-2xl font-medium mb-6 text-zinc-900 dark:text-zinc-100">
          How can I help you today?
        </h2>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 space-y-6 scroll-smooth">
      {messages.map((msg, index) => (
        <div key={msg.id || index} className={`group flex gap-4 max-w-3xl mx-auto items-start ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
          <div className="w-8 h-8 mt-0.5 rounded-full flex items-center justify-center shrink-0 bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700">
            {msg.role === "assistant" ? <Bot size={16} /> : <div className="text-xs font-semibold">U</div>}
          </div>

          <div className={`flex flex-col gap-2 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}>
            {msg.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={msg.image_url} alt="Uploaded attachment" className="max-w-sm rounded-xl border border-zinc-200 dark:border-zinc-800" />
            )}
            <div className={`${msg.role === "user"
              ? "bg-zinc-200/50 dark:bg-zinc-800/80 text-zinc-900 dark:text-zinc-100 px-4 py-2.5 rounded-2xl"
              : "text-zinc-900 dark:text-zinc-100 py-1"
              }`}>
              <div className="prose prose-zinc dark:prose-invert max-w-none break-words leading-relaxed">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                    pre({ node, ...props }: any) {
                      return <>{props.children}</>;
                    },
                    // eslint-disable-next-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
                    code({ node, inline, className, children, ...props }: any) {
                      const match = /language-(\w+)/.exec(className || "");
                      const codeString = String(children).replace(/\n$/, "");
                      return !inline && match ? (
                        <CodeBlock language={match[1]} value={codeString} />
                      ) : (
                        <code className="bg-zinc-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-sm text-zinc-900 dark:text-zinc-100 font-mono" {...props}>
                          {children}
                        </code>
                      );
                    },
                  }}
                >
                  {msg.content}
                </ReactMarkdown>
              </div>
            </div>
            {/* Message Action Buttons */}
            <div className={`flex items-center gap-2 mt-1 text-xs text-zinc-400 opacity-0 group-hover:opacity-100 transition-opacity ${msg.role === "user" ? "flex-row-reverse" : ""}`}>
              <button 
                onClick={() => navigator.clipboard.writeText(msg.content)}
                className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors flex items-center gap-1"
              >
                <Copy size={12} /> Copy
              </button>
              {msg.role === "user" && (
                <button 
                  onClick={() => onEditMessage && onEditMessage(msg.content)}
                  className="hover:text-zinc-600 dark:hover:text-zinc-300 transition-colors flex items-center gap-1 ml-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg> Edit
                </button>
              )}
            </div>
          </div>
        </div>
      ))}
      {isStreaming && (
        <div className="flex gap-4 max-w-3xl mx-auto">
          <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 bg-zinc-900 text-zinc-50 dark:bg-zinc-100 dark:text-zinc-900 border border-zinc-200 dark:border-zinc-800">
            <Bot size={16} className="animate-pulse" />
          </div>
          <div className="py-2 text-zinc-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce"></span>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0.2s" }}></span>
            <span className="w-1.5 h-1.5 rounded-full bg-zinc-400 animate-bounce" style={{ animationDelay: "0.4s" }}></span>
          </div>
        </div>
      )}
    </div>
  );
}

function CodeBlock({ language, value }: { language: string; value: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative my-4 rounded-lg overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-[#0d1117] text-sm">
      <div className="flex items-center justify-between px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-xs text-zinc-400">
        <span className="lowercase">{language}</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 hover:text-zinc-100 transition-colors">
          {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <SyntaxHighlighter
        language={language}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        style={vscDarkPlus as any}
        customStyle={{ margin: 0, padding: "1rem", background: "transparent" }}
        wrapLines={true}
      >
        {value}
      </SyntaxHighlighter>
    </div>
  );
}
