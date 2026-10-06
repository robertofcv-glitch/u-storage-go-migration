import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MapPin, Loader2, CheckCircle2, Building2, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import {
  isBranchBrowseQuery,
  parsePlaceLocation,
  sortByDistance,
  type AddressLocation,
} from "@/lib/addressAutocomplete";

const DEFAULT_COUNTRIES = ["mx", "co", "ar", "cl", "pe", "ec", "ve", "gt", "cr", "pa"];

export interface AddressSuggestion {
  placeId: string;
  description: string;
  mainText: string;
  secondaryText: string;
  lat?: number;
  lng?: number;
}

export interface UStorageBranch {
  id: string;
  brand: string;
  name: string;
  region?: string | null;
  address: string;
  lat: number | string;
  lng: number | string;
  googlePlaceId: string;
  mapsUrl?: string;
  distanceKm?: number;
}

interface AddressAutocompleteProps {
  value: string;
  onChange: (value: string, placeId?: string) => void;
  onSelect?: (suggestion: AddressSuggestion) => void;
  onLocationSelect?: (location: AddressLocation | null) => void;
  onBranchSelect?: (branch: UStorageBranch) => void;
  onClearSelection?: () => void;
  selectedBranch?: UStorageBranch | null;
  nearbyLocation?: { lat: number; lng: number } | null;
  allowBranchSelection?: boolean;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  countries?: string[];
  "data-testid"?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  onSelect,
  onLocationSelect,
  onBranchSelect,
  onClearSelection,
  selectedBranch,
  nearbyLocation,
  allowBranchSelection = true,
  placeholder = "Ingresa una dirección...",
  className,
  disabled = false,
  countries = DEFAULT_COUNTRIES,
  "data-testid": testId,
}: AddressAutocompleteProps) {
  const { i18n } = useTranslation();
  const isSpanish = i18n.language === "es";
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);
  const [branches, setBranches] = useState<UStorageBranch[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [branchSearchFailed, setBranchSearchFailed] = useState(false);
  const [addressSearchFailed, setAddressSearchFailed] = useState(false);
  const [locationSearchFailed, setLocationSearchFailed] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const sessionTokenRef = useRef<string>(crypto.randomUUID());
  const requestIdRef = useRef(0);
  const locationRequestIdRef = useRef(0);

  const fetchSuggestions = useCallback(async (input: string) => {
    const trimmedInput = input.trim();
    const browsingBranches = isBranchBrowseQuery(trimmedInput);
    const browsingNearby = Boolean(nearbyLocation && !trimmedInput);
    if (trimmedInput.length < 3 && !browsingBranches && !browsingNearby) {
      requestIdRef.current++;
      setSuggestions([]);
      setBranches([]);
      setShowSuggestions(false);
      setHasSearched(false);
      return;
    }

    const requestId = ++requestIdRef.current;
    setIsLoading(true);
    setBranchSearchFailed(false);
    setAddressSearchFailed(false);
    setHasSearched(false);
    try {
      const params = new URLSearchParams({
        input: trimmedInput,
        sessionToken: sessionTokenRef.current,
        countries: countries.join(","),
      });
      const branchQuery = browsingBranches || browsingNearby ? "" : trimmedInput;
      const [addressResult, branchResult] = await Promise.allSettled([
        browsingBranches || browsingNearby
          ? Promise.resolve(null)
          : fetch(`/api/places/autocomplete?${params}`, { credentials: "include" }),
        allowBranchSelection
          ? fetch(
            `/api/ustorage/branches${branchQuery ? `?q=${encodeURIComponent(branchQuery)}` : ""}`,
            { credentials: "include" },
          )
          : Promise.resolve(null),
      ]);
      if (requestId !== requestIdRef.current) return;

      const addressResponse = addressResult.status === "fulfilled" ? addressResult.value : null;
      const branchResponse = branchResult.status === "fulfilled" ? branchResult.value : null;
      const addressFailed = addressResult.status === "rejected" || Boolean(addressResponse && !addressResponse.ok);
      const branchFailed = branchResult.status === "rejected" || Boolean(branchResponse && !branchResponse.ok);
      const nextSuggestions = addressResponse?.ok
        ? (await addressResponse.json()).suggestions || []
        : [];
      const nextBranches: UStorageBranch[] = branchResponse?.ok
        ? sortByDistance<UStorageBranch>((await branchResponse.json()).branches || [], nearbyLocation)
        : [];
      if (requestId !== requestIdRef.current) return;

      setAddressSearchFailed(addressFailed);
      setBranchSearchFailed(branchFailed);
      setSuggestions(nextSuggestions);
      setBranches(nextBranches);
      setShowSuggestions(true);
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      console.error("Error fetching address suggestions:", error);
      setAddressSearchFailed(true);
      setBranchSearchFailed(allowBranchSelection);
      setSuggestions([]);
      setBranches([]);
      setShowSuggestions(true);
    } finally {
      if (requestId !== requestIdRef.current) return;
      setHasSearched(true);
      setIsLoading(false);
    }
  }, [allowBranchSelection, countries, nearbyLocation]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    requestIdRef.current++;
    locationRequestIdRef.current++;
    setIsLoading(false);
    setLocationSearchFailed(false);
    setSuggestions([]);
    setBranches([]);
    setShowSuggestions(false);
    onChange(newValue);
    onLocationSelect?.(null);
    if (selectedBranch) onClearSelection?.();
    setSelectedIndex(-1);

    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      fetchSuggestions(newValue);
    }, 300);
  };

  const handleSuggestionClick = async (suggestion: AddressSuggestion) => {
    requestIdRef.current++;
    setIsLoading(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChange(suggestion.description, suggestion.placeId);
    setSuggestions([]);
    setShowSuggestions(false);
    sessionTokenRef.current = crypto.randomUUID();
    onSelect?.(suggestion);
    if (!onLocationSelect) return;

    const locationRequestId = ++locationRequestIdRef.current;
    setLocationSearchFailed(false);
    try {
      const response = await fetch(`/api/places/details/${encodeURIComponent(suggestion.placeId)}`, {
        credentials: "include",
      });
      if (!response.ok) throw new Error("Place details unavailable");
      const location = parsePlaceLocation(await response.json());
      if (!location) throw new Error("Place coordinates unavailable");
      if (locationRequestId === locationRequestIdRef.current) onLocationSelect(location);
    } catch (error) {
      if (locationRequestId !== locationRequestIdRef.current) return;
      console.error("Unable to locate the selected address:", error);
      setLocationSearchFailed(true);
      onLocationSelect(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || (suggestions.length === 0 && branches.length === 0)) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedIndex((prev) => 
          prev < suggestions.length + branches.length - 1 ? prev + 1 : prev
        );
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : -1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedIndex >= 0 && selectedIndex < branches.length) {
          handleBranchClick(branches[selectedIndex]);
        } else if (selectedIndex >= branches.length) {
          handleSuggestionClick(suggestions[selectedIndex - branches.length]);
        }
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedIndex(-1);
        break;
    }
  };

  const handleBranchClick = (branch: UStorageBranch) => {
    requestIdRef.current++;
    locationRequestIdRef.current++;
    setIsLoading(false);
    setLocationSearchFailed(false);
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }
    onChange(branch.address, branch.googlePlaceId);
    onLocationSelect?.(null);
    setBranches([]);
    setSuggestions([]);
    setShowSuggestions(false);
    onBranchSelect?.(branch);
  };

  const handleClearSelection = () => {
    requestIdRef.current++;
    locationRequestIdRef.current++;
    setLocationSearchFailed(false);
    onLocationSelect?.(null);
    onClearSelection?.();
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (!nearbyLocation || value.trim() || !allowBranchSelection || selectedBranch) return;
    fetchSuggestions("");
  }, [allowBranchSelection, fetchSuggestions, nearbyLocation, selectedBranch, value]);

  useEffect(() => {
    return () => {
      requestIdRef.current++;
      locationRequestIdRef.current++;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          onFocus={() => {
            if (nearbyLocation && !value.trim() && branches.length === 0) fetchSuggestions("");
            if (suggestions.length > 0 || branches.length > 0) setShowSuggestions(true);
          }}
          placeholder={placeholder}
          disabled={disabled}
          className={cn("pl-9 pr-9", className)}
          data-testid={testId}
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>

      <AnimatePresence>
        {showSuggestions && (suggestions.length > 0 || branches.length > 0) && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute z-50 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-auto"
          >
            {branches.map((branch, index) => (
              <button
                key={branch.id}
                type="button"
                onClick={() => handleBranchClick(branch)}
                className={cn("w-full px-3 py-3 text-left flex items-start gap-2 hover:bg-[#F4EFF7] transition-colors", index === selectedIndex && "bg-[#F4EFF7]")}
                data-testid={`branch-suggestion-${branch.id}`}
              >
                <Building2 className="h-4 w-4 mt-0.5 flex-shrink-0 text-[#FF6C00]" />
                 <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wide text-[#FF6C00]">
                    {branch.brand} · {isSpanish ? "Sucursal oficial" : "Official branch"}
                  </div>
                  <div className="font-semibold text-sm truncate">{branch.name}</div>
                  <div className="text-xs text-muted-foreground">{branch.address}{branch.region ? ` · ${branch.region}` : ""}</div>
                </div>
                 {branch.distanceKm != null && (
                   <span className="ml-auto shrink-0 rounded-full bg-[#F4EFF7] px-2 py-1 text-xs font-bold text-[#502864]">
                     {branch.distanceKm < 10 ? branch.distanceKm.toFixed(1) : Math.round(branch.distanceKm)} km
                   </span>
                 )}
                <CheckCircle2 className="ml-auto h-4 w-4 text-[#1E6B50] flex-shrink-0" />
              </button>
            ))}
            {suggestions.map((suggestion, index) => (
              <button
                key={suggestion.placeId}
                type="button"
                onClick={() => handleSuggestionClick(suggestion)}
                className={cn(
                  "w-full px-3 py-2 text-left flex items-start gap-2 hover:bg-accent transition-colors",
                  index + branches.length === selectedIndex && "bg-accent"
                )}
                data-testid={`suggestion-${suggestion.placeId}`}
              >
                <MapPin className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate">
                    {suggestion.mainText}
                  </div>
                  <div className="text-xs text-muted-foreground truncate">
                    {suggestion.secondaryText}
                  </div>
                </div>
              </button>
            ))}
            {suggestions.length > 0 && (
              <div className="px-3 py-1.5 text-[10px] text-muted-foreground border-t flex items-center justify-end gap-1 bg-muted/30">
                <img
                  src="https://developers.google.com/static/maps/documentation/images/powered_by_google_on_white.png"
                  alt="Powered by Google"
                  className="h-3"
                />
              </div>
            )}
            {branchSearchFailed && suggestions.length > 0 && (
              <div className="border-t bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {isSpanish
                  ? "No pudimos cargar las sucursales oficiales, pero puedes elegir una dirección."
                  : "Official branches could not be loaded, but you can still choose an address."}
              </div>
            )}
            {addressSearchFailed && branches.length > 0 && (
              <div className="border-t bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {isSpanish
                  ? "No pudimos cargar otras direcciones, pero puedes elegir una sucursal oficial."
                  : "Other addresses could not be loaded, but you can still choose an official branch."}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      {!isLoading && hasSearched && showSuggestions && branches.length === 0 && suggestions.length === 0 && (
        <div className="absolute z-40 mt-1 w-full rounded-md border bg-background px-3 py-3 text-sm text-muted-foreground shadow-lg">
          {branchSearchFailed && addressSearchFailed
            ? (isSpanish
              ? "Las ubicaciones no están disponibles temporalmente. Intenta de nuevo."
              : "Locations are temporarily unavailable. Try again.")
            : branchSearchFailed
              ? (isSpanish
                ? "El catálogo de sucursales no está disponible temporalmente. Intenta de nuevo."
                : "The branch catalog is temporarily unavailable. Try again.")
              : addressSearchFailed
                ? (isSpanish
                  ? "La búsqueda de direcciones no está disponible temporalmente. Intenta de nuevo."
                  : "Address search is temporarily unavailable. Try again.")
            : (isSpanish
              ? "No encontramos sucursales oficiales ni direcciones."
              : "No official branches or addresses found.")}
        </div>
      )}
      {selectedBranch && (
        <div className="mt-2 flex items-start gap-2 rounded-lg border border-[#1E6B50]/30 bg-[#1E6B50]/5 px-3 py-2 text-sm">
          <CheckCircle2 className="mt-0.5 h-4 w-4 text-[#1E6B50]" />
          <span className="min-w-0 flex-1"><strong>{selectedBranch.brand}</strong> · {selectedBranch.name}<span className="block text-xs text-muted-foreground">{selectedBranch.address}</span></span>
          <button
            type="button"
            aria-label={isSpanish ? "Quitar sucursal seleccionada" : "Clear selected branch"}
            onClick={handleClearSelection}
            className="rounded p-1 hover:bg-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
      {locationSearchFailed && !selectedBranch && (
        <p className="mt-2 text-xs text-amber-700" role="status">
          {isSpanish
            ? "No pudimos ubicar esta dirección para ordenar sucursales cercanas. Busca una sucursal por nombre."
            : "We couldn't locate this address to sort nearby branches. Search for a branch by name."}
        </p>
      )}
    </div>
  );
}
