import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User, X, MessageSquare, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function ClaraFloatingChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 1,
      text: "¡Hola! Soy Clara, tu asistente de mudanzas con IA. ¿En qué puedo ayudarte hoy? Puedo ayudarte a estimar tu inventario o responder preguntas sobre tu mudanza.",
      sender: 'bot',
      timestamp: new Date()
    }
  ]);
  const [input, setInput] = useState("");

  const handleSend = () => {
    if (!input.trim()) return;

    const newUserMessage: Message = {
      id: messages.length + 1,
      text: input,
      sender: 'user',
      timestamp: new Date()
    };

    setMessages(prev => [...prev, newUserMessage]);
    setInput("");

    // Simulate bot response
    setTimeout(() => {
      const botResponse: Message = {
        id: messages.length + 2,
        text: "Entiendo. Como soy una versión de demostración, todavía estoy aprendiendo, ¡pero me encantaría ayudarte con eso pronto!",
        sender: 'bot',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, botResponse]);
    }, 1000);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          className={cn(
            "fixed bottom-24 md:bottom-6 right-4 md:right-6 h-14 w-14 rounded-full shadow-xl transition-all duration-300 z-[60]",
            isOpen ? "rotate-90 bg-slate-200 hover:bg-slate-300 text-slate-600" : "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90 text-white animate-in zoom-in"
          )}
        >
          {isOpen ? <X className="h-6 w-6" /> : <Bot className="h-8 w-8" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-[calc(100vw-2rem)] max-w-[380px] p-0 mr-4 md:mr-6 mb-2 border-0 shadow-2xl rounded-xl overflow-hidden bg-white" 
        side="top" 
        align="end"
        sideOffset={10}
      >
        <div className="flex flex-col h-[500px]">
          <div className="bg-[#1A1A1A] p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-white/20 p-2 rounded-full backdrop-blur-sm">
                <Bot className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-white">Clara AI</h3>
                <p className="text-xs text-blue-100">Asistente de mudanzas</p>
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-white hover:bg-white/20 rounded-full h-8 w-8" 
              onClick={() => setIsOpen(false)}
            >
              <ChevronDown className="h-5 w-5" />
            </Button>
          </div>
          
          <ScrollArea className="flex-1 p-4 bg-slate-50/50">
            <div className="flex flex-col gap-4">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    "flex gap-2 max-w-[85%]",
                    msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                  )}
                >
                  <div className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-1",
                    msg.sender === 'user' ? "bg-slate-200 hidden" : "bg-[#1A1A1A]"
                  )}>
                    <Bot className="h-3 w-3 text-white" />
                  </div>
                  <div className={cn(
                    "p-3 rounded-2xl text-sm shadow-sm",
                    msg.sender === 'user' 
                      ? "bg-[#1A1A1A] text-white rounded-tr-sm" 
                      : "bg-white text-slate-800 rounded-tl-sm border border-slate-100"
                  )}>
                    {msg.text}
                    <span className={cn("text-[10px] block mt-1", msg.sender === 'user' ? "text-blue-200" : "text-slate-400")}>
                      {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
          
          <div className="p-3 bg-white border-t">
            <form 
              onSubmit={(e) => { e.preventDefault(); handleSend(); }}
              className="flex gap-2 items-center bg-slate-50 p-1.5 rounded-full border focus-within:ring-2 focus-within:ring-[#1A1A1A]/20 focus-within:border-[#1A1A1A] transition-all"
            >
              <Input 
                placeholder="Escribe tu pregunta..." 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                className="flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 h-9 px-3"
              />
              <Button 
                type="submit" 
                size="icon"
                className={cn(
                  "h-8 w-8 rounded-full transition-all", 
                  input.trim() ? "bg-[#1A1A1A] hover:bg-[#1A1A1A]/90" : "bg-slate-200 text-slate-400"
                )} 
                disabled={!input.trim()}
              >
                <Send className="h-4 w-4" />
                <span className="sr-only">Enviar</span>
              </Button>
            </form>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
