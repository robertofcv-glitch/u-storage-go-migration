import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  Sofa, BedDouble, Utensils, Tv, Refrigerator, Package, 
  Armchair, Lamp, Table, Monitor, Dumbbell, Baby, Box,
  Plus, Minus, ChevronLeft, ChevronRight, AlertCircle, Trash2,
  Wine, Trees, Microwave, BedSingle, MoreHorizontal, Home,
  UtensilsCrossed, Briefcase, Bike, Bath, Shirt
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface InventoryItem {
  id: string;
  name: string;
  room: string;
  category: string;
  quantity: number;
}

interface VisualInventoryPickerProps {
  items: InventoryItem[];
  onItemsChange: (items: InventoryItem[]) => void;
}

interface InventoryCategory {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  icon: string;
  sortOrder: number;
  isActive: boolean;
  avgWeightKg: string | null;
}

interface InventoryRoom {
  id: string;
  key: string;
  labelEs: string;
  labelEn: string;
  sortOrder: number;
  isActive: boolean;
}

interface CatalogItem {
  key: string;
  nameEn: string;
  nameEs: string;
  roomKey: string;
  categoryKey: string;
}

const ICON_MAP: Record<string, React.ComponentType<any>> = {
  sofa: Sofa,
  armchair: Armchair,
  "bed-double": BedDouble,
  "bed-single": BedSingle,
  utensils: Utensils,
  table: Table,
  tv: Tv,
  refrigerator: Refrigerator,
  microwave: Microwave,
  box: Box,
  package: Package,
  wine: Wine,
  "tree-deciduous": Trees,
  dumbbell: Dumbbell,
  baby: Baby,
  "more-horizontal": MoreHorizontal,
  lamp: Lamp,
  monitor: Monitor,
};

const ROOM_ICON_MAP: Record<string, React.ComponentType<any>> = {
  sala: Sofa,
  comedor: UtensilsCrossed,
  cocina: Utensils,
  bedrooms: BedDouble,
  bedroom_1: BedDouble,
  bedroom_2: BedDouble,
  bedroom_3: BedDouble,
  bedroom_4: BedDouble,
  bedroom_5: BedDouble,
  bedroom_6: BedDouble,
  bano: Bath,
  estudio: Briefcase,
  garage: Bike,
  patio: Trees,
  lavanderia: Shirt,
  bodega: Package,
  general: Home,
  sin_habitacion: Home,
};

const normalizeRoomKey = (roomKey: string): string => {
  return roomKey;
};

export function VisualInventoryPicker({ items, onItemsChange }: VisualInventoryPickerProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: categories = [], isLoading: loadingCategories } = useQuery<InventoryCategory[]>({
    queryKey: ["/api/inventory-categories"],
    queryFn: async () => {
      const res = await fetch("/api/inventory-categories");
      if (!res.ok) throw new Error("Failed to load categories");
      return res.json();
    },
  });

  const { data: rooms = [], isLoading: loadingRooms } = useQuery<InventoryRoom[]>({
    queryKey: ["/api/inventory-rooms"],
    queryFn: async () => {
      const res = await fetch("/api/inventory-rooms");
      if (!res.ok) throw new Error("Failed to load rooms");
      return res.json();
    },
  });

  const { data: catalogItems = [], isLoading: loadingCatalog } = useQuery<CatalogItem[]>({
    queryKey: ["/api/inventory-catalog"],
    queryFn: async () => {
      const res = await fetch("/api/inventory-catalog");
      if (!res.ok) throw new Error("Failed to load catalog");
      return res.json();
    },
  });

  const activeCategories = categories.filter(c => c.isActive);
  const activeCategoryKeys = new Set(activeCategories.map(c => c.key));
  const activeRooms = rooms.filter(r => r.isActive);

  // Build room -> category mapping from catalog items
  const roomToCategoriesMap = new Map<string, Set<string>>();
  catalogItems.forEach(item => {
    if (!activeCategoryKeys.has(item.categoryKey)) return;
    
    const roomKey = normalizeRoomKey(item.roomKey);
    
    if (!roomToCategoriesMap.has(roomKey)) {
      roomToCategoriesMap.set(roomKey, new Set());
    }
    roomToCategoriesMap.get(roomKey)!.add(item.categoryKey);
  });

  // Also add categories from actual items (e.g., CSV imports may have different category/room combos)
  items.forEach(item => {
    if (!activeCategoryKeys.has(item.category)) return;
    
    const roomKey = normalizeRoomKey(item.room);
    
    if (!roomToCategoriesMap.has(roomKey)) {
      roomToCategoriesMap.set(roomKey, new Set());
    }
    roomToCategoriesMap.get(roomKey)!.add(item.category);
  });

  const consolidatedRooms = activeRooms.map(room => ({
    key: room.key,
    labelEs: room.labelEs,
    labelEn: room.labelEn,
    originalRoomKeys: [room.key],
  }));

  const categoriesInRooms = new Set<string>();
  roomToCategoriesMap.forEach(cats => cats.forEach(c => categoriesInRooms.add(c)));
  const orphanedCategories = activeCategories.filter(c => !categoriesInRooms.has(c.key));
  
  if (orphanedCategories.length > 0) {
    consolidatedRooms.push({
      key: "general",
      labelEs: "General",
      labelEn: "General",
      originalRoomKeys: ["general"],
    });
    roomToCategoriesMap.set("general", new Set(orphanedCategories.map(c => c.key)));
  }

  if (!roomToCategoriesMap.has("sin_habitacion")) {
    roomToCategoriesMap.set("sin_habitacion", new Set(activeCategories.map(c => c.key)));
  }

  const ALL_TAB_KEY = "__all__";
  if (!activeTab) {
    setActiveTab(ALL_TAB_KEY);
  }

  const totalItemsCount = items.reduce((sum, item) => sum + item.quantity, 0);

  const getCategoryIcon = (category: InventoryCategory) => {
    const IconComponent = ICON_MAP[category.icon] || Box;
    return IconComponent;
  };

  const getRoomIcon = (roomKey: string) => {
    return ROOM_ICON_MAP[roomKey] || Home;
  };

  const getCategoriesForRoom = (roomKey: string): InventoryCategory[] => {
    const categoryKeys = roomToCategoriesMap.get(roomKey) || new Set();
    return activeCategories
      .filter(c => categoryKeys.has(c.key))
      .sort((a, b) => a.sortOrder - b.sortOrder);
  };

  // Get quantity for a specific category in a specific room (sum all matching entries)
  const getCategoryQuantityInRoom = (categoryKey: string, roomKey: string) => {
    const normalizedRoom = normalizeRoomKey(roomKey);
    return items
      .filter(i => i.category === categoryKey && normalizeRoomKey(i.room) === normalizedRoom)
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Get total item count for a room (only count categories that have cards in this room)
  const getRoomItemCount = (roomKey: string) => {
    const normalizedRoom = normalizeRoomKey(roomKey);
    // For sin_habitacion, count all items with that room (it's a catch-all)
    if (roomKey === "sin_habitacion") {
      return items
        .filter(i => i.room === "sin_habitacion")
        .reduce((sum, i) => sum + i.quantity, 0);
    }
    const categoryKeysInRoom = roomToCategoriesMap.get(roomKey) || new Set();
    return items
      .filter(i => normalizeRoomKey(i.room) === normalizedRoom && categoryKeysInRoom.has(i.category))
      .reduce((sum, i) => sum + i.quantity, 0);
  };

  // Update quantity for a category in a specific room
  const updateCategoryQuantityInRoom = (category: InventoryCategory, delta: number, roomKey: string) => {
    const normalizedRoom = normalizeRoomKey(roomKey);
    const displayName = isSpanish ? category.labelEs : category.labelEn;
    
    // Find ALL existing items matching both category AND room
    const matchingIndices = items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => item.category === category.key && normalizeRoomKey(item.room) === normalizedRoom);
    
    if (matchingIndices.length > 0) {
      // Sum all current quantities and consolidate into first entry
      const totalCurrentQuantity = matchingIndices.reduce((sum, { item }) => sum + item.quantity, 0);
      const newQuantity = Math.max(0, totalCurrentQuantity + delta);
      
      if (newQuantity === 0) {
        // Remove all matching entries
        const indicesToRemove = new Set(matchingIndices.map(({ idx }) => idx));
        const newItems = items.filter((_, idx) => !indicesToRemove.has(idx));
        onItemsChange(newItems);
      } else {
        // Keep first entry with new quantity, remove duplicates
        const firstIndex = matchingIndices[0].idx;
        const duplicateIndices = new Set(matchingIndices.slice(1).map(({ idx }) => idx));
        
        const newItems = items
          .filter((_, idx) => !duplicateIndices.has(idx))
          .map((item, idx) => {
            // Adjust for removed indices
            const originalIdx = items.indexOf(item);
            if (originalIdx === firstIndex) {
              return { ...item, quantity: newQuantity, name: displayName };
            }
            return item;
          });
        onItemsChange(newItems);
      }
    } else if (delta > 0) {
      // Create new item with both category and room
      const newItem: InventoryItem = {
        id: `${normalizedRoom}-${category.key}-${Date.now()}`,
        name: displayName,
        room: normalizedRoom,
        category: category.key,
        quantity: delta,
      };
      onItemsChange([...items, newItem]);
    }
  };

  const removeItem = (itemId: string) => {
    onItemsChange(items.filter(i => i.id !== itemId));
  };

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const scrollAmount = 300;
      scrollRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  // Get room label for display
  const getRoomLabel = (roomKey: string): string => {
    const room = consolidatedRooms.find(r => r.key === roomKey);
    if (room) {
      return isSpanish ? room.labelEs : room.labelEn;
    }
    // Fallback for any room key
    const originalRoom = rooms.find(r => r.key === roomKey);
    if (originalRoom) {
      return isSpanish ? originalRoom.labelEs : originalRoom.labelEn;
    }
    return roomKey;
  };

  const isLoading = loadingCategories || loadingRooms || loadingCatalog;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <div className="flex gap-2">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-10 w-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (consolidatedRooms.length === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <AlertCircle className="w-12 h-12 mx-auto mb-2 text-slate-400" />
        <p>{isSpanish ? "No hay habitaciones configuradas" : "No rooms configured"}</p>
      </div>
    );
  }

  const isAllTab = activeTab === ALL_TAB_KEY;
  const currentCategories = activeTab && !isAllTab ? getCategoriesForRoom(activeTab) : [];

  const filteredItems = activeTab && !isAllTab
    ? items.filter(item => normalizeRoomKey(item.room) === normalizeRoomKey(activeTab))
    : items;
  const filteredItemsCount = filteredItems.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-[#24152E]">
            {isSpanish ? "Selecciona tus artículos" : "Select your items"}
          </h3>
          <p className="text-sm text-slate-500">
            {isSpanish 
              ? "Haz clic en + para agregar artículos a tu inventario" 
              : "Click + to add items to your inventory"}
          </p>
        </div>
        <Badge className="bg-[#FF6C00] text-[#24152E] px-3 py-1.5 text-sm">
          {totalItemsCount} {isSpanish ? "artículos" : "items"}
        </Badge>
      </div>

      {/* Room Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-hide">
        <button
          type="button"
          onClick={() => setActiveTab(ALL_TAB_KEY)}
           className={`flex min-h-12 items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
            isAllTab 
              ? "bg-[#4E2069] text-[#FBF9F6] shadow-md"
              : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
          }`}
          data-testid="tab-room-all"
        >
          <Package className="w-4 h-4" />
          <span className="font-medium">{isSpanish ? "Lista Completa" : "Full List"}</span>
          {totalItemsCount > 0 && (
            <Badge 
              variant="secondary" 
              className={`ml-1 ${isAllTab ? "bg-white/20 text-[#FBF9F6]" : "bg-[#FF6C00] text-[#24152E]"}`}
            >
              {totalItemsCount}
            </Badge>
          )}
        </button>
        {consolidatedRooms.map((room) => {
          const RoomIcon = getRoomIcon(room.key);
          const count = getRoomItemCount(room.key);
          const isActive = activeTab === room.key;
          
          return (
            <button
              type="button"
              key={room.key}
              onClick={() => setActiveTab(room.key)}
               className={`flex min-h-12 items-center gap-2 px-4 py-2 rounded-full whitespace-nowrap transition-all ${
                isActive 
                  ? "bg-[#4E2069] text-[#FBF9F6] shadow-md"
                  : "bg-white text-slate-600 hover:bg-slate-100 border border-slate-200"
              }`}
              data-testid={`tab-room-${room.key}`}
            >
              <RoomIcon className="w-4 h-4" />
              <span className="font-medium">{isSpanish ? room.labelEs : room.labelEn}</span>
              {count > 0 && (
                <Badge 
                  variant="secondary" 
                  className={`ml-1 ${isActive ? "bg-white/20 text-[#FBF9F6]" : "bg-[#FF6C00] text-[#24152E]"}`}
                >
                  {count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* Category Cards - only show when a specific room is selected */}
      {activeTab && !isAllTab ? (<div className="relative">
        <Button
          type="button"
          variant="outline"
          size="icon"
           className="absolute left-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full h-12 w-12 -ml-2"
          onClick={() => scroll('left')}
          data-testid="scroll-left"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        
        <div 
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto scrollbar-hide px-8 py-2"
          style={{ scrollSnapType: 'x mandatory' }}
        >
          <AnimatePresence mode="popLayout">
            {currentCategories.map((category) => {
              const quantity = activeTab ? getCategoryQuantityInRoom(category.key, activeTab) : 0;
              const CategoryIcon = getCategoryIcon(category);
              
              return (
                <motion.div
                  key={`${activeTab}-${category.key}`}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="flex-shrink-0 w-40"
                  style={{ scrollSnapAlign: 'start' }}
                >
                  <div 
                    className={`bg-white rounded-xl border-2 p-4 flex flex-col items-center transition-all h-full ${
                      quantity > 0 
                        ? "border-[#FF6C00] shadow-md"
                        : "border-slate-200 hover:border-slate-300"
                    }`}
                    data-testid={`category-card-${category.key}`}
                  >
                    <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-2 ${
                      quantity > 0 ? "bg-[#FFF1E6]" : "bg-[#F4EFF7]"
                    }`}>
                      <CategoryIcon className={`w-7 h-7 ${quantity > 0 ? "text-[#FF6C00]" : "text-[#6D6075]"}`} />
                    </div>
                    
                    <span className="text-sm font-medium text-center text-slate-700 mb-3 h-12 flex items-center line-clamp-2">
                      {isSpanish ? category.labelEs : category.labelEn}
                    </span>
                    
                    <div className="flex items-center gap-2 mt-auto">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                         className="h-12 w-12 rounded-full"
                        onClick={() => activeTab && updateCategoryQuantityInRoom(category, -1, activeTab)}
                        disabled={quantity === 0}
                        data-testid={`btn-minus-${category.key}`}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      
                      <span className={`w-8 text-center font-semibold text-lg ${
                        quantity > 0 ? "text-[#4E2069]" : "text-[#6D6075]"
                      }`}>
                        {quantity}
                      </span>
                      
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                         className="h-12 w-12 rounded-full border-[#FF6C00] text-[#24152E] hover:bg-[#FF6C00] hover:text-[#24152E]"
                        onClick={() => activeTab && updateCategoryQuantityInRoom(category, 1, activeTab)}
                        data-testid={`btn-plus-${category.key}`}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {currentCategories.length === 0 && (
            <div className="flex-1 text-center py-8 text-slate-500 w-full">
              <Package className="w-12 h-12 mx-auto mb-2 text-slate-300" />
              <p>{isSpanish ? "No hay artículos en esta habitación" : "No items in this room"}</p>
            </div>
          )}
        </div>

        <Button
          type="button"
          variant="outline"
          size="icon"
           className="absolute right-0 top-1/2 -translate-y-1/2 z-10 bg-white shadow-lg rounded-full h-12 w-12 -mr-2"
          onClick={() => scroll('right')}
          data-testid="scroll-right"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>) : null}

      {/* Inventory Summary with +/- controls */}
      {items.length > 0 && (
        <div className="mt-4 p-4 bg-[#FFF1E6] rounded-xl border border-[#FF6C00]/20">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-[#24152E]">
              {isAllTab 
                ? (isSpanish ? "Tu inventario" : "Your inventory")
                : getRoomLabel(activeTab!)
              }
            </h4>
            <span className="text-sm text-slate-500">
              {filteredItems.length} {isSpanish ? "tipos" : "types"} · {filteredItemsCount} {isSpanish ? "artículos" : "items"}
              {!isAllTab && filteredItems.length < items.length && (
                <span className="text-slate-400 ml-1">
                  / {totalItemsCount} {isSpanish ? "total" : "total"}
                </span>
              )}
            </span>
          </div>
          <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
            {filteredItems.length === 0 && !isAllTab ? (
              <div className="text-center py-4 text-slate-400 text-sm">
                {isSpanish 
                  ? "No hay artículos en esta habitación. Usa los botones + arriba para agregar." 
                  : "No items in this room. Use the + buttons above to add."}
              </div>
            ) : null}
            {filteredItems.map((item) => {
              const category = categories.find(c => c.key === item.category);
              const categoryName = category 
                ? (isSpanish ? category.labelEs : category.labelEn)
                : item.name;
              const roomLabel = getRoomLabel(item.room);
              
              return (
                <div 
                  key={item.id}
                  className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-slate-200 group hover:border-slate-300 transition-colors"
                  data-testid={`inventory-item-${item.id}`}
                >
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="text-sm text-slate-700 truncate">{categoryName}</span>
                    <span className="text-xs text-slate-400">{roomLabel}</span>
                  </div>
                  <div className="flex items-center gap-1 ml-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 text-slate-500 hover:text-[#4E2069] hover:bg-slate-100"
                      onClick={() => {
                        if (category) {
                          updateCategoryQuantityInRoom(category, -1, item.room);
                        }
                      }}
                      data-testid={`btn-decrease-${item.id}`}
                    >
                      <Minus className="h-3 w-3" />
                    </Button>
                    <Badge variant="secondary" className="bg-[#FFF1E6] text-[#24152E] min-w-[2rem] justify-center">
                      {item.quantity}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 text-slate-500 hover:text-[#FF6C00] hover:bg-slate-100"
                      onClick={() => {
                        if (category) {
                          updateCategoryQuantityInRoom(category, 1, item.room);
                        }
                      }}
                      data-testid={`btn-increase-${item.id}`}
                    >
                      <Plus className="h-3 w-3" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-12 w-12 text-slate-400 hover:text-red-500 hover:bg-red-50"
                      onClick={() => removeItem(item.id)}
                      data-testid={`btn-remove-${item.id}`}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
