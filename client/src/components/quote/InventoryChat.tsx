import { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Send, Sparkles, AlertCircle, Home, Upload, Loader2, Plus, Mic, Image, FileText, Video, Paperclip, Square } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion, AnimatePresence } from "framer-motion";

interface PresetInventorySet {
  id: string;
  key: string;
  titleEs: string;
  titleEn: string;
  descriptionEs?: string;
  descriptionEn?: string;
  homeSize: string;
  isActive: boolean;
}

interface PresetInventoryItem {
  id: string;
  itemName: string;
  itemNameEs: string;
  roomKey: string;
  categoryKey: string;
  defaultQuantity: number;
}

interface Message {
  id: string;
  role: 'agent' | 'user';
  content: string;
  timestamp: Date;
}

interface InventoryItem {
  id: string;
  name: string;
  room: string;
  category: string;
  quantity: number;
}

interface EstimatedCost {
  low: number;
  high: number;
  currency: string;
}

interface TruckRecommendation {
  totalWeightKg: number;
  recommendedTruck: string;
  truckCount: number;
  includedMovers: number;
  estimatedHours: number;
}

interface InventoryChatProps {
  onComplete: (items: InventoryItem[], estimatedCost?: EstimatedCost) => void;
  onItemsChange?: (items: InventoryItem[]) => void;
  onEstimateChange?: (estimatedCost: EstimatedCost | null, truckRecommendation: TruckRecommendation | null) => void;
  externalItems?: InventoryItem[];
  originCity?: string;
  originCountry?: string;
}

export function InventoryChat({ onComplete, onItemsChange, onEstimateChange, externalItems, originCity, originCountry }: InventoryChatProps) {
  const { t, i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [internalItems, setInternalItems] = useState<InventoryItem[]>([]);
  const [estimatedCost, setEstimatedCost] = useState<EstimatedCost | null>(null);
  const [truckRecommendation, setTruckRecommendation] = useState<TruckRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPresetButtons, setShowPresetButtons] = useState(true);
  const [loadingPreset, setLoadingPreset] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const documentInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  
  const items = externalItems ?? internalItems;
  const setItems = externalItems ? () => {} : setInternalItems;

  // Fetch preset inventories
  const { data: presets = [] } = useQuery<PresetInventorySet[]>({
    queryKey: ['preset-inventories'],
    queryFn: async () => {
      const res = await fetch('/api/preset-inventories');
      if (!res.ok) return [];
      return res.json();
    }
  });

  // Fetch Clara config for greeting
  const { data: config } = useQuery({
    queryKey: ['clara-config'],
    queryFn: async () => {
      const res = await fetch('/api/clara/config');
      if (!res.ok) throw new Error('Failed to load config');
      return res.json();
    }
  });

  // Load preset inventory
  const loadPresetInventory = async (presetKey: string) => {
    setLoadingPreset(true);
    setShowPresetButtons(false);
    
    try {
      const res = await fetch(`/api/preset-inventories/${presetKey}/items`);
      if (!res.ok) throw new Error('Failed to load preset');
      
      const data = await res.json();
      const preset = data.set as PresetInventorySet;
      const presetItems = data.items as PresetInventoryItem[];
      
      // Convert preset items to inventory items
      const newItems: InventoryItem[] = presetItems.map((item, index) => ({
        id: `preset-${presetKey}-${index}-${Date.now()}`,
        name: item.itemName,
        room: item.roomKey,
        category: item.categoryKey,
        quantity: item.defaultQuantity,
      }));
      
      // Add items to inventory
      if (onItemsChange) {
        onItemsChange([...items, ...newItems]);
      } else {
        setItems([...items, ...newItems]);
      }
      
      // Add user message about selection
      const presetTitle = isSpanish ? preset.titleEs : preset.titleEn;
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'user',
        content: isSpanish ? `Tengo un ${presetTitle.toLowerCase()}` : `I have a ${presetTitle.toLowerCase()}`,
        timestamp: new Date()
      }]);
      
      // Add agent response
      const itemCount = newItems.reduce((sum, i) => sum + i.quantity, 0);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: isSpanish 
          ? `¡Perfecto! He agregado ${itemCount} artículos típicos para un ${presetTitle.toLowerCase()}. Puedes revisar el inventario a la izquierda y ajustar las cantidades según lo que tengas. ¿Hay algo que quieras agregar o quitar?`
          : `Perfect! I've added ${itemCount} typical items for a ${presetTitle.toLowerCase()}. You can review the inventory on the left and adjust quantities as needed. Is there anything you'd like to add or remove?`,
        timestamp: new Date()
      }]);
      
    } catch (err: any) {
      setError(err.message);
      setShowPresetButtons(true);
    } finally {
      setLoadingPreset(false);
    }
  };

  // Handle file upload
  const handleFileUpload = async (file: File) => {
    if (!file) return;
    
    const documentTypes = ['.pdf', '.csv', '.xlsx', '.docx', '.txt'];
    const imageTypes = ['.jpg', '.jpeg', '.png', '.webp', '.gif', '.heic'];
    const audioTypes = ['.mp3', '.wav', '.m4a', '.ogg', '.webm', '.aac'];
    const videoTypes = ['.mp4', '.mov', '.avi', '.mkv'];
    const allowedTypes = [...documentTypes, ...imageTypes, ...audioTypes, ...videoTypes];
    const fileExt = '.' + file.name.split('.').pop()?.toLowerCase();
    
    if (!allowedTypes.includes(fileExt)) {
      setError(isSpanish 
        ? 'Formato no soportado. Use documentos, imágenes, audio o video.'
        : 'Unsupported format. Please use documents, images, audio, or video files.');
      return;
    }
    
    // Check file size limits based on type
    const maxSizeMB = imageTypes.includes(fileExt) ? 10 : 
                      audioTypes.includes(fileExt) ? 25 : 
                      videoTypes.includes(fileExt) ? 100 : 10;
    if (file.size > maxSizeMB * 1024 * 1024) {
      setError(isSpanish 
        ? `El archivo es muy grande. Máximo ${maxSizeMB}MB.`
        : `File too large. Maximum ${maxSizeMB}MB.`);
      return;
    }
    
    setIsUploading(true);
    setError(null);
    setShowPresetButtons(false);
    
    // Add uploading message
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      role: 'user',
      content: isSpanish 
        ? `Subiendo archivo: ${file.name}`
        : `Uploading file: ${file.name}`,
      timestamp: new Date()
    }]);
    
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('language', i18n.language);
      
      const response = await fetch('/api/clara/inventory-upload', {
        method: 'POST',
        credentials: 'include',
        body: formData
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || 'Upload failed');
      }
      
      if (data.items && data.items.length > 0) {
        // Immediately add items to inventory
        const newItems = data.items.map((item: InventoryItem, index: number) => ({
          ...item,
          id: `upload-${Date.now()}-${index}`
        }));
        
        if (onItemsChange) {
          onItemsChange([...items, ...newItems]);
        } else {
          setItems([...items, ...newItems]);
        }
        
        // Build itemized list for display
        const itemsList = newItems.map((item: InventoryItem) => 
          `${item.quantity}× ${item.name}`
        ).join(', ');
        
        const totalQuantity = newItems.reduce((sum: number, i: InventoryItem) => sum + (i.quantity || 1), 0);
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: isSpanish 
            ? `Listo. Encontré ${totalQuantity} artículos en "${file.name}":\n\n${itemsList}\n\nPuedes revisar y ajustar las cantidades en el panel de inventario. ¿Hay algo más que quieras agregar?`
            : `Done. Found ${totalQuantity} items in "${file.name}":\n\n${itemsList}\n\nYou can review and adjust quantities in the inventory panel. Is there anything else you'd like to add?`,
          timestamp: new Date()
        }]);
      } else {
        setMessages(prev => [...prev, {
          id: (Date.now() + 1).toString(),
          role: 'agent',
          content: isSpanish 
            ? `No pude identificar artículos de mudanza en el archivo. ¿Podrías decirme qué artículos contiene?`
            : `I couldn't identify moving items in the file. Could you tell me what items it contains?`,
          timestamp: new Date()
        }]);
      }
    } catch (err: any) {
      setError(err.message);
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: isSpanish 
          ? `Lo siento, hubo un error procesando el archivo. Por favor intenta de nuevo o describe los artículos manualmente.`
          : `Sorry, there was an error processing the file. Please try again or describe the items manually.`,
        timestamp: new Date()
      }]);
    } finally {
      setIsUploading(false);
    }
  };
  
  // Drag and drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };
  
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileUpload(file);
    }
  };
  
  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
    // Reset input so same file can be uploaded again
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (imageInputRef.current) imageInputRef.current.value = '';
    if (documentInputRef.current) documentInputRef.current.value = '';
    if (videoInputRef.current) videoInputRef.current.value = '';
    setShowAttachMenu(false);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach(track => track.stop());
        
        const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, { type: 'audio/webm' });
        handleFileUpload(audioFile);
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setError(isSpanish 
        ? 'No se pudo acceder al micrófono. Por favor permite el acceso.' 
        : 'Could not access microphone. Please allow access.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // Initialize with greeting
  useEffect(() => {
    if (config && messages.length === 0) {
      const greeting = isSpanish ? config.greetingEs : config.greeting;
      const presetPrompt = isSpanish 
        ? "\n\n¿Qué tamaño tiene tu hogar? Selecciona una opción para comenzar con un inventario sugerido:"
        : "\n\nWhat size is your home? Select an option to start with a suggested inventory:";
      setMessages([{
        id: '1',
        role: 'agent',
        content: (greeting || t('quote.chat.intro')) + (presets.length > 0 ? presetPrompt : ''),
        timestamp: new Date()
      }]);
    }
  }, [config, isSpanish, messages.length, t, presets.length]);

  // Auto-scroll to bottom
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, scrollToBottom]);

  // Notify parent of items change
  useEffect(() => {
    if (onItemsChange) {
      onItemsChange(items);
    }
  }, [items, onItemsChange]);

  // Notify parent of estimate changes
  useEffect(() => {
    if (onEstimateChange) {
      onEstimateChange(estimatedCost, truckRecommendation);
    }
  }, [estimatedCost, truckRecommendation, onEstimateChange]);

  const handleSendMessage = async () => {
    if (!inputValue.trim() || isTyping) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputValue,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInputValue("");
    setIsTyping(true);
    setError(null);

    try {
      // Debug: Log what we're sending to the API
      console.log('[InventoryChat] Sending to chat API:', {
        message: inputValue,
        inventoryLength: items.length,
        inventoryItems: items.slice(0, 5), // First 5 items for debugging
        externalItemsProvided: !!externalItems,
        externalItemsLength: externalItems?.length
      });
      
      const response = await fetch('/api/clara/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: inputValue,
          conversationHistory: messages,
          inventory: items,
          language: i18n.language,
          originCity,
          originCountry
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Chat request failed');
      }

      const data = await response.json();

      // Add agent response
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.response,
        timestamp: new Date()
      }]);

      // Compute final items array: process removals first, then additions
      let finalItems = items;
      
      // Handle item removals
      if (data.removeItems) {
        if (data.removeItems === 'all') {
          // Clear entire inventory
          finalItems = [];
        } else if (Array.isArray(data.removeItems) && data.removeItems.length > 0) {
          // Remove specific items by name (case-insensitive)
          const namesToRemove = data.removeItems.map((item: any) => 
            (item.name || '').toLowerCase()
          );
          finalItems = finalItems.filter((item: any) => 
            !namesToRemove.includes((item.name || '').toLowerCase())
          );
        }
      }
      
      // Handle item additions
      if (data.newItems && data.newItems.length > 0) {
        const newItems = data.newItems.map((item: any, index: number) => ({
          ...item,
          id: `${Date.now()}-${index}`
        }));
        finalItems = [...finalItems, ...newItems];
      }
      
      // Update items if there were any changes
      if (data.removeItems || (data.newItems && data.newItems.length > 0)) {
        if (onItemsChange) {
          onItemsChange(finalItems);
        } else {
          setItems(finalItems);
        }
      }

      // Update cost estimate if provided
      const finalCost = data.estimatedCost || estimatedCost || undefined;
      if (data.estimatedCost) {
        setEstimatedCost(data.estimatedCost);
      }

      // Update truck recommendation if provided
      if (data.truckRecommendation) {
        setTruckRecommendation(data.truckRecommendation);
      }

      // Check if inventory is complete - use computed finalItems, not stale state
      if (data.isComplete) {
        onComplete(finalItems, finalCost);
      }

    } catch (err: any) {
      console.error('Chat error:', err);
      setError(err.message || (isSpanish ? 'Error al procesar mensaje' : 'Error processing message'));
      
      // Add fallback message
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: isSpanish 
          ? 'Lo siento, tuve un problema procesando tu mensaje. Por favor, intenta de nuevo.' 
          : 'Sorry, I had a problem processing your message. Please try again.',
        timestamp: new Date()
      }]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="flex flex-col h-[400px] bg-white rounded-xl border shadow-sm overflow-hidden">
      <div className="p-4 border-b bg-slate-50 flex items-center">
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
              <AvatarImage src="/logo-icon.png" className="bg-white p-1" />
              <AvatarFallback>RB</AvatarFallback>
            </Avatar>
            <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full bg-green-500 border-2 border-white"></span>
          </div>
          <div>
            <h3 className="font-bold text-slate-900">{config?.name || 'Clara'}</h3>
            <p className="text-xs text-slate-500 flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-primary" /> 
              {isSpanish ? 'Asistente AI' : 'AI Assistant'}
            </p>
          </div>
        </div>
      </div>

      <div 
        ref={scrollRef}
        className={`flex-1 p-4 overflow-y-auto scroll-smooth relative ${isDragging ? 'bg-primary/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {isDragging && (
          <div className="absolute inset-0 flex items-center justify-center bg-primary/10 border-2 border-dashed border-primary rounded-lg z-10">
            <div className="text-center">
              <Upload className="w-10 h-10 text-primary mx-auto mb-2" />
              <p className="text-primary font-medium">
                {isSpanish ? 'Suelta tu archivo aquí' : 'Drop your file here'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {isSpanish ? 'Documentos, imágenes, audio o video' : 'Documents, images, audio, or video'}
              </p>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              onAnimationComplete={scrollToBottom}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm ${
                  msg.role === 'user'
                    ? 'bg-primary text-white rounded-br-none'
                    : 'bg-slate-100 text-slate-800 rounded-bl-none'
                }`}
              >
                {msg.content}
              </div>
            </motion.div>
          ))}
          {isTyping && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="bg-slate-100 px-4 py-3 rounded-2xl rounded-bl-none flex gap-1">
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                <span className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
              </div>
            </motion.div>
          )}
          
          {showPresetButtons && presets.length > 0 && !loadingPreset && (
            <motion.div 
              initial={{ opacity: 0, y: 10 }} 
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-wrap gap-2 mt-3"
            >
              {presets.map((preset) => (
                <Button
                  key={preset.key}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => loadPresetInventory(preset.key)}
                  className="min-h-12 rounded-full border-[#FF6C00] text-[#24152E] hover:bg-[#FF6C00] hover:text-[#24152E] transition-colors"
                  data-testid={`btn-preset-${preset.key}`}
                >
                  <Home className="w-3.5 h-3.5 mr-1.5" />
                  {isSpanish ? preset.titleEs : preset.titleEn}
                </Button>
              ))}
            </motion.div>
          )}
          
          {loadingPreset && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-center py-2">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <div className="w-4 h-4 border-2 border-[#FF6C00] border-t-transparent rounded-full animate-spin" />
                {isSpanish ? "Cargando inventario..." : "Loading inventory..."}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}

      <div className="p-3 border-t bg-white">
        <div className="flex items-center gap-2 bg-slate-100 rounded-full px-2 py-1">
          <Popover open={showAttachMenu} onOpenChange={setShowAttachMenu}>
            <PopoverTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={isUploading}
                className="h-12 w-12 rounded-full text-slate-500 hover:text-slate-700 hover:bg-slate-200"
                data-testid="button-attach-menu"
                title={isSpanish ? 'Adjuntar archivo' : 'Attach file'}
              >
                {isUploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-48 p-2" align="start" side="top">
              <div className="flex flex-col gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 min-h-12"
                  onClick={() => imageInputRef.current?.click()}
                  data-testid="button-upload-image"
                >
                  <Image className="w-4 h-4 text-green-600" />
                  <span>{isSpanish ? 'Foto' : 'Photo'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 min-h-12"
                  onClick={() => documentInputRef.current?.click()}
                  data-testid="button-upload-document"
                >
                  <FileText className="w-4 h-4 text-blue-600" />
                  <span>{isSpanish ? 'Documento' : 'Document'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 min-h-12"
                  onClick={() => videoInputRef.current?.click()}
                  data-testid="button-upload-video"
                >
                  <Video className="w-4 h-4 text-purple-600" />
                  <span>{isSpanish ? 'Video' : 'Video'}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="justify-start gap-2 min-h-12"
                  onClick={() => fileInputRef.current?.click()}
                  data-testid="button-upload-file"
                >
                  <Paperclip className="w-4 h-4 text-slate-600" />
                  <span>{isSpanish ? 'Otro archivo' : 'Other file'}</span>
                </Button>
              </div>
            </PopoverContent>
          </Popover>
          
          <input
            ref={imageInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.gif,.heic"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-image-upload"
          />
          <input
            ref={documentInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.docx,.txt"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-document-upload"
          />
          <input
            ref={videoInputRef}
            type="file"
            accept=".mp4,.mov,.avi,.mkv,.webm"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-video-upload"
          />
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.csv,.xlsx,.docx,.txt,.jpg,.jpeg,.png,.webp,.gif,.heic,.mp3,.wav,.m4a,.ogg,.webm,.aac,.mp4,.mov,.avi,.mkv"
            onChange={handleFileInputChange}
            className="hidden"
            data-testid="input-file-upload"
          />
          
          <Input
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder={isSpanish ? "Describe tus muebles y artículos..." : "Describe your furniture and items..."}
            className="flex-1 border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 px-2"
            disabled={isTyping || isRecording}
            data-testid="input-chat-message"
          />
          
          <Button
            type="button"
            onClick={isRecording ? stopRecording : startRecording}
            size="icon"
            variant="ghost"
            className={`h-12 w-12 rounded-full ${isRecording ? 'bg-destructive hover:bg-destructive/90 text-destructive-foreground animate-pulse' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-200'}`}
            disabled={isTyping || isUploading}
            data-testid="button-microphone"
            title={isRecording 
              ? (isSpanish ? 'Detener grabación' : 'Stop recording')
              : (isSpanish ? 'Grabar nota de voz' : 'Record voice note')}
          >
            {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </Button>
          
          <Button 
            type="button"
            onClick={handleSendMessage}
            size="icon" 
            className="h-12 w-12 rounded-full bg-primary hover:bg-primary/90"
            disabled={!inputValue.trim() || isTyping || isRecording}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

    </div>
  );
}
