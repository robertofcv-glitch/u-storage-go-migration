import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, Send, User } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: number;
  text: string;
  sender: 'user' | 'bot';
  timestamp: Date;
}

export function ClaraChat() {
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
    <Card className="h-[600px] flex flex-col border-t-4 border-t-[#1A1A1A]">
      <CardHeader className="pb-4 border-b">
        <div className="flex items-center gap-3">
          <div className="bg-[#1A1A1A] p-2 rounded-full">
            <Bot className="h-6 w-6 text-white" />
          </div>
          <div>
            <CardTitle className="text-[#1A1A1A]">Chat con Clara</CardTitle>
            <CardDescription>Tu asistente personal de mudanzas 24/7</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 p-0 flex flex-col overflow-hidden">
        <ScrollArea className="flex-1 p-4">
          <div className="flex flex-col gap-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={cn(
                  "flex gap-3 max-w-[80%]",
                  msg.sender === 'user' ? "ml-auto flex-row-reverse" : "mr-auto"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                  msg.sender === 'user' ? "bg-slate-200" : "bg-[#1A1A1A]"
                )}>
                  {msg.sender === 'user' ? <User className="h-4 w-4 text-slate-600" /> : <Bot className="h-4 w-4 text-white" />}
                </div>
                <div className={cn(
                  "p-3 rounded-lg text-sm",
                  msg.sender === 'user' 
                    ? "bg-[#1A1A1A] text-white rounded-tr-none" 
                    : "bg-slate-100 text-slate-800 rounded-tl-none"
                )}>
                  {msg.text}
                  <span className="text-[10px] opacity-70 block mt-1">
                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="p-4 border-t bg-slate-50">
          <form 
            onSubmit={(e) => { e.preventDefault(); handleSend(); }}
            className="flex gap-2"
          >
            <Input 
              placeholder="Escribe un mensaje a Clara..." 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" className="bg-[#1A1A1A] hover:bg-[#1A1A1A]/90" disabled={!input.trim()}>
              <Send className="h-4 w-4" />
              <span className="sr-only">Enviar</span>
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  );
}
