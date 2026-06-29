import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from "react";
import { Send, Paperclip, Mic, X, Loader2, ChevronDown } from "lucide-react";

interface ChatInputProps {
  onSend: (text: string, imageBase64?: string) => void;
  disabled: boolean;
  model: string;
  setModel: (model: string) => void;
}

export interface ChatInputRef {
  setText: (text: string) => void;
}

const MODELS = [
  { id: "google/gemini-2.5-flash", name: "Gemini 2.5 Flash" },
  { id: "openai/gpt-4o", name: "GPT-4o" },
  { id: "anthropic/claude-3.5-sonnet", name: "Claude 3.5 Sonnet" }
];

const ChatInput = forwardRef<ChatInputRef, ChatInputProps>(({ onSend, disabled, model, setModel }, ref) => {
  const [text, setText] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [imageBase64, setImageBase64] = useState<string | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const recognitionRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    setText: (newText: string) => {
      setText(newText);
      if (textareaRef.current) {
        textareaRef.current.focus();
        // Adjust height automatically
        setTimeout(() => {
          if (textareaRef.current) {
            textareaRef.current.style.height = "auto";
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
          }
        }, 10);
      }
    }
  }));

  useEffect(() => {
    // Initialize Speech Recognition if supported
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      // eslint-disable-next-line
      setIsSpeechSupported(true);
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event: any) => {
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            setText((prev) => prev + transcript + " ");
          }
        }
      };

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      recognitionRef.current.onerror = (event: any) => {
        console.error("Speech recognition error", event.error);
        setIsRecording(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }
  }, []);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      setImageBase64(event.target?.result as string);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeImage = () => {
    setImageBase64(undefined);
  };

  const toggleRecording = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
    } else {
      setText("");
      recognitionRef.current?.start();
      setIsRecording(true);
    }
  };

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    if ((!text.trim() && !imageBase64) || disabled) return;
    
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
    }
    
    onSend(text.trim(), imageBase64);
    setText("");
    setImageBase64(undefined);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    e.target.style.height = "auto";
    e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
  };

  return (
    <div className="p-4 bg-transparent">
      <div className="max-w-4xl mx-auto">
        {imageBase64 && (
          <div className="mb-3 relative inline-block">
            <div className="relative rounded-xl overflow-hidden border border-blue-700/50 shadow-lg group">
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                <button 
                  onClick={removeImage}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded-full transform transition-transform hover:scale-110 shadow-lg"
                >
                  <X size={16} />
                </button>
              </div>
              <img src={imageBase64} alt="Attachment" className="h-24 w-auto object-cover" />
            </div>
          </div>
        )}
        
        <form 
          onSubmit={handleSubmit}
          className="relative bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-2 shadow-sm transition-all focus-within:ring-2 focus-within:ring-zinc-200 dark:focus-within:ring-zinc-700 flex flex-col"
        >
          <textarea
            ref={textareaRef}
            value={text}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={isRecording ? "Listening..." : "Ask anything..."}
            className="w-full max-h-[200px] bg-transparent text-zinc-900 dark:text-zinc-100 placeholder-zinc-400 resize-none outline-none py-3 px-3 overflow-y-auto custom-scrollbar text-base"
            rows={1}
            disabled={disabled}
          />
          
          <div className="flex items-center justify-between pt-2 px-1">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="p-1.5 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200 dark:hover:bg-zinc-800 rounded-lg transition-colors"
                disabled={disabled}
              >
                <Paperclip size={18} />
              </button>
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleImageUpload}
                accept="image/png, image/jpeg, image/webp"
                className="hidden"
              />
              {isSpeechSupported && (
                <button
                  type="button"
                  onClick={toggleRecording}
                  className={`p-1.5 rounded-lg transition-all duration-300 ${
                    isRecording 
                      ? "text-red-500 bg-red-100 dark:bg-red-900/30 animate-pulse" 
                      : "text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  }`}
                  disabled={disabled}
                >
                  <Mic size={18} />
                </button>
              )}
              
              <div className="relative ml-1">
                <button 
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="flex items-center gap-1.5 text-[13px] font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 px-2.5 py-1.5 rounded-lg transition-colors"
                >
                  <span>{MODELS.find(m => m.id === model)?.name || "Select Model"}</span>
                  <ChevronDown size={14} className={`transition-transform ${isDropdownOpen ? "rotate-180" : ""}`} />
                </button>
                
                {isDropdownOpen && (
                  <div className="absolute bottom-full mb-2 left-0 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl shadow-xl overflow-hidden z-50">
                    {MODELS.map(m => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setModel(m.id);
                          setIsDropdownOpen(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 text-[13px] transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800 ${model === m.id ? "text-zinc-900 dark:text-zinc-100 font-semibold" : "text-zinc-600 dark:text-zinc-400"}`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            
            <button
              type="submit"
              disabled={(!text.trim() && !imageBase64) || disabled}
              className="w-8 h-8 rounded-full bg-zinc-900 hover:bg-zinc-800 dark:bg-zinc-100 dark:hover:bg-zinc-200 disabled:bg-zinc-100 dark:disabled:bg-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-600 text-white dark:text-zinc-900 transition-all duration-200 flex items-center justify-center transform disabled:scale-100 hover:scale-105"
            >
              {disabled ? <Loader2 size={16} className="animate-spin" /> : (
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 7-7 7 7"/><path d="M12 19V5"/></svg>
              )}
            </button>
          </div>
        </form>
        <div className="text-center mt-2 text-[11px] text-zinc-400 dark:text-zinc-500 font-medium pb-2">
          VibeChat can make mistakes. Consider verifying important information.
        </div>
      </div>
    </div>
  );
});

export default ChatInput;
