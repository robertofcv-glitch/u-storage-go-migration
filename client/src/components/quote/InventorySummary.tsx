import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { 
  Box, Home, Layers, Sofa, BedDouble, Utensils, Tv, 
  Refrigerator, Package, Wine, TreeDeciduous, Dumbbell, Baby, MoreHorizontal,
  Armchair, Microwave, Plus, Minus, Trash2, PlusCircle, MapPin
} from "lucide-react";
import { motion } from "framer-motion";

interface InventoryItem {
  id: string;
  name: string;
  room: string;
  category: string;
  quantity: number;
}

interface InventorySummaryProps {
  items: InventoryItem[];
  onItemsChange?: (items: InventoryItem[]) => void;
  editable?: boolean;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
  sofas_large: Sofa,
  sofas_medium: Sofa,
  sofas_small: Armchair,
  beds_large: BedDouble,
  beds_medium: BedDouble,
  beds_small: BedDouble,
  tables: Utensils,
  chairs: Armchair,
  storage: Box,
  electronics: Tv,
  appliances_large: Refrigerator,
  appliances_small: Microwave,
  boxes: Package,
  fragile: Wine,
  outdoor: TreeDeciduous,
  exercise: Dumbbell,
  kids: Baby,
  other: MoreHorizontal,
};

const CATEGORY_COLORS: Record<string, string> = {
  sofas_large: "text-blue-700",
  sofas_medium: "text-blue-500",
  sofas_small: "text-blue-400",
  beds_large: "text-purple-700",
  beds_medium: "text-purple-500",
  beds_small: "text-purple-400",
  tables: "text-orange-600",
  chairs: "text-teal-600",
  storage: "text-amber-600",
  electronics: "text-cyan-600",
  appliances_large: "text-slate-600",
  appliances_small: "text-gray-600",
  boxes: "text-yellow-600",
  fragile: "text-red-600",
  outdoor: "text-green-600",
  exercise: "text-indigo-600",
  kids: "text-pink-600",
  other: "text-slate-500",
};

export function InventorySummary({ items, onItemsChange, editable = true }: InventorySummaryProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemRoom, setNewItemRoom] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("");
  const [newItemQuantity, setNewItemQuantity] = useState(1);

  const { data: categoriesData } = useQuery({
    queryKey: ['inventory-categories'],
    queryFn: async () => {
      const res = await fetch('/api/inventory-categories');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  const categories = Array.isArray(categoriesData) ? categoriesData : [];

  const { data: roomsData } = useQuery({
    queryKey: ['inventory-rooms'],
    queryFn: async () => {
      const res = await fetch('/api/inventory-rooms');
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    }
  });
  const rooms = Array.isArray(roomsData) ? roomsData : [];

  const unassignedItems = items.filter(item => !item.room || item.room === '' || item.room === 'unassigned');
  const assignedItems = items.filter(item => item.room && item.room !== '' && item.room !== 'unassigned');

  const groupedByRoom = assignedItems.reduce((acc, item) => {
    const roomKey = item.room;
    if (!acc[roomKey]) acc[roomKey] = [];
    acc[roomKey].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const sortedRoomEntries = Object.entries(groupedByRoom)
    .sort(([a], [b]) => a.localeCompare(b));

  const groupedByCategory = items.reduce((acc, item) => {
    const catKey = item.category || 'other';
    if (!acc[catKey]) acc[catKey] = [];
    acc[catKey].push(item);
    return acc;
  }, {} as Record<string, InventoryItem[]>);

  const sortedCategoryEntries = Object.entries(groupedByCategory)
    .sort(([a], [b]) => a.localeCompare(b));

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);

  const getRoomLabel = (roomKey: string) => {
    if (!roomKey || roomKey === 'unassigned') {
      return isSpanish ? "Sin asignar" : "Unassigned";
    }
    const room = rooms.find((r: any) => r.key === roomKey);
    if (room) return isSpanish ? room.labelEs : room.labelEn;
    return roomKey;
  };

  const getCategoryLabel = (catKey: string) => {
    const cat = categories.find((c: any) => c.key === catKey);
    if (cat) return isSpanish ? cat.labelEs : cat.labelEn;
    return catKey;
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORY_ICONS[category] || Box;
  };

  const getCategoryColor = (category: string) => {
    return CATEGORY_COLORS[category] || "text-slate-500";
  };

  const updateQuantity = (itemId: string, delta: number) => {
    if (!onItemsChange) return;
    const updated = items.map(item => {
      if (item.id === itemId) {
        const newQty = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(item => item.quantity > 0);
    onItemsChange(updated);
  };

  const deleteItem = (itemId: string) => {
    if (!onItemsChange) return;
    onItemsChange(items.filter(item => item.id !== itemId));
  };

  const changeRoom = (itemId: string, newRoom: string) => {
    if (!onItemsChange) return;
    const updated = items.map(item => {
      if (item.id === itemId) {
        return { ...item, room: newRoom };
      }
      return item;
    });
    onItemsChange(updated);
  };

  const addNewItem = () => {
    if (!onItemsChange || !newItemCategory) return;
    const categoryObj = categories.find((c: any) => c.key === newItemCategory);
    const categoryLabel = categoryObj 
      ? (isSpanish ? categoryObj.labelEs : categoryObj.labelEn) 
      : newItemCategory;
    const itemName = newItemName.trim() || categoryLabel;
    const newItem: InventoryItem = {
      id: `manual-${Date.now()}`,
      name: itemName,
      room: newItemRoom || 'unassigned',
      category: newItemCategory,
      quantity: newItemQuantity
    };
    onItemsChange([...items, newItem]);
    setNewItemName("");
    setNewItemRoom("");
    setNewItemCategory("");
    setNewItemQuantity(1);
    setShowAddForm(false);
  };

  const renderItemWithRoomSelector = (item: InventoryItem, showRoomLabel: boolean = false) => {
    const IconComponent = getCategoryIcon(item.category);
    const colorClass = getCategoryColor(item.category);
    
    return (
      <div 
        key={item.id} 
        className="p-3 flex flex-col gap-2 text-sm"
      >
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <IconComponent className={`w-4 h-4 flex-shrink-0 ${colorClass}`} />
            <span className="font-medium text-slate-700 truncate">{item.name}</span>
          </div>
          {editable && onItemsChange ? (
            <div className="flex items-center gap-1 flex-shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-red-500"
                onClick={() => updateQuantity(item.id, -1)}
                data-testid={`btn-decrease-${item.id}`}
              >
                <Minus className="h-3 w-3" />
              </Button>
              <Badge variant="outline" className="bg-slate-50 min-w-[32px] justify-center">
                {item.quantity}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-green-500"
                onClick={() => updateQuantity(item.id, 1)}
                data-testid={`btn-increase-${item.id}`}
              >
                <Plus className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-slate-400 hover:text-red-500 ml-1"
                onClick={() => deleteItem(item.id)}
                data-testid={`btn-delete-${item.id}`}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          ) : (
            <Badge variant="outline" className="bg-slate-50">x{item.quantity}</Badge>
          )}
        </div>
        
        {editable && onItemsChange && (
          <div className="flex items-center gap-2 pl-6">
            <MapPin className="w-3 h-3 text-slate-400" />
            <Select 
              value={item.room || 'unassigned'} 
              onValueChange={(value) => changeRoom(item.id, value)}
            >
              <SelectTrigger className="h-7 text-xs flex-1" data-testid={`select-room-${item.id}`}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unassigned">
                  <span className="text-slate-400">{isSpanish ? "Sin asignar" : "Unassigned"}</span>
                </SelectItem>
                {rooms.filter((r: any) => r.isActive).map((room: any) => (
                  <SelectItem key={room.key} value={room.key}>
                    {isSpanish ? room.labelEs : room.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        
        {!editable && showRoomLabel && (
          <span className="text-xs text-slate-400 pl-6">{getRoomLabel(item.room)}</span>
        )}
      </div>
    );
  };

  const renderItemControls = (item: InventoryItem) => {
    if (!editable || !onItemsChange) {
      return <Badge variant="outline" className="bg-slate-50">x{item.quantity}</Badge>;
    }
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-red-500"
          onClick={() => updateQuantity(item.id, -1)}
          data-testid={`btn-decrease-${item.id}`}
        >
          <Minus className="h-3 w-3" />
        </Button>
        <Badge variant="outline" className="bg-slate-50 min-w-[32px] justify-center">
          {item.quantity}
        </Badge>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-green-500"
          onClick={() => updateQuantity(item.id, 1)}
          data-testid={`btn-increase-${item.id}`}
        >
          <Plus className="h-3 w-3" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-slate-400 hover:text-red-500 ml-1"
          onClick={() => deleteItem(item.id)}
          data-testid={`btn-delete-${item.id}`}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    );
  };

  return (
    <Card className="h-full border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <CardTitle className="text-lg font-bold flex items-center gap-2">
          <Box className="w-5 h-5 text-primary" />
          {isSpanish ? "Resumen" : "Summary"}
          <Badge variant="secondary" className="ml-auto">
            {totalItems} {isSpanish ? "artículos" : "items"}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {editable && onItemsChange && (
          <div className="mb-4">
            {!showAddForm ? (
              <Button
                variant="outline"
                size="sm"
                className="w-full border-dashed border-2 text-slate-500 hover:text-primary hover:border-primary"
                onClick={() => setShowAddForm(true)}
                data-testid="btn-add-item"
              >
                <PlusCircle className="w-4 h-4 mr-2" />
                {isSpanish ? "Agregar artículo" : "Add item"}
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-white border border-slate-200 rounded-lg p-4 space-y-4"
              >
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {isSpanish ? "Tipo de artículo" : "Item type"} *
                  </label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger className="h-10 text-sm" data-testid="select-new-item-category">
                      <SelectValue placeholder={isSpanish ? "Seleccionar tipo..." : "Select type..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {categories.filter((c: any) => c.isActive).map((cat: any) => (
                        <SelectItem key={cat.key} value={cat.key} className="py-2">
                          {isSpanish ? cat.labelEs : cat.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-700 mb-1 block">
                    {isSpanish ? "Habitación" : "Room"}
                  </label>
                  <Select value={newItemRoom} onValueChange={setNewItemRoom}>
                    <SelectTrigger className="h-10 text-sm" data-testid="select-new-item-room">
                      <SelectValue placeholder={isSpanish ? "Seleccionar habitación..." : "Select room..."} />
                    </SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      <SelectItem value="unassigned" className="py-2">
                        <span className="text-slate-400">{isSpanish ? "Sin asignar" : "Unassigned"}</span>
                      </SelectItem>
                      {rooms.filter((r: any) => r.isActive).map((room: any) => (
                        <SelectItem key={room.key} value={room.key} className="py-2">
                          {isSpanish ? room.labelEs : room.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-slate-700">{isSpanish ? "Cantidad:" : "Quantity:"}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setNewItemQuantity(Math.max(1, newItemQuantity - 1))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="w-10 text-center font-semibold text-lg">{newItemQuantity}</span>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => setNewItemQuantity(newItemQuantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <div>
                  <label className="text-sm font-medium text-slate-500 mb-1 block">
                    {isSpanish ? "Notas (opcional)" : "Notes (optional)"}
                  </label>
                  <Input
                    placeholder={isSpanish ? "Ej: Color rojo, marca Samsung..." : "E.g.: Red color, Samsung brand..."}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="h-10 text-sm"
                    data-testid="input-new-item-name"
                  />
                </div>
                <div className="flex items-center gap-2 pt-2 border-t">
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={() => setShowAddForm(false)}
                  >
                    {isSpanish ? "Cancelar" : "Cancel"}
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={addNewItem}
                    disabled={!newItemCategory}
                    data-testid="btn-confirm-add-item"
                  >
                    <PlusCircle className="w-4 h-4 mr-2" />
                    {isSpanish ? "Agregar" : "Add"}
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        )}

        <Tabs defaultValue="room" className="w-full h-full flex flex-col">
          <TabsList className="w-full grid grid-cols-2 mb-3">
            <TabsTrigger value="room" className="text-sm">
              <Home className="w-4 h-4 mr-2" /> {isSpanish ? "Por Habitación" : "By Room"}
            </TabsTrigger>
            <TabsTrigger value="type" className="text-sm">
              <Layers className="w-4 h-4 mr-2" /> {isSpanish ? "Por Tipo" : "By Type"}
            </TabsTrigger>
          </TabsList>

          <ScrollArea className="flex-1 pr-4" style={{ height: showAddForm ? '200px' : '400px' }}>
            <TabsContent value="room" className="mt-0 space-y-4">
                {unassignedItems.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-amber-500" />
                      <h4 className="text-sm font-semibold text-amber-600 uppercase tracking-wider">
                        {isSpanish ? "Sin Asignar" : "Unassigned"}
                      </h4>
                      <Badge variant="outline" className="ml-auto text-xs bg-amber-50 text-amber-600 border-amber-200">
                        {unassignedItems.length}
                      </Badge>
                    </div>
                    <div className="bg-amber-50/50 rounded-lg border border-amber-100 divide-y divide-amber-100">
                      {unassignedItems.map((item) => renderItemWithRoomSelector(item, false))}
                    </div>
                  </div>
                )}
                
                {sortedRoomEntries.map(([room, roomItems]) => (
                  <div 
                    key={room} 
                    className="space-y-2"
                  >
                    <div className="flex items-center gap-2">
                      <Home className="w-4 h-4 text-slate-400" />
                      <h4 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">
                        {getRoomLabel(room)}
                      </h4>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {roomItems.length}
                      </Badge>
                    </div>
                    <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                      {roomItems.map((item) => renderItemWithRoomSelector(item, false))}
                    </div>
                  </div>
                ))}
              {items.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {isSpanish 
                    ? "Aún no hay artículos. ¡Empieza a chatear con Clara!" 
                    : "No items added yet. Start chatting with Clara!"}
                </div>
              )}
            </TabsContent>

            <TabsContent value="type" className="mt-0 space-y-4">
                {sortedCategoryEntries.map(([category, catItems]) => {
                  const IconComponent = getCategoryIcon(category);
                  const colorClass = getCategoryColor(category);
                  const categoryTotal = catItems.reduce((sum, item) => sum + item.quantity, 0);
                  
                  return (
                    <div 
                      key={category} 
                      className="space-y-2"
                    >
                      <div className="flex items-center gap-2">
                        <IconComponent className={`w-4 h-4 ${colorClass}`} />
                        <h4 className="text-sm font-semibold text-slate-600">
                          {getCategoryLabel(category)}
                        </h4>
                        <Badge variant="outline" className="ml-auto text-xs">
                          {categoryTotal}
                        </Badge>
                      </div>
                      <div className="bg-white rounded-lg border border-slate-100 divide-y divide-slate-50">
                        {catItems.map((item) => (
                          <div 
                            key={item.id} 
                            className="p-3 flex justify-between items-center text-sm"
                          >
                            <div className="flex flex-col">
                              <span className="font-medium text-slate-700">{item.name}</span>
                              <span className="text-xs text-slate-400">{getRoomLabel(item.room)}</span>
                            </div>
                            {renderItemControls(item)}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              {items.length === 0 && (
                <div className="text-center py-12 text-slate-400 text-sm">
                  {isSpanish 
                    ? "Aún no hay artículos. ¡Empieza a chatear con Clara!" 
                    : "No items added yet. Start chatting with Clara!"}
                </div>
              )}
            </TabsContent>
          </ScrollArea>
        </Tabs>
      </CardContent>
    </Card>
  );
}
