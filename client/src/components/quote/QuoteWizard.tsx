import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { useTranslation } from "react-i18next";
import { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, ArrowRight, MapPin, X, User, Mail, Phone, ExternalLink, Clock, RefreshCw, AlertTriangle } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { AddressAutocomplete, UStorageBranch } from "@/components/ui/address-autocomplete";
import { InventoryChat } from "@/components/quote/InventoryChat";
import { InventorySummary } from "@/components/quote/InventorySummary";
import { VisualInventoryPicker } from "@/components/quote/VisualInventoryPicker";
import { MessageCircle } from "lucide-react";
import { getAttribution } from "@/lib/attribution";
import { UsgIcon } from "@/components/brand/UsgIcon";
import { useStorageServicePolicy } from "@/hooks/useStorageServicePolicy";
import { MoveDatePreferences } from "@/components/quote/MoveDatePreferences";
import {
  firstNonBlockedAvailableDate,
  moveDatePreferencesSchema,
} from "@shared/moveDatePreferences";

const generateSessionId = () => `qs_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

export interface QuoteFormData {
  fromAddress: string;
  toAddress: string;
  date: string;
  availabilityStart: string;
  availabilityEnd: string;
  preferredDates: string[];
  blockedDates: string[];
  homeSize: string;
  storage: string;
  needsInsurance: boolean;
  needsPacking: boolean;
  needsUnpacking: boolean;
  needsBox: boolean;
  clientNotes?: string;
  contactName?: string;
  contactEmail?: string;
  contactPhone?: string;
  name?: string;
  email?: string;
  password?: string;
  partialQuoteId?: string;
  partner?: string;
  fromBranchId?: string | null;
  toBranchId?: string | null;
  storageContractStatus?: 'existing' | 'needs_unit' | null;
  storageRentalIntent?: 'reserve' | 'no_reservation' | null;
  storageSelectedUnitSnapshot?: unknown;
  storageAvailabilityStatus?: string | null;
  storageAvailabilityCheckedAt?: string | null;
  reservationClaim?: string;
  exchangeId?: string;
  reservationProvenance?: string;
  reservationCampaign?: string;
  reservationUnitCode?: string;
  reservationRentalStart?: string;
  reservationUnitSizeM2?: number;
}

export interface ReservationContext {
  destinationBranch?: { id?: string; name?: string; address?: string };
  unit?: { code?: string; name?: string; usableSizeM2?: number; capacityM3?: number };
  rentalStart?: string;
  claim?: string;
  exchangeId?: string;
  provenance?: string;
  campaign?: string;
  confirmed?: boolean;
  contact?: { name?: string; email?: string; phone?: string };
}

export interface PartnerTheme {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  logo?: string;
  headerText?: string;
}

interface QuoteWizardProps {
  skipAccountStep?: boolean;
  onSubmit: (data: QuoteFormData) => void;
  onCancel?: () => void;
  initialFromAddress?: string;
  initialToAddress?: string;
  initialFromBranchId?: string;
  initialToBranchId?: string;
  initialContactName?: string;
  initialContactEmail?: string;
  initialContactPhone?: string;
  partnerTheme?: PartnerTheme;
  onStepChange?: (step: number) => void;
  /** Keeps assisted sales drafts isolated from public quote sessions and endpoints. */
  assistedMode?: boolean;
  assistedSessionId?: string;
  initialDraftData?: any;
  reservationContext?: ReservationContext;
  /** Allows reservation redemption claims to bind to the exact quote session. */
  quoteSessionId?: string;
}

type StepType = 'details' | 'contact' | 'inventory' | 'services' | 'review' | 'account';

export function QuoteWizard({ 
  skipAccountStep = false, 
  onSubmit, 
  onCancel,
  initialFromAddress = "",
  initialToAddress = "",
  initialFromBranchId,
  initialToBranchId,
  initialContactName = "",
  initialContactEmail = "",
  initialContactPhone = "",
  partnerTheme,
  onStepChange,
  assistedMode = false,
  assistedSessionId,
  initialDraftData,
  reservationContext,
  quoteSessionId: providedQuoteSessionId,
}: QuoteWizardProps) {
  const { t, i18n } = useTranslation();
  const [step, setStep] = useState(1);
  const [highestVisitedStep, setHighestVisitedStep] = useState(1);
  const [showStepWarning, setShowStepWarning] = useState<string | null>(null);
  
  const primaryColor = partnerTheme?.primaryColor || "#4E2069";
  const secondaryColor = partnerTheme?.secondaryColor || "#FF6C00";
  
  // Generate a stable session ID that persists across re-renders
  const quoteSessionId = useMemo(() => {
    if (providedQuoteSessionId) return providedQuoteSessionId;
    const storageKey = assistedMode
      ? `ruku_assisted_quote_session_id_${assistedSessionId || "new"}`
      : 'ruku_quote_session_id';
    const existingSessionId = sessionStorage.getItem(storageKey);
    if (existingSessionId) {
      return existingSessionId;
    }
    const newSessionId = generateSessionId();
    sessionStorage.setItem(storageKey, newSessionId);
    return newSessionId;
  }, [assistedMode, assistedSessionId, providedQuoteSessionId]);
  
  // Persist partialQuoteId to sessionStorage to survive component remounts
  const [partialQuoteId, setPartialQuoteIdState] = useState<string | null>(() => {
    if (assistedMode && assistedSessionId) return assistedSessionId;
    const stored = sessionStorage.getItem(`ruku_partial_quote_${quoteSessionId}`);
    return stored || null;
  });
  
  const setPartialQuoteId = (id: string | null) => {
    if (id) {
      sessionStorage.setItem(`ruku_partial_quote_${quoteSessionId}`, id);
    } else {
      sessionStorage.removeItem(`ruku_partial_quote_${quoteSessionId}`);
    }
    setPartialQuoteIdState(id);
  };
  
  const [inventoryItems, setInventoryItems] = useState<Array<{id: string; name: string; room: string; category: string; quantity: number}>>([]);
  const [estimatedCost, setEstimatedCost] = useState<{low: number; high: number; currency: string} | null>(null);
  const [truckRecommendation, setTruckRecommendation] = useState<{
    totalWeightKg: number;
    totalVolumeM3?: number;
    truckUsableVolumeM3?: number;
    totalItemCount?: number;
    recommendedTruck: string;
    truckBreakdown?: Array<{name: string; count: number; capacityKg?: number; capacityM3?: number}>;
    truckCount: number;
    includedMovers: number;
    estimatedHours: number;
    constrainingFactor?: 'weight' | 'volume';
  } | null>(null);
  const isSpanish = i18n.language === "es";

  // U-Storage branch recommendation (services step)
  const [storageRec, setStorageRec] = useState<{
    moveType: 'into_storage' | 'out_of_storage';
    branch: {
      id: string;
      externalId: string;
      brand: string;
      name: string;
      region: string | null;
      address: string;
      googlePlaceId: string;
      lat: string;
      lng: string;
      mapsUrl: string | null;
      url: string | null;
      priceFromMxn: string | null;
    };
    distanceKm: number;
    suggestedTier: { key: string; labelEs: string; labelEn: string; m2: number; volumeM3: number; example: string } | null;
    reservationUrl: string | null;
  } | null>(null);
  const [storageRecLoading, setStorageRecLoading] = useState(false);
  const [storageRecFetchedFor, setStorageRecFetchedFor] = useState<string | null>(null);
  const [storageAvailabilityRetry, setStorageAvailabilityRetry] = useState(0);
  const [storageDecision, setStorageDecision] = useState<'accepted' | 'declined' | null>(null);
  const [storageContractStatus, setStorageContractStatus] = useState<'existing' | 'needs_unit' | null>(null);
  const [selectedStorageOption, setSelectedStorageOption] = useState<any>(null);
  const [storageHandoffLoading, setStorageHandoffLoading] = useState(false);
  const [storageHandoffError, setStorageHandoffError] = useState<string | null>(null);
  const [storageAvailability, setStorageAvailability] = useState<{
    status: 'available' | 'unavailable' | 'wrong_branch' | 'no_availability' | string;
    checkedAt?: string | null;
    options?: any[];
    message?: string;
  } | null>(null);
  const [eligibilitySelection, setEligibilitySelection] = useState<{
    fromBranchId: string | null;
    toBranchId: string | null;
  }>({ fromBranchId: null, toBranchId: null });
  const [selectedBranches, setSelectedBranches] = useState<{ from: UStorageBranch | null; to: UStorageBranch | null }>({ from: null, to: null });
  const [fromLocation, setFromLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [toLocation, setToLocation] = useState<{ lat: number; lng: number } | null>(null);
  const { policy: servicePolicy, state: policyState, retry: retryPolicy } = useStorageServicePolicy();
  const [branchHydrationAttempt, setBranchHydrationAttempt] = useState(0);
  const [persistenceError, setPersistenceError] = useState<{ message: string; retryable: boolean } | null>(null);
  const [addressValidating, setAddressValidating] = useState(false);
  const [addressValidationError, setAddressValidationError] = useState<{
    message?: string;
    nearestName?: string;
    nearestRegion?: string | null;
    nearestDistanceKm?: number;
    retryable?: boolean;
  } | null>(null);

  useEffect(() => {
    if (!initialFromBranchId && !initialToBranchId) return;
    fetch('/api/ustorage/branches', { credentials: 'include' })
      .then((res) => {
        if (!res.ok) throw new Error("branches");
        return res.json();
      })
      .then((data) => {
        const branches = (data.branches || []) as UStorageBranch[];
        const from = initialFromBranchId
          ? branches.find((branch) => branch.id === initialFromBranchId) || null
          : null;
        const to = initialToBranchId
          ? branches.find((branch) => branch.id === initialToBranchId) || null
          : null;
        setSelectedBranches({ from, to });
        setEligibilitySelection({
          fromBranchId: from?.id || null,
          toBranchId: to?.id || null,
        });
        if (from) form.setValue("fromAddress", from.address);
        if (to) form.setValue("toAddress", to.address);
        if ((initialFromBranchId && !from) || (initialToBranchId && !to)) {
          setAddressValidationError({
            message: isSpanish
              ? "Una sucursal seleccionada ya no está disponible. Busca otra sucursal oficial."
              : "A selected branch is no longer available. Search for another official branch.",
            retryable: false,
          });
        }
      })
      .catch(() => setAddressValidationError({
        message: isSpanish
          ? "No pudimos verificar la sucursal seleccionada. Intenta de nuevo."
          : "We couldn't verify the selected branch. Please try again.",
        retryable: true,
      }));
    // Initial query-string selections are hydrated only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchHydrationAttempt]);

  useEffect(() => {
    onStepChange?.(step);
  }, [step, onStepChange]);

  // Fetch the U-Storage branch recommendation when the user reaches the services
  // step. Refetches if the origin/destination addresses changed since last fetch.
  useEffect(() => {
    const stepType = (skipAccountStep
      ? ['details', 'inventory', 'services', 'review']
      : ['details', 'contact', 'inventory', 'services', 'review', 'account'])[step - 1];
    if (stepType !== 'services') return;
    const fromAddress = form.getValues('fromAddress');
    const toAddress = form.getValues('toAddress');
    if (!fromAddress || !toAddress) return;
    const fetchKey = `${fromAddress.trim().toLowerCase()}|${toAddress.trim().toLowerCase()}`;
    if (storageRecFetchedFor === fetchKey) return;
    setStorageRecLoading(true);
    fetch('/api/quotes/storage-recommendation', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        fromAddress,
        toAddress,
        volumeM3: truckRecommendation?.totalVolumeM3,
      }),
    })
      .then(res => {
        if (!res.ok) throw new Error(`Storage recommendation request failed (${res.status})`);
        return res.json();
      })
      .then(async data => {
        // Only cache successful fetches so a transient failure can be retried.
        setStorageRecFetchedFor(fetchKey);
         const recommendation = data?.recommendation || null;
         const availability = recommendation?.availability || data?.availability || null;
        const selectedBranch = selectedBranches.from || selectedBranches.to;
        const rec = !selectedBranch || recommendation?.branch?.id === selectedBranch.id
          ? recommendation
          : null;
        setStorageRec(rec);
         setStorageAvailability(
           rec && rec.moveType === 'into_storage' ? availability : null,
         );
         setSelectedStorageOption(null);
         const defaultContractStatus = rec?.moveType === 'out_of_storage'
           ? 'existing'
           : rec?.moveType === 'into_storage'
             ? 'needs_unit'
             : null;
         setStorageContractStatus(defaultContractStatus);
         if (rec?.moveType === 'into_storage') form.setValue('storage', 'need');
         if (rec?.moveType === 'out_of_storage') form.setValue('storage', 'ustorage');
        // Addresses changed: reset any previous decision and persist the new
        // (or cleared) classification on the quote right away.
        setStorageDecision(null);
        const endpointSelection = {
          fromBranchId: selectedBranches.from?.id || null,
          toBranchId: selectedBranches.to?.id || null,
        };
        setEligibilitySelection(endpointSelection);
        await savePartialQuote(rec ? {
          ...endpointSelection,
          storageBranchDistanceKm: rec.distanceKm,
          storageSizeLabel: rec.suggestedTier ? (isSpanish ? rec.suggestedTier.labelEs : rec.suggestedTier.labelEn) : undefined,
          storageSizeM2: rec.suggestedTier?.m2,
          storageAccepted: null,
            storageContractStatus: defaultContractStatus,
            storageRentalIntent: rec?.moveType === 'into_storage' ? null : 'no_reservation',
           storageAvailabilityStatus: rec?.moveType === 'into_storage' ? availability?.status || null : null,
           storageAvailabilityCheckedAt: rec?.moveType === 'into_storage' ? availability?.checkedAt || null : null,
        } : {
          ...endpointSelection,
          storageBranchDistanceKm: null,
          storageSizeLabel: null,
          storageSizeM2: null,
          storageAccepted: null,
           storageContractStatus: null,
           storageAvailabilityStatus: null,
           storageAvailabilityCheckedAt: null,
           storageSelectedUnitSnapshot: null,
        });
      })
      .catch(err => console.error('Error fetching storage recommendation:', err))
      .finally(() => {
        setStorageRecLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, storageAvailabilityRetry]);

  // Define step order based on user state
  // Logged-in users: Details -> Inventory -> Services -> Review (4 steps)
  // Non-logged users: Details -> Contact -> Inventory -> Services -> Review -> Account (6 steps)
  const stepOrder: StepType[] = skipAccountStep 
    ? ['details', 'inventory', 'services', 'review']
    : ['details', 'contact', 'inventory', 'services', 'review', 'account'];
  
  const totalSteps = stepOrder.length;
  const currentStepType = stepOrder[step - 1];

  const formSchema = z.object({
    fromAddress: z.string().min(5, t('quote.form.validation.minChars', { count: 5 })),
    toAddress: z.string().min(5, t('quote.form.validation.minChars', { count: 5 })),
    date: z.string().default(""),
    availabilityStart: z.string().min(1, t('quote.form.validation.required')),
    availabilityEnd: z.string().min(1, t('quote.form.validation.required')),
    preferredDates: z.array(z.string()),
    blockedDates: z.array(z.string()).default([]),
    homeSize: z.string().min(1, t('quote.form.validation.required')),
    storage: z.enum(["none", "need", "ustorage", "other"]).optional(),
    needsInsurance: z.boolean().default(false),
    needsPacking: z.boolean().default(false),
    needsUnpacking: z.boolean().default(false),
    needsBox: z.boolean().default(false),
    clientNotes: z.string().optional(),
    contactName: z.string().optional(),
    contactEmail: z.string().email(t('quote.form.validation.email')).optional().or(z.literal('')),
    contactPhone: z.string().optional(),
    name: z.string().optional(),
    email: z.string().email(t('quote.form.validation.email')).optional().or(z.literal('')),
    password: z.string().min(8, t('quote.form.validation.minChars', { count: 8 })).optional().or(z.literal('')),
  }).superRefine((values, context) => {
    const result = moveDatePreferencesSchema.safeParse({
      availabilityStart: values.availabilityStart,
      availabilityEnd: values.availabilityEnd,
      preferredDates: values.preferredDates,
      blockedDates: values.blockedDates,
    });
    if (!result.success) {
      context.addIssue({
        code: "custom",
        path: ["preferredDates"],
        message: isSpanish
          ? "El rango debe ser de máximo 14 días y todas las preferencias deben estar dentro del rango."
          : "The range must be at most 14 days and every preference must be within it.",
      });
    }
  });

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromAddress: initialFromAddress,
      toAddress: initialToAddress,
      date: reservationContext?.rentalStart || "",
      availabilityStart: reservationContext?.rentalStart || "",
      availabilityEnd: reservationContext?.rentalStart || "",
      preferredDates: [],
      blockedDates: [],
      homeSize: "medium",
      storage: "none",
      needsInsurance: false,
      needsPacking: false,
      needsUnpacking: false,
      needsBox: false,
      clientNotes: "",
      contactName: initialContactName,
      contactEmail: initialContactEmail,
      contactPhone: initialContactPhone,
      name: initialContactName,
      email: initialContactEmail,
      password: "",
    },
    mode: "onSubmit"
  });

  // Reservation dates are defaults, not locks: the customer can edit them in
  // the normal date step. Keep the exchange claim attached to every save.
  useEffect(() => {
    if (!reservationContext?.rentalStart || initialDraftData) return;
    form.setValue("date", reservationContext.rentalStart);
    form.setValue("availabilityStart", reservationContext.rentalStart);
    form.setValue("availabilityEnd", reservationContext.rentalStart);
    form.setValue("preferredDates", [reservationContext.rentalStart]);
  }, [form, initialDraftData, reservationContext?.rentalStart]);

  useEffect(() => {
    if (!initialDraftData) return;
    form.reset({
      fromAddress: initialDraftData.fromAddress === "Pending" ? "" : initialDraftData.fromAddress || "",
      toAddress: initialDraftData.toAddress === "Pending" ? "" : initialDraftData.toAddress || "",
      date: initialDraftData.moveDate ? String(initialDraftData.moveDate).slice(0, 10) : "",
      availabilityStart: initialDraftData.moveAvailabilityStart || "",
      availabilityEnd: initialDraftData.moveAvailabilityEnd || "",
      preferredDates: initialDraftData.preferredMoveDates || [],
      blockedDates: initialDraftData.blockedMoveDates || [],
      homeSize: initialDraftData.homeSize === "Pending" ? "medium" : initialDraftData.homeSize || "medium",
      storage: initialDraftData.storageOption || "none",
      needsInsurance: Boolean(initialDraftData.needsInsurance),
      needsPacking: Boolean(initialDraftData.needsPacking),
      needsUnpacking: Boolean(initialDraftData.needsUnpacking),
      needsBox: Boolean(initialDraftData.needsBox),
      clientNotes: initialDraftData.clientNotes || "",
      contactName: initialDraftData.contactName || initialContactName,
      contactEmail: initialDraftData.contactEmail || initialContactEmail,
      contactPhone: initialDraftData.contactPhone || initialContactPhone,
      name: initialDraftData.contactName || initialContactName,
      email: initialDraftData.contactEmail || initialContactEmail,
      password: "",
    });
    setInventoryItems((initialDraftData.inventoryItems || []).map((item: any) => ({
      id: item.id,
      name: item.name || item.itemName,
      room: item.room || "unassigned",
      category: item.category || "other",
      quantity: item.quantity || 1,
    })));
    if (initialDraftData.estimatedCost) {
      setEstimatedCost({
        low: Number(initialDraftData.estimatedCost),
        high: Number(initialDraftData.estimatedCostHigh || initialDraftData.estimatedCost),
        currency: initialDraftData.estimatedCurrency || "MXN",
      });
    }
    setEligibilitySelection({
      fromBranchId: initialDraftData.storageMoveType === "out_of_storage" ? initialDraftData.storageBranchId : null,
      toBranchId: initialDraftData.storageMoveType === "into_storage" ? initialDraftData.storageBranchId : null,
    });
    if (initialDraftData.storageBranchId && initialDraftData.storageBranchSnapshot) {
      const branch = { ...initialDraftData.storageBranchSnapshot, id: initialDraftData.storageBranchId };
      setSelectedBranches(initialDraftData.storageMoveType === "out_of_storage"
        ? { from: branch, to: null }
        : { from: null, to: branch });
    }
    setStorageContractStatus(initialDraftData.storageContractStatus || null);
    setSelectedStorageOption(initialDraftData.storageSelectedUnitSnapshot || null);
    setStorageDecision(initialDraftData.storageAccepted === true ? "accepted" : initialDraftData.storageAccepted === false ? "declined" : null);
    if (initialDraftData.storageAvailabilityStatus) {
      setStorageAvailability({
        status: initialDraftData.storageAvailabilityStatus,
        checkedAt: initialDraftData.storageAvailabilityCheckedAt || null,
        options: initialDraftData.storageSelectedUnitSnapshot ? [initialDraftData.storageSelectedUnitSnapshot] : [],
      });
    }
  }, [form, initialContactEmail, initialContactName, initialContactPhone, initialDraftData]);

  // Save all current form data to the database
  const eligibilityMessage = (code?: string, fallback?: string) => {
    const messages: Record<string, { es: string; en: string }> = {
      BRANCH_UNAVAILABLE: {
        es: "La sucursal seleccionada ya no está disponible. Selecciona otra sucursal oficial.",
        en: "The selected branch is no longer available. Select another official branch.",
      },
      BRANCH_NOT_FOUND: {
        es: "Ya no encontramos la sucursal seleccionada. Selecciona otra sucursal oficial.",
        en: "We can no longer find the selected branch. Select another official branch.",
      },
      DIRECTION_DISABLED: {
        es: "Ese sentido de traslado ya no está disponible. Elige una sucursal en el otro extremo.",
        en: "That move direction is no longer available. Choose a branch at the other endpoint.",
      },
      GENERAL_MOVES_DISABLED: {
        es: "Servicios exclusivos hacia y desde bodegas de U-Storage.",
        en: "The move must start or end at an official U-Storage branch.",
      },
      BRANCH_MOVES_DISABLED: {
        es: "Los traslados hacia o desde sucursales no están disponibles temporalmente.",
        en: "Moves to or from branches are temporarily unavailable.",
      },
      ELIGIBILITY_UNAVAILABLE: {
        es: "No pudimos verificar la cobertura. Intenta de nuevo.",
        en: "We couldn't verify coverage. Please try again.",
      },
    };
    const localized = code ? messages[code] : undefined;
    return localized
      ? (isSpanish ? localized.es : localized.en)
      : fallback || (isSpanish
        ? "No pudimos guardar tu cotización. Revisa las ubicaciones e intenta de nuevo."
        : "We couldn't save your quote. Check the locations and try again.");
  };

  const retryAvailability = () => {
    retryPolicy();
    setBranchHydrationAttempt((value) => value + 1);
    setPersistenceError(null);
  };

  const savePartialQuote = async (overrides: Record<string, any> = {}): Promise<boolean> => {
    const values = form.getValues();
    const legacyMoveDate = values.preferredDates[0] || firstNonBlockedAvailableDate(
      values.availabilityStart,
      values.availabilityEnd,
      values.blockedDates,
    );
    const attribution = getAttribution();
    const totalQuantity = inventoryItems.reduce((sum, item) => sum + (item.quantity || 1), 0);
    console.log(`[QuoteWizard] Saving partial quote ${partialQuoteId || 'new'}:`, {
      lineItems: inventoryItems.length,
      totalQuantity,
      step: currentStepType
    });
    try {
      const requestBody = {
          id: partialQuoteId,
          fromAddress: values.fromAddress,
          toAddress: values.toAddress,
          moveDate: legacyMoveDate || values.date,
          moveAvailabilityStart: values.availabilityStart,
          moveAvailabilityEnd: values.availabilityEnd,
          preferredMoveDates: values.preferredDates,
          blockedMoveDates: values.blockedDates,
          homeSize: values.homeSize || "medium",
          contactName: values.contactName || undefined,
          contactEmail: values.contactEmail || undefined,
          contactPhone: values.contactPhone || undefined,
          storageOption: values.storage || "none",
          needsInsurance: values.needsInsurance || false,
          needsPacking: values.needsPacking || false,
          needsUnpacking: values.needsUnpacking || false,
          needsBox: values.needsBox || false,
          clientNotes: values.clientNotes || undefined,
          estimatedCost: estimatedCost ? estimatedCost.low : undefined,
          estimatedCostHigh: estimatedCost ? estimatedCost.high : undefined,
          estimatedCurrency: estimatedCost ? estimatedCost.currency : undefined,
          truckRecommendation: truckRecommendation || undefined,
          inventoryItems: inventoryItems,
          partner: partnerTheme?.id || attribution?.partner || undefined,
          utmSource: attribution?.utmSource || undefined,
          utmMedium: attribution?.utmMedium || undefined,
          utmCampaign: attribution?.utmCampaign || undefined,
          utmTerm: attribution?.utmTerm || undefined,
          utmContent: attribution?.utmContent || undefined,
          landingPage: attribution?.landingPage || undefined,
          referrerUrl: attribution?.referrerUrl || undefined,
          quoteSessionId,
           reservationClaim: reservationContext?.claim,
           exchangeId: reservationContext?.exchangeId || reservationContext?.claim,
           reservationProvenance: reservationContext?.provenance,
           reservationCampaign: reservationContext?.campaign,
           reservationUnitCode: reservationContext?.unit?.code,
           reservationRentalStart: reservationContext?.rentalStart,
           reservationUnitSizeM2: reservationContext?.unit?.usableSizeM2,
           storageSelectedUnitCode: reservationContext?.unit?.code || selectedStorageOption?.code || null,
           storageSelectedUnitSnapshot: reservationContext?.unit
             ? { ...reservationContext.unit, source: reservationContext.confirmed ? "verified_handoff" : "customer_entered" }
             : selectedStorageOption || null,
           storageRentalStart: reservationContext?.rentalStart || null,
           storageSizeM2: reservationContext?.unit?.usableSizeM2 || undefined,
           storageHandoffProvenance: reservationContext?.confirmed ? "ustorage_confirmed" : "manual",
          ...eligibilitySelection,
          ...(storageRec ? {
            storageBranchDistanceKm: storageRec.distanceKm,
            storageSizeLabel: storageRec.suggestedTier ? (isSpanish ? storageRec.suggestedTier.labelEs : storageRec.suggestedTier.labelEn) : undefined,
            storageSizeM2: storageRec.suggestedTier?.m2,
            ...(storageDecision ? { storageAccepted: storageDecision === 'accepted' } : {}),
             storageContractStatus,
             storageAvailabilityStatus: storageAvailability?.status || null,
             storageAvailabilityCheckedAt: storageAvailability?.checkedAt || null,
             storageSelectedUnitSnapshot: selectedStorageOption || null,
             storageSelectedUnitCode: selectedStorageOption?.code || null,
             storageRentalIntent: storageContractStatus === 'needs_unit' ? (selectedStorageOption ? 'reserve' : null) : 'no_reservation',
             storageReservationStatus: selectedStorageOption ? 'not_started' : null,
          } : {}),
          ...overrides,
      };
       const postPartialQuote = async (id: string | null) => {
         const response = await fetch(assistedMode && assistedSessionId
            ? `/api/admin/assisted-quotes/drafts/${assistedSessionId}`
            : assistedMode ? "/api/admin/assisted-quotes/drafts" : "/api/quotes/partial", {
           method: assistedMode && assistedSessionId ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
           body: JSON.stringify({ ...requestBody, id, assistedSessionId: assistedSessionId || undefined }),
        });
        const responseData = await response.json().catch(() => ({}));
        return { response, responseData };
      };
      let { response: res, responseData: data } = await postPartialQuote(partialQuoteId);
      if (res.status === 404 && partialQuoteId && data.message === "Quote not found") {
        console.warn(`[QuoteWizard] Stored partial quote ${partialQuoteId} no longer exists; creating a replacement`);
        setPartialQuoteId(null);
        ({ response: res, responseData: data } = await postPartialQuote(null));
      }
      if (!res.ok) {
        const code = data.code || data.error?.code;
        setPersistenceError({
          message: eligibilityMessage(code, data.message),
          retryable: res.status >= 500 || code === "ELIGIBILITY_UNAVAILABLE",
        });
        if (["BRANCH_UNAVAILABLE", "BRANCH_NOT_FOUND", "DIRECTION_DISABLED", "GENERAL_MOVES_DISABLED", "BRANCH_MOVES_DISABLED"].includes(code)) {
          setSelectedBranches({ from: null, to: null });
          setEligibilitySelection({ fromBranchId: null, toBranchId: null });
          setStep(1);
        }
        return false;
      }
      setPersistenceError(null);
       if (data.quote?.id || data.draft?.id || data.id) {
         setPartialQuoteId(data.quote?.id || data.draft?.id || data.id);
      }
      return true;
    } catch (error) {
      console.error("Error saving partial quote:", error);
      setPersistenceError({
        message: isSpanish
          ? "No pudimos conectar con el servicio. Intenta de nuevo."
          : "We couldn't connect to the service. Please try again.",
        retryable: true,
      });
      return false;
    }
  };

  const nextStep = async () => {
    let validatedSelection = eligibilitySelection;
    // Validate based on current step type
    if (currentStepType === 'details') {
      const isValid = await form.trigger([
        'fromAddress',
        'toAddress',
        'availabilityStart',
        'availabilityEnd',
        'preferredDates',
        'blockedDates',
      ]);
      if (!isValid) return;

      // During restricted launch, a verified branch selection is the authority.
      setAddressValidating(true);
      setAddressValidationError(null);
      try {
        if (policyState !== 'ready' || !servicePolicy) {
          setAddressValidationError({ retryable: true });
          return;
        }
        const hasFrom = Boolean(selectedBranches.from);
        const hasTo = Boolean(selectedBranches.to);
        if (!servicePolicy.generalMovesEnabled && !servicePolicy.branchMovesEnabled) {
          setAddressValidationError({
            message: isSpanish
              ? "El servicio está temporalmente fuera de cobertura. Intenta más tarde."
              : "Service coverage is temporarily unavailable. Please try again later.",
            retryable: false,
          });
          return;
        }
        if (!servicePolicy.generalMovesEnabled && hasFrom === hasTo) {
          setAddressValidationError({
            message: hasFrom
              ? (isSpanish
                ? "Selecciona una sucursal oficial solo como origen o destino, no en ambos."
                : "Select an official branch as either origin or destination, not both.")
              : (isSpanish
                ? "Selecciona una sucursal U-Storage oficial como origen o destino."
                : "Select an official U-Storage branch as the origin or destination."),
            retryable: false,
          });
          return;
        }
        if (hasTo && !servicePolicy.intoStorageEnabled) {
          setAddressValidationError({
            message: isSpanish
              ? "Los traslados hacia una sucursal no están disponibles. Selecciona una sucursal como origen."
              : "Moves into a branch are unavailable. Select a branch as the origin.",
            retryable: false,
          });
          return;
        }
        if (hasFrom && !servicePolicy.outOfStorageEnabled) {
          setAddressValidationError({
            message: isSpanish
              ? "Los traslados desde una sucursal no están disponibles. Selecciona una sucursal como destino."
              : "Moves out of a branch are unavailable. Select a branch as the destination.",
            retryable: false,
          });
          return;
        }
        validatedSelection = { fromBranchId: selectedBranches.from?.id || null, toBranchId: selectedBranches.to?.id || null };
        setEligibilitySelection(validatedSelection);
        if (!servicePolicy.generalMovesEnabled && !selectedBranches.from && !selectedBranches.to) {
          setAddressValidationError({ retryable: true });
          return;
        }
      } catch (err) {
        console.error('Error validating storage address:', err);
        setAddressValidationError({ retryable: true });
        return;
      } finally {
        setAddressValidating(false);
      }
      
      // For logged-in users, save partial quote after details step (creates the quote)
      if (skipAccountStep) {
        if (!await savePartialQuote(validatedSelection)) return;
      }
    }
    
    if (currentStepType === 'contact') {
      const values = form.getValues();
      const hasEmailOrPhone = (values.contactEmail && values.contactEmail.length > 0) || 
                              (values.contactPhone && values.contactPhone.length > 0);
      if (!values.contactName) {
        form.setError("contactName", { type: "manual", message: t('quote.form.validation.required') });
        return;
      }
      if (!hasEmailOrPhone) {
        form.setError("contactEmail", { type: "manual", message: isSpanish ? "Ingresa email o teléfono" : "Enter email or phone" });
        return;
      }
      // For non-logged users, save partial quote after contact step (creates the quote with placeholder user)
      if (!await savePartialQuote()) return;
    }
    
    if (currentStepType === 'inventory') {
      const isValid = await form.trigger(['homeSize']);
      if (!isValid) return;
      
      // Recalculate estimate based on current inventory before moving to next step
      if (inventoryItems.length > 0) {
        try {
          const calcRes = await fetch('/api/quotes/calculate-estimate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
              items: inventoryItems,
              originCity: form.getValues('fromAddress'),
              originCountry: 'MX',
              quoteSessionId,
              quoteId: partialQuoteId,
              fromAddress: form.getValues('fromAddress'),
              toAddress: form.getValues('toAddress')
            })
          });
          if (calcRes.ok) {
            const calcData = await calcRes.json();
            if (calcData.estimatedCost) {
              setEstimatedCost(calcData.estimatedCost);
            }
            if (calcData.truckRecommendation) {
              setTruckRecommendation(calcData.truckRecommendation);
            }
          }
        } catch (err) {
          console.error('Error calculating estimate:', err);
        }
      }
      
      // Save inventory/home size selection
      if (partialQuoteId) {
        if (!await savePartialQuote({
          storageContractStatus,
          storageRentalIntent: storageContractStatus === 'needs_unit' ? (selectedStorageOption ? 'reserve' : null) : 'no_reservation',
          storageSelectedUnitCode: selectedStorageOption?.code || null,
          storageSelectedUnitSnapshot: selectedStorageOption || null,
        })) return;
      }
    }
    
    if (currentStepType === 'services') {
      const isValid = await form.trigger(['storage']);
      if (!isValid) return;
      if (storageRec?.moveType === 'into_storage' && !storageContractStatus) {
        setShowStepWarning(isSpanish ? 'Selecciona si ya tienes un contrato o necesitas una bodega.' : 'Choose whether you already have a contract or need a storage unit.');
        return;
      }
      if (storageRec?.moveType === 'out_of_storage') {
        form.setValue('storage', 'ustorage');
        setStorageContractStatus('existing');
      }
      // Save services and add-ons selection
      if (partialQuoteId) {
        if (!await savePartialQuote({
          storageContractStatus: storageContractStatus || (storageRec?.moveType === 'out_of_storage' ? 'existing' : null),
          storageRentalIntent: storageContractStatus === 'needs_unit' ? (selectedStorageOption ? 'reserve' : null) : 'no_reservation',
          storageSelectedUnitCode: selectedStorageOption?.code || null,
          storageSelectedUnitSnapshot: selectedStorageOption || null,
        })) return;
      }
    }
    
    if (currentStepType === 'review') {
      // Save final state before account step (for guests) or submit (for logged users)
      if (partialQuoteId) {
        if (!await savePartialQuote()) return;
      }
      // Sync contact fields to account fields for the account step
      const contactName = form.getValues('contactName');
      const contactEmail = form.getValues('contactEmail');
      if (contactName && !form.getValues('name')) {
        form.setValue('name', contactName);
      }
      if (contactEmail && !form.getValues('email')) {
        form.setValue('email', contactEmail);
      }
    }
    
    const newStep = step + 1;
    if (currentStepType === 'inventory' && stepOrder[newStep - 1] === 'services') {
      setStorageRecLoading(true);
      setStorageRec(null);
      setStorageAvailability(null);
      setSelectedStorageOption(null);
      setStorageContractStatus(null);
      setStorageDecision(null);
      setStorageRecFetchedFor(null);
    }
    setStep(newStep);
    if (newStep > highestVisitedStep) {
      setHighestVisitedStep(newStep);
    }
  };

  const prevStep = () => setStep(s => s - 1);

  const handleStepClick = (targetStep: number, stepLabel: string) => {
    if (targetStep <= highestVisitedStep) {
      setStep(targetStep);
      setShowStepWarning(null);
    } else {
      setShowStepWarning(isSpanish 
        ? `Completa los pasos anteriores para llegar a "${stepLabel}"`
        : `Complete previous steps to reach "${stepLabel}"`);
      setTimeout(() => setShowStepWarning(null), 3000);
    }
  };

  const handleFormSubmit = (values: z.infer<typeof formSchema>) => {
    const legacyMoveDate = values.preferredDates[0] || firstNonBlockedAvailableDate(
      values.availabilityStart,
      values.availabilityEnd,
      values.blockedDates,
    ) || values.date;
    const normalizedValues = {
      ...values,
      date: legacyMoveDate,
      ...eligibilitySelection,
      storageContractStatus,
      storageRentalIntent: storageContractStatus === 'needs_unit' ? (selectedStorageOption ? 'reserve' : null) : 'no_reservation',
      storageSelectedUnitCode: selectedStorageOption?.code || null,
      storageSelectedUnitSnapshot: selectedStorageOption || null,
      storageAvailabilityStatus: storageAvailability?.status || null,
      storageAvailabilityCheckedAt: storageAvailability?.checkedAt || null,
    };
    if (skipAccountStep) {
      onSubmit({
        ...normalizedValues,
        ...eligibilitySelection,
        partialQuoteId: partialQuoteId || undefined,
        moveDate: normalizedValues.date,
        moveAvailabilityStart: values.availabilityStart,
        moveAvailabilityEnd: values.availabilityEnd,
        preferredMoveDates: values.preferredDates,
        blockedMoveDates: values.blockedDates,
        storageOption: values.storage,
        inventoryItems,
        estimatedCost: estimatedCost?.low,
        estimatedCostHigh: estimatedCost?.high,
        estimatedCurrency: estimatedCost?.currency,
         reservationClaim: reservationContext?.claim,
         exchangeId: reservationContext?.exchangeId || reservationContext?.claim,
         reservationProvenance: reservationContext?.provenance,
         reservationCampaign: reservationContext?.campaign,
         reservationUnitCode: reservationContext?.unit?.code,
         reservationRentalStart: reservationContext?.rentalStart,
         reservationUnitSizeM2: reservationContext?.unit?.usableSizeM2,
         storageSelectedUnitCode: reservationContext?.unit?.code || selectedStorageOption?.code || null,
         storageRentalStart: reservationContext?.rentalStart || null,
         storageSizeM2: reservationContext?.unit?.usableSizeM2 || undefined,
         storageHandoffProvenance: reservationContext?.confirmed ? "ustorage_confirmed" : "manual",
      } as QuoteFormData);
    } else {
      let hasError = false;
      
      // Email is required if not provided in contact step
      const hasContactEmail = values.contactEmail && values.contactEmail.length > 0;
      if (!hasContactEmail && !values.email) {
        form.setError("email", { type: "manual", message: t('quote.form.validation.required') });
        hasError = true;
      }
      
      // Password is always required
      if (!values.password) {
        form.setError("password", { type: "manual", message: t('quote.form.validation.required') });
        hasError = true;
      }
      
      if (hasError) return;
      
      // Use contact fields if name/email not set
      const finalValues = {
        ...normalizedValues,
        name: values.name || values.contactName,
        email: values.email || values.contactEmail,
         partialQuoteId: partialQuoteId || undefined,
         ...eligibilitySelection
      };
      onSubmit({
        ...finalValues,
        reservationClaim: reservationContext?.claim,
        exchangeId: reservationContext?.exchangeId || reservationContext?.claim,
        reservationProvenance: reservationContext?.provenance,
        reservationCampaign: reservationContext?.campaign,
        reservationUnitCode: reservationContext?.unit?.code,
        reservationRentalStart: reservationContext?.rentalStart,
        reservationUnitSizeM2: reservationContext?.unit?.usableSizeM2,
        storageSelectedUnitCode: reservationContext?.unit?.code || selectedStorageOption?.code || null,
        storageRentalStart: reservationContext?.rentalStart || null,
        storageSizeM2: reservationContext?.unit?.usableSizeM2 || undefined,
        storageHandoffProvenance: reservationContext?.confirmed ? "ustorage_confirmed" : "manual",
      } as QuoteFormData);
    }
  };

  const getStepLabel = (stepType: StepType) => {
    switch (stepType) {
      case 'details': return t('quote.steps.details');
      case 'contact': return isSpanish ? "Contacto" : "Contact";
      case 'inventory': return t('quote.steps.inventory');
      case 'services': return t('quote.steps.services');
      case 'review': return t('quote.steps.review');
      case 'account': return t('quote.steps.account');
    }
  };

  return (
    <div className="w-full">
      {reservationContext && (
        <Card className="mb-6 border-[#4E2069]/20 bg-[#faf7fc]">
          <CardContent className="p-4 md:p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-[#4E2069]">
                  {reservationContext.confirmed
                    ? (isSpanish ? "Reserva verificada" : "Verified reservation")
                    : (isSpanish ? "Contexto de reserva" : "Reservation context")}
                </p>
                <p className="mt-1 font-semibold text-slate-900">
                  {reservationContext.destinationBranch?.name || (isSpanish ? "Sucursal de destino" : "Destination branch")}
                  {reservationContext.confirmed && reservationContext.destinationBranch?.id && <span className="ml-2 text-xs font-medium text-emerald-700">{isSpanish ? "verificada" : "verified"}</span>}
                </p>
                {reservationContext.destinationBranch?.address && (
                  <p className="text-sm text-slate-600">{reservationContext.destinationBranch.address}</p>
                )}
              </div>
              <div className="text-left text-sm text-slate-600 md:text-right">
                {reservationContext.unit?.code && <p><span className="font-medium">{isSpanish ? "Unidad" : "Unit"}:</span> {reservationContext.unit.code}{reservationContext.confirmed && <span className="ml-1 text-xs text-emerald-700">{isSpanish ? "(verificada)" : "(verified)"}</span>}</p>}
                {reservationContext.unit?.name && <p>{reservationContext.unit.name}</p>}
                {reservationContext.rentalStart && <p><span className="font-medium">{isSpanish ? "Inicio de renta" : "Rental start"}:</span> {reservationContext.rentalStart}{reservationContext.confirmed && <span className="ml-1 text-xs text-emerald-700">{isSpanish ? "(verificado)" : "(verified)"}</span>}</p>}
                {reservationContext.unit?.capacityM3 && (
                  <p className="text-xs">{isSpanish ? `Capacidad orientativa: ${reservationContext.unit.capacityM3} m³` : `Guidance capacity: ${reservationContext.unit.capacityM3} m³`}</p>
                )}
              </div>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {isSpanish
                ? "La capacidad es solo una guía para preparar tu mudanza; no aparta inventario. Puedes cambiar los datos no verificados."
                : "Capacity is guidance only for planning your move; it does not reserve inventory. You can edit any non-verified details."}
            </p>
          </CardContent>
        </Card>
      )}
      {/* Partner branding header */}
      {partnerTheme && (
        <div className="mb-6 text-center">
          <div className="flex items-center justify-center gap-3 mb-2">
            {partnerTheme.logo && (
              <img src={partnerTheme.logo} alt={partnerTheme.name} className="h-10 object-contain" />
            )}
          </div>
          {partnerTheme.headerText && (
            <p className="text-lg font-semibold" style={{ color: primaryColor }}>
              {partnerTheme.headerText}
            </p>
          )}
        </div>
      )}

      <div className="mb-8 rounded-2xl bg-[#F4EFF7] px-4 py-5 sm:px-8">
        <div className="flex justify-between items-center relative">
           <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-[#D9D0DF] -z-10" />
          <motion.div 
            className="absolute h-0.5 -z-5"
            style={{ 
              backgroundColor: secondaryColor,
              left: 0,
              top: '50%',
              translateY: '-50%'
            }}
            initial={{ width: '0%' }}
            animate={{ width: `${((step - 1) / (totalSteps - 1)) * 100}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
          {stepOrder.map((stepType, index) => {
            const stepNumber = index + 1;
            const isVisited = stepNumber <= highestVisitedStep;
            const isCompleted = step > stepNumber;
            const isCurrent = step === stepNumber;
            const canNavigate = isVisited && !isCurrent;
            const stepLabel = getStepLabel(stepType);
            
            return (
              <motion.div 
                key={stepType}
                className={`flex flex-col items-center gap-2 px-2 transition-colors relative cursor-pointer`}
                style={{ color: isVisited ? primaryColor : '#94a3b8' }}
                onClick={() => handleStepClick(stepNumber, stepLabel)}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                data-testid={`step-indicator-${stepType}`}
              >
                <motion.div 
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold border-2 transition-all ${canNavigate ? 'hover:ring-2 hover:ring-offset-2' : ''}`}
                  style={isCompleted ? {
                    borderColor: secondaryColor,
                    backgroundColor: secondaryColor,
                     color: '#24152E'
                  } : isCurrent ? {
                    borderColor: primaryColor,
                    backgroundColor: primaryColor,
                     color: '#FBF9F6',
                    boxShadow: `0 0 0 4px ${primaryColor}20`
                  } : isVisited ? {
                    borderColor: secondaryColor,
                     backgroundColor: '#FBF9F6',
                    color: secondaryColor
                  } : {
                    borderColor: '#cbd5e1',
                     backgroundColor: '#FBF9F6',
                    color: '#94a3b8'
                  }}
                  animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.5, repeat: isCurrent ? Infinity : 0, repeatDelay: 2 }}
                >
                  {isCompleted ? (
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </motion.div>
                <span className={`text-xs font-medium uppercase tracking-wider hidden sm:block ${canNavigate ? 'hover:underline' : ''}`}>
                  {stepLabel}
                </span>
              </motion.div>
            );
          })}
        </div>
        
        <AnimatePresence>
          {showStepWarning && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="mt-3 text-center"
            >
              <span className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 text-sm rounded-full border border-amber-200">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                {showStepWarning}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <Card className="shadow-[0_18px_55px_rgba(78,32,105,0.12)] border-0 ring-1 ring-[#D9D0DF] rounded-2xl overflow-hidden">
        <CardHeader className="bg-[#FBF9F6] border-b pb-6 relative">
          {onCancel && (
            <Button 
              type="button"
              variant="ghost" 
              size="icon" 
              onClick={onCancel}
              className="absolute right-4 top-4"
              data-testid="button-close-wizard"
            >
              <X className="h-5 w-5" />
            </Button>
          )}
          <CardTitle className="text-2xl text-center text-[#24152E]">{t('quote.title')}</CardTitle>
          <CardDescription className="text-center text-[#6D6075]">
            {t('quote.stepOf', { current: step, total: totalSteps })}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="p-6 sm:p-8">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(handleFormSubmit)} className="space-y-8">
              {persistenceError && (
                <div
                  className="mb-6 flex flex-col gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive sm:flex-row sm:items-center sm:justify-between"
                  role="alert"
                  data-testid="alert-quote-save-error"
                >
                  <p>{persistenceError.message}</p>
                  {persistenceError.retryable && (
                    <Button type="button" variant="outline" size="sm" onClick={retryAvailability}>
                      {isSpanish ? "Reintentar" : "Try again"}
                    </Button>
                  )}
                </div>
              )}
              <AnimatePresence mode="wait">
                {currentStepType === 'details' && (
                  <motion.div
                    key="details"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="rounded-lg border border-[#4E2069]/20 bg-[#4E2069]/5 px-4 py-3 text-sm text-slate-700">
                      {policyState === "loading"
                        ? (isSpanish ? "Verificando cobertura disponible…" : "Checking available coverage…")
                        : policyState === "error"
                          ? (isSpanish
                            ? "No pudimos consultar la cobertura. Reintenta antes de continuar."
                            : "We couldn't check coverage. Try again before continuing.")
                            : !servicePolicy?.branchMovesEnabled && !servicePolicy?.generalMovesEnabled
                              ? (isSpanish
                                ? "El servicio no está disponible temporalmente. Vuelve a intentarlo más tarde."
                                : "Service is temporarily unavailable. Please try again later.")
                            : servicePolicy?.generalMovesEnabled
                            ? (isSpanish
                              ? "Escribe una dirección o busca una sucursal por nombre, por ejemplo: U-Storage Polanco. Las sucursales oficiales se identifican en los resultados."
                              : "Enter an address or search for a branch by name, for example: U-Storage Polanco. Official branches are identified in the results.")
                            : (isSpanish
                              ? "Escribe una dirección o sucursal, por ejemplo: U-Storage Polanco. El origen o destino debe ser una sucursal oficial."
                              : "Enter an address or branch, for example: U-Storage Polanco. The origin or destination must be an official branch.")}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="fromAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <UsgIcon name="pin" size={19} className="text-[#FF6C00]" /> {t('quote.form.from')}
                            </FormLabel>
                            <FormControl>
                              <AddressAutocomplete 
                                value={field.value}
                                nearbyLocation={!selectedBranches.to ? toLocation : null}
                                allowBranchSelection={Boolean(servicePolicy?.branchMovesEnabled && servicePolicy?.outOfStorageEnabled)}
                                selectedBranch={selectedBranches.from}
                                disabled={Boolean(selectedBranches.from)}
                                onChange={(v, placeId) => {
                                  field.onChange(v);
                                  if (!placeId) setFromLocation(null);
                                  setAddressValidationError(null);
                                }}
                                onLocationSelect={setFromLocation}
                                onBranchSelect={(branch) => {
                                  setFromLocation(null);
                                  setSelectedBranches((current) => ({ ...current, from: branch }));
                                  setEligibilitySelection((current) => ({ ...current, fromBranchId: branch.id }));
                                }}
                                onClearSelection={() => {
                                  setSelectedBranches((current) => ({ ...current, from: null }));
                                  setEligibilitySelection((current) => ({ ...current, fromBranchId: null }));
                                  setFromLocation(null);
                                  field.onChange("");
                                }}
                                placeholder="e.g. Av. Paseo de la Reforma 505, CDMX"
                                className="h-12 text-lg bg-slate-50"
                                data-testid="input-quote-from-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      
                      <FormField
                        control={form.control}
                        name="toAddress"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <UsgIcon name="route" size={19} className="text-[#4E2069]" /> {t('quote.form.to')}
                            </FormLabel>
                            <FormControl>
                              <AddressAutocomplete 
                                value={field.value}
                                nearbyLocation={!selectedBranches.from ? fromLocation : null}
                                allowBranchSelection={Boolean(servicePolicy?.branchMovesEnabled && servicePolicy?.intoStorageEnabled)}
                                selectedBranch={selectedBranches.to}
                                disabled={Boolean(selectedBranches.to)}
                                onChange={(v, placeId) => {
                                  field.onChange(v);
                                  if (!placeId) setToLocation(null);
                                  setAddressValidationError(null);
                                }}
                                onLocationSelect={setToLocation}
                                onBranchSelect={(branch) => {
                                  setToLocation(null);
                                  setSelectedBranches((current) => ({ ...current, to: branch }));
                                  setEligibilitySelection((current) => ({ ...current, toBranchId: branch.id }));
                                }}
                                onClearSelection={() => {
                                  setSelectedBranches((current) => ({ ...current, to: null }));
                                  setEligibilitySelection((current) => ({ ...current, toBranchId: null }));
                                  setToLocation(null);
                                  field.onChange("");
                                }}
                                placeholder={isSpanish ? "Ej: U-Storage Roma" : "e.g. U-Storage Roma"}
                                className="h-12 text-lg bg-slate-50"
                                data-testid="input-quote-to-address"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    {addressValidationError && (
                      <div
                        className="rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive"
                        data-testid="alert-storage-address-error"
                      >
                        {addressValidationError.message ? (
                          <div className="flex items-center justify-between gap-3">
                            <p>{addressValidationError.message}</p>
                            {addressValidationError.retryable && (
                              <Button type="button" variant="outline" size="sm" onClick={retryAvailability}>
                                {isSpanish ? "Reintentar" : "Try again"}
                              </Button>
                            )}
                          </div>
                        ) : addressValidationError.retryable ? (
                          <div className="flex items-center justify-between gap-3">
                          <p>
                            {isSpanish
                              ? "No pudimos verificar tus direcciones en este momento. Por favor intenta de nuevo."
                              : "We couldn't verify your addresses right now. Please try again."}
                          </p>
                           <Button type="button" variant="outline" size="sm" onClick={retryAvailability}>
                            {isSpanish ? "Reintentar" : "Try again"}
                          </Button>
                          </div>
                        ) : (
                          <>
                            <p className="font-semibold mb-1">
                              {isSpanish
                                ? "Selecciona una sucursal U-Storage oficial"
                                : "Select an official U-Storage branch"}
                            </p>
                            <p>
                              {isSpanish
                                ? "Servicios exclusivos hacia y desde bodegas de U-Storage."
                                : "During launch, your origin or destination must be a verified branch."}
                            </p>
                          </>
                        )}
                        {addressValidationError.nearestName && (
                          <p className="mt-2 text-destructive">
                            {isSpanish ? "Sucursal más cercana: " : "Nearest location: "}
                            <span className="font-medium">
                              {addressValidationError.nearestName}
                              {addressValidationError.nearestRegion ? ` (${addressValidationError.nearestRegion})` : ""}
                            </span>
                            {typeof addressValidationError.nearestDistanceKm === "number" &&
                              ` — ${addressValidationError.nearestDistanceKm} km`}
                          </p>
                        )}
                      </div>
                    )}

                    <MoveDatePreferences
                      availabilityStart={form.watch("availabilityStart")}
                      availabilityEnd={form.watch("availabilityEnd")}
                      preferredDates={form.watch("preferredDates")}
                      blockedDates={form.watch("blockedDates")}
                      onAvailabilityStartChange={(value) => {
                        form.setValue("availabilityStart", value, { shouldDirty: true, shouldValidate: true });
                      }}
                      onAvailabilityEndChange={(value) => {
                        form.setValue("availabilityEnd", value, { shouldDirty: true, shouldValidate: true });
                      }}
                      onPreferredDatesChange={(dates) => {
                        form.setValue("preferredDates", dates, { shouldDirty: true, shouldValidate: true });
                      }}
                      onBlockedDatesChange={(dates) => {
                        form.setValue("blockedDates", dates, { shouldDirty: true, shouldValidate: true });
                      }}
                      isSpanish={isSpanish}
                      primaryColor={primaryColor}
                      error={form.formState.errors.preferredDates?.message}
                    />
                  </motion.div>
                )}

                {currentStepType === 'contact' && (
                  <motion.div
                    key="contact"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-6">
                      <h3 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
                        {isSpanish ? "¿Cómo te contactamos?" : "How can we reach you?"}
                      </h3>
                      <p className="text-slate-500">
                        {isSpanish 
                          ? "Ingresa tu nombre y correo electrónico o número de teléfono" 
                          : "Enter your name and email or phone number"}
                      </p>
                    </div>

                    <FormField
                      control={form.control}
                      name="contactName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold flex items-center gap-2">
                            <User className="w-4 h-4" style={{ color: primaryColor }} /> {isSpanish ? "Nombre" : "Name"} *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder={isSpanish ? "Tu nombre completo" : "Your full name"}
                              className="h-12 text-lg bg-slate-50" 
                              {...field} 
                              data-testid="input-contact-name"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <FormField
                        control={form.control}
                        name="contactEmail"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <Mail className="w-4 h-4" style={{ color: secondaryColor }} /> {isSpanish ? "Correo electrónico" : "Email"}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="email"
                                placeholder="tu@correo.com"
                                className="h-12 text-lg bg-slate-50" 
                                {...field} 
                                data-testid="input-contact-email"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="contactPhone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold flex items-center gap-2">
                              <Phone className="w-4 h-4" style={{ color: primaryColor }} /> {isSpanish ? "Teléfono" : "Phone"}
                            </FormLabel>
                            <FormControl>
                              <Input 
                                type="tel"
                                placeholder="+52 55 1234 5678"
                                className="h-12 text-lg bg-slate-50" 
                                {...field} 
                                data-testid="input-contact-phone"
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <p className="text-sm text-center text-slate-400">
                      {isSpanish 
                        ? "* Puedes ingresar correo, teléfono o ambos" 
                        : "* You can enter email, phone, or both"}
                    </p>
                  </motion.div>
                )}

                {currentStepType === 'inventory' && (
                  <motion.div
                    key="inventory"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="w-full"
                  >
                    {/* Full width on desktop, stacked on mobile for better usability */}
                    <div className="flex flex-col lg:flex-row gap-6 w-full overflow-hidden">
                      {/* Visual Inventory Picker - full width on mobile, 60% on desktop */}
                      <div className="w-full lg:w-3/5 min-w-0 bg-white rounded-xl border border-slate-200 p-4 lg:p-6 overflow-hidden">
                        <VisualInventoryPicker
                          items={inventoryItems}
                          onItemsChange={setInventoryItems}
                        />
                      </div>
                      
                      {/* Clara Chat - full width on mobile, 40% on desktop */}
                      <div className="w-full lg:w-2/5 min-w-0 bg-slate-50 rounded-xl border border-slate-200 p-4 lg:p-6 overflow-hidden">
                        <div className="flex items-center gap-2 mb-4">
                          <MessageCircle className="w-5 h-5" style={{ color: primaryColor }} />
                          <h3 className="text-lg font-semibold" style={{ color: primaryColor }}>
                            {isSpanish ? "Habla con Clara" : "Chat with Clara"}
                          </h3>
                        </div>
                        <InventoryChat 
                          onComplete={(items, cost) => {
                            setInventoryItems(items);
                            if (cost) setEstimatedCost(cost);
                          }} 
                          onItemsChange={(items) => setInventoryItems(items)}
                          onEstimateChange={(cost, truck) => {
                            if (cost) setEstimatedCost(cost);
                            if (truck) setTruckRecommendation(truck);
                          }}
                          externalItems={inventoryItems}
                          originCity={form.getValues('fromAddress')}
                          originCountry="MX"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStepType === 'services' && (
                  <motion.div
                    key="services"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    {storageRec?.moveType === 'out_of_storage' ? (
                      <div className="rounded-xl border-2 border-[#4E2069] bg-[#F7F1FA] p-5" data-testid="storage-move-out">
                        <h2 className="text-lg font-bold text-[#351d3d]">{isSpanish ? 'Traslado desde tu bodega' : 'Moving out of your storage unit'}</h2>
                        <p className="mt-2 text-sm text-slate-700">{isSpanish
                          ? 'Tu origen es una sucursal U-Storage aprobada. Coordinaremos la salida de tus pertenencias; no necesitas rentar otra bodega.'
                          : 'Your origin is an approved U-Storage branch. We will coordinate the move out of your unit; you do not need to rent another one.'}</p>
                        <Badge className="mt-3 bg-[#4E2069]">{isSpanish ? 'Bodega existente' : 'Existing unit'}</Badge>
                      </div>
                    ) : storageRec?.moveType === 'into_storage' ? (
                      <div className="space-y-4">
                        <div>
                          <h2 className="text-lg font-bold" style={{ color: primaryColor }}>{isSpanish ? '¿Ya tienes contrato en esta sucursal?' : 'Do you already have a contract at this branch?'}</h2>
                          <p className="mt-1 text-sm text-slate-600">{storageRec.branch.name}</p>
                        </div>
                        <RadioGroup value={storageContractStatus || undefined} onValueChange={async (value) => {
                          const status = value as 'existing' | 'needs_unit';
                          setStorageContractStatus(status);
                          setStorageDecision(status === 'existing' ? 'declined' : null);
                          setSelectedStorageOption(null);
                          form.setValue('storage', status === 'existing' ? 'none' : 'need');
                          if (partialQuoteId) await savePartialQuote({
                            storageContractStatus: status,
                            storageRentalIntent: status === 'needs_unit' ? null : 'no_reservation',
                            storageAccepted: status === 'needs_unit' ? null : false,
                            storageSelectedUnitSnapshot: null,
                          });
                        }} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                          <label htmlFor="storage-contract-needs-unit" className="[&:has([data-state=checked])>div]:border-primary cursor-pointer">
                              <RadioGroupItem id="storage-contract-needs-unit" value="needs_unit" className="sr-only" />
                              <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50"><div className="font-semibold">{isSpanish ? 'Quiero reservar una bodega U-Storage' : 'I want to reserve a U-Storage unit'}</div><p className="mt-1 text-xs text-muted-foreground">{isSpanish ? 'Consulta opciones disponibles.' : 'See currently available options.'}</p></div>
                          </label>
                          <label htmlFor="storage-contract-existing" className="[&:has([data-state=checked])>div]:border-primary cursor-pointer">
                              <RadioGroupItem id="storage-contract-existing" value="existing" className="sr-only" />
                              <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50"><div className="font-semibold">{isSpanish ? 'Ya tengo una bodega' : 'I already have a storage unit'}</div><p className="mt-1 text-xs text-muted-foreground">{isSpanish ? 'Continúa a servicios adicionales.' : 'Continue to ancillary services.'}</p></div>
                          </label>
                        </RadioGroup>
                      </div>
                    ) : (
                      <div className="rounded-lg border border-slate-200 p-4 text-sm text-slate-600">
                        {isSpanish ? 'Verificando la relación de tu mudanza con una sucursal U-Storage…' : 'Checking how your move relates to a U-Storage branch…'}
                      </div>
                    )}

                    {storageRec?.moveType === 'into_storage' && storageContractStatus === 'needs_unit' && (
                      <div className="space-y-4 rounded-xl border-2 border-[#FF6C00] bg-[#FFF1E6] p-5" data-testid="storage-availability-options">
                        <div>
                          <h3 className="font-bold text-slate-900">{isSpanish ? 'Opciones disponibles en tu sucursal' : 'Available options at your branch'}</h3>
                          {storageRec.suggestedTier && <p className="mt-1 text-sm text-slate-700">{isSpanish
                            ? `Recomendación por tu inventario: ${storageRec.suggestedTier.labelEs} (${storageRec.suggestedTier.m2} m²)`
                            : `Recommended from your inventory: ${storageRec.suggestedTier.labelEn} (${storageRec.suggestedTier.m2} m²)`}</p>}
                        </div>
                        {storageAvailability?.checkedAt && <p className="flex items-center gap-1 text-xs text-slate-600"><Clock className="h-3.5 w-3.5" />{isSpanish ? 'Consultado' : 'Checked'} {new Date(storageAvailability.checkedAt).toLocaleString(isSpanish ? 'es-MX' : 'en-US')}</p>}
                        {storageAvailability?.status !== 'available' ? (
                          <div className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
                            <p>{storageAvailability?.status === 'wrong_branch'
                              ? (isSpanish ? 'La información recibida no corresponde a esta sucursal.' : 'The availability response did not match this branch.')
                              : storageAvailability?.status === 'no_availability'
                                ? (isSpanish ? 'No hay unidades disponibles en este momento.' : 'No units are currently available.')
                                : (isSpanish ? 'No pudimos consultar disponibilidad ahora.' : 'We could not check availability right now.')}</p>
                            <Button type="button" variant="outline" size="sm" className="mt-3" onClick={() => { setStorageRecFetchedFor(null); setStorageAvailability(null); setStorageAvailabilityRetry((value) => value + 1); }}>
                              <RefreshCw className="mr-2 h-3.5 w-3.5" />{isSpanish ? 'Intentar de nuevo' : 'Try again'}
                            </Button>
                            <p className="mt-3 text-xs">{isSpanish ? 'Tu cotización puede continuar; reserva directamente en U-Storage.' : 'Your quote can continue; reserve directly with U-Storage.'}</p>
                            {storageRec.reservationUrl && <a href={storageRec.reservationUrl} target="_blank" rel="noopener noreferrer" className="mt-2 inline-flex items-center font-semibold text-[#4E2069] underline"><ExternalLink className="mr-2 h-4 w-4" />{isSpanish ? `Ver la página de ${storageRec.branch.name}` : `Open ${storageRec.branch.name} page`}</a>}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {(storageAvailability.options || []).length > 0
                              && (storageAvailability.options || []).every((option: any) => option.fit === 'too_small')
                              && <div className="flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
                                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                                <p>{isSpanish
                                  ? 'Las opciones disponibles en esta sucursal son menores que el espacio estimado para todo tu inventario. Puedes elegir una, pero es posible que necesites reducir lo que guardarás o contratar espacio adicional.'
                                  : 'The available options at this branch are smaller than the estimated space for all your inventory. You may choose one, but you may need to store fewer items or rent additional space.'}</p>
                              </div>}
                            <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                              {(storageAvailability.options || []).map((option: any, index: number) => {
                              const selected = selectedStorageOption?.code === option.code;
                              const characteristics = Array.isArray(option.characteristics) ? option.characteristics : [];
                              const price = option.priceMxn != null ? Number(option.priceMxn) : null;
                              const fitWarning = option.fit === 'too_small';
                              const isLarger = option.fit === 'larger';
                              return <button type="button" key={option.code || index} aria-pressed={selected} aria-label={`${isSpanish ? 'Seleccionar bodega de' : 'Select'} ${option.usableSizeM2} m²`} onClick={async () => {
                                setSelectedStorageOption(option);
                                 setStorageHandoffError(null);
                                setStorageDecision('accepted');
                                if (partialQuoteId) await savePartialQuote({ storageRentalIntent: 'reserve', storageAccepted: true, storageSelectedUnitCode: option.code, storageSelectedUnitSnapshot: option, storageReservationStatus: 'not_started', storageSizeM2: option.usableSizeM2 });
                              }} className={`group relative min-h-[326px] overflow-hidden rounded-[3px] border-2 bg-white text-left shadow-[0_2px_0_rgba(36,21,46,0.04)] transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_12px_24px_rgba(78,32,105,0.14)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#FF6C00]/35 ${selected ? 'border-[#4E2069] shadow-[0_0_0_3px_#FF6C00,0_12px_24px_rgba(78,32,105,0.16)]' : option.recommended ? 'border-[#91bec8]' : 'border-[#b7d2d7]'}`} data-testid={`storage-option-${option.code || index}`}>
                                <div className={`flex h-8 items-center justify-end px-3 text-[11px] font-bold italic tracking-wide text-[#334b52] ${option.recommended ? 'bg-[#98c4cd]' : 'bg-[#d5e3e3]'}`}>
                                  {option.recommended ? (isSpanish ? 'Bodega recomendada' : 'Recommended unit') : (isSpanish ? 'Bodega' : 'Storage unit')}
                                </div>
                                <div className="flex min-h-[294px] flex-col p-5">
                                  <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4">
                                    <div>
                                      <p className="text-[18px] font-extrabold leading-tight text-[#4E2069]">{isSpanish ? 'Tamaño' : 'Size'}</p>
                                      <p className="mt-2 text-[17px] font-extrabold tracking-tight text-[#24212a]">{option.usableSizeM2} m²</p>
                                      <p className="mt-1 text-xs font-bold text-[#24212a]">{option.dimensions || '—'}</p>
                                    </div>
                                    <div className="space-y-2 text-sm text-[#24212a]">
                                      <p><span className="font-extrabold text-[#4E2069]">{isSpanish ? 'Piso:' : 'Floor:'}</span> {option.floor || '—'}</p>
                                      <p><span className="font-extrabold text-[#4E2069]">{isSpanish ? 'Altura:' : 'Height:'}</span> {option.heightM ? `${option.heightM} m` : '—'}</p>
                                      {option.capacityM3 != null && <p className="text-xs text-[#5b5360]"><span className="font-bold">{isSpanish ? 'Capacidad:' : 'Capacity:'}</span> {Number(option.capacityM3).toFixed(1)} m³</p>}
                                    </div>
                                  </div>
                                  {characteristics.length > 0 && <div className="mt-4 flex flex-wrap gap-1.5">{characteristics.map((characteristic: string, characteristicIndex: number) => <span key={`${characteristic}-${characteristicIndex}`} className="rounded-sm bg-[#f0e9f2] px-2 py-1 text-[11px] font-semibold text-[#4E2069]">{characteristic}</span>)}</div>}
                                  <div className="mt-auto pt-5 text-center">
                                    {price != null && <p className="text-[20px] font-extrabold tracking-tight text-[#24212a]">${price.toLocaleString()} <span className="text-xs font-bold">MXN/mes</span></p>}
                                    {option.promotion && <p className="mt-1 text-sm font-bold text-[#e56b21]">{option.promotion}</p>}
                                    {fitWarning && <p className="mt-3 flex items-start gap-1.5 rounded-sm bg-[#fff3df] px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-[#754815]"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />{isSpanish ? 'Puede que no quepa todo tu inventario estimado.' : 'Your estimated inventory may not all fit.'}</p>}
                                    {isLarger && <p className="mt-3 rounded-sm bg-[#edf4fb] px-2 py-1.5 text-left text-[11px] font-semibold leading-snug text-[#28537a]">{isSpanish ? 'Tendrás espacio adicional; el precio puede ser mayor.' : 'You will have extra space; the price may be higher.'}</p>}
                                  </div>
                                  <div className={`mt-4 flex h-10 items-center justify-center text-sm font-extrabold transition-colors ${selected ? 'bg-[#4E2069] text-white' : 'bg-[#f47721] text-white group-hover:bg-[#df6414]'}`}>
                                    {selected ? (isSpanish ? 'Seleccionada' : 'Selected') : (isSpanish ? 'Reservar' : 'Reserve')}
                                  </div>
                                </div>
                              </button>;
                              })}
                            </div>
                          </div>
                        )}
                        {selectedStorageOption && <Button type="button" disabled={storageHandoffLoading} onClick={async () => {
                          const reservationWindow = window.open('about:blank', '_blank');
                          if (!reservationWindow) {
                            setStorageHandoffError(isSpanish
                              ? 'Permite las ventanas emergentes para abrir U-Storage sin perder tu cotización.'
                              : 'Allow pop-ups to open U-Storage without losing your quote.');
                            return;
                          }
                          reservationWindow.opener = null;
                          reservationWindow.document.title = isSpanish ? 'Abriendo U-Storage…' : 'Opening U-Storage…';
                          reservationWindow.document.body.textContent = isSpanish
                            ? 'Validando la disponibilidad de tu bodega…'
                            : 'Validating your storage unit availability…';
                          setStorageHandoffLoading(true);
                          setStorageHandoffError(null);
                          try {
                            const response = await fetch('/api/ustorage/reservation-handoff', {
                              method: 'POST',
                              credentials: 'include',
                              headers: { 'Content-Type': 'application/json' },
                              body: JSON.stringify({
                                branchId: storageRec.branch.id,
                                code: selectedStorageOption.code,
                                volumeM3: truckRecommendation?.totalVolumeM3,
                              }),
                            });
                            const handoff = await response.json().catch(() => null);
                            if (!response.ok || !handoff?.reservationUrl) {
                              throw new Error(handoff?.status || 'unavailable');
                            }
                            const saved = await savePartialQuote({
                              storageReservationStatus: 'handed_off',
                              storageSelectedUnitSnapshot: handoff.option,
                              storageAvailabilityCheckedAt: handoff.option?.checkedAt || storageAvailability?.checkedAt || null,
                            });
                            if (!saved) throw new Error('persistence');
                            reservationWindow.location.replace(handoff.reservationUrl);
                          } catch {
                            if (!reservationWindow.closed) reservationWindow.close();
                            setStorageHandoffError(isSpanish
                              ? 'La unidad cambió o no pudimos validarla. Actualiza la disponibilidad e intenta de nuevo.'
                              : 'The unit changed or could not be validated. Refresh availability and try again.');
                          } finally {
                            setStorageHandoffLoading(false);
                          }
                        }} className="bg-[#4E2069] text-white hover:bg-[#351d3d]" data-testid="button-storage-reserve"><ExternalLink className="mr-2 h-4 w-4" />{storageHandoffLoading ? (isSpanish ? 'Validando…' : 'Validating…') : (isSpanish ? 'Continuar a reservar en U-Storage' : 'Continue to reserve at U-Storage')}</Button>}
                        {storageHandoffError && <p role="alert" className="text-sm font-medium text-red-700">{storageHandoffError}</p>}
                      </div>
                    )}

                    {storageRec?.moveType === 'out_of_storage' && (
                      <input type="hidden" value="ustorage" {...form.register('storage')} />
                    )}
                    {/* Show general-move choices only after branch verification has
                        completed and confirmed no U-Storage-specific journey applies. */}
                    {!storageRecLoading && !storageRec && (
                      <FormField
                        control={form.control}
                        name="storage"
                        render={({ field }) => (
                          <FormItem className="space-y-4">
                            <FormLabel className="text-lg font-bold" style={{ color: primaryColor }}>{t('quote.form.storage.question')}</FormLabel>
                            <FormControl>
                              <RadioGroup onValueChange={field.onChange} defaultValue={field.value} className="grid grid-cols-1 gap-4 md:grid-cols-2">
                              <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                  <FormControl>
                                    <RadioGroupItem value="none" className="sr-only" />
                                  </FormControl>
                                  <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50 transition-all">
                                    <div className="font-semibold text-slate-900">{t('quote.form.storage.options.none')}</div>
                                  </div>
                                </FormLabel>
                              </FormItem>

                              <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                  <FormControl>
                                    <RadioGroupItem value="need" className="sr-only" />
                                  </FormControl>
                                  <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50 transition-all">
                                    <div className="font-semibold text-slate-900">{t('quote.form.storage.options.need')}</div>
                                  </div>
                                </FormLabel>
                              </FormItem>

                              <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                  <FormControl>
                                    <RadioGroupItem value="ustorage" className="sr-only" />
                                  </FormControl>
                                  <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50 transition-all">
                                    <div className="font-semibold text-slate-900">{t('quote.form.storage.options.ustorage')}</div>
                                  </div>
                                </FormLabel>
                              </FormItem>

                              <FormItem>
                                <FormLabel className="[&:has([data-state=checked])>div]:border-primary [&:has([data-state=checked])>div]:bg-primary/5 cursor-pointer">
                                  <FormControl>
                                    <RadioGroupItem value="other" className="sr-only" />
                                  </FormControl>
                                  <div className="rounded-lg border-2 border-slate-200 p-4 hover:border-primary/50 transition-all">
                                    <div className="font-semibold text-slate-900">{t('quote.form.storage.options.other')}</div>
                                  </div>
                                </FormLabel>
                              </FormItem>
                            </RadioGroup>
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                    )}
                    />
                    )}

                    {storageRec && storageRec.moveType === ('legacy' as never) && (
                      <div
                        className="rounded-xl border-2 p-5 space-y-3"
                        style={{ borderColor: '#FF6C00', backgroundColor: '#FFF1E6' }}
                        data-testid="card-storage-recommendation"
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div>
                            <div className="font-bold text-slate-900 text-base" data-testid="text-storage-rec-title">
                              {storageRec.moveType === 'into_storage'
                                ? (isSpanish ? '¡Tu destino está cerca de una bodega U-Storage!' : 'Your destination is near a U-Storage branch!')
                                : (isSpanish ? '¡Tu origen está cerca de una bodega U-Storage!' : 'Your origin is near a U-Storage branch!')}
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              {isSpanish
                                ? `Sucursal ${storageRec.branch.name}${storageRec.branch.region ? ` (${storageRec.branch.region})` : ''} a ${storageRec.distanceKm} km`
                                : `${storageRec.branch.name} branch${storageRec.branch.region ? ` (${storageRec.branch.region})` : ''}, ${storageRec.distanceKm} km away`}
                            </p>
                          </div>
                          {storageRec.branch.priceFromMxn && (
                            <div className="text-sm font-semibold text-[#FF6C00]" data-testid="text-storage-rec-price">
                              {isSpanish ? 'Desde' : 'From'} ${parseFloat(storageRec.branch.priceFromMxn).toLocaleString()} MXN/mes
                            </div>
                          )}
                        </div>
                        {storageRec.suggestedTier && (
                          <p className="text-sm text-slate-700" data-testid="text-storage-rec-size">
                            {isSpanish
                              ? `Según tu inventario, te recomendamos una bodega: ${storageRec.suggestedTier.labelEs} — ${storageRec.suggestedTier.example}`
                              : `Based on your inventory, we recommend: ${storageRec.suggestedTier.labelEn} — ${storageRec.suggestedTier.example}`}
                          </p>
                        )}
                        {storageDecision !== 'accepted' ? (
                          <div className="flex gap-3 flex-wrap">
                            <Button
                              type="button"
                              style={{ backgroundColor: '#FF6C00', color: '#24152E' }}
                              className="hover:opacity-90"
                              data-testid="button-storage-accept"
                               onClick={async () => {
                                 const endpointSelection = storageRec.moveType === 'out_of_storage'
                                   ? { fromBranchId: storageRec.branch.id, toBranchId: null }
                                   : { fromBranchId: null, toBranchId: storageRec.branch.id };
                                 if (partialQuoteId) {
                                   const saved = await savePartialQuote({
                                     ...endpointSelection,
                                    storageBranchDistanceKm: storageRec.distanceKm,
                                    storageSizeLabel: storageRec.suggestedTier ? (isSpanish ? storageRec.suggestedTier.labelEs : storageRec.suggestedTier.labelEn) : undefined,
                                    storageSizeM2: storageRec.suggestedTier?.m2,
                                    storageAccepted: true,
                                  });
                                   if (!saved) return;
                                }
                                 const selectedBranch: UStorageBranch = {
                                   id: storageRec.branch.id,
                                   brand: storageRec.branch.brand,
                                   name: storageRec.branch.name,
                                   region: storageRec.branch.region,
                                   address: storageRec.branch.address,
                                   googlePlaceId: storageRec.branch.googlePlaceId,
                                   lat: storageRec.branch.lat,
                                   lng: storageRec.branch.lng,
                                   mapsUrl: storageRec.branch.mapsUrl || undefined,
                                 };
                                 setEligibilitySelection(endpointSelection);
                                 if (storageRec.moveType === "out_of_storage") {
                                   setSelectedBranches({ from: selectedBranch, to: null });
                                   form.setValue("fromAddress", selectedBranch.address);
                                 } else {
                                   setSelectedBranches({ from: null, to: selectedBranch });
                                   form.setValue("toAddress", selectedBranch.address);
                                 }
                                 setStorageDecision('accepted');
                                 form.setValue('storage', 'ustorage');
                              }}
                            >
                              {isSpanish ? 'Sí, me interesa la bodega' : 'Yes, I want the storage unit'}
                            </Button>
                            {storageDecision !== 'declined' && (
                              <Button
                                type="button"
                                variant="outline"
                                data-testid="button-storage-decline"
                                 onClick={async () => {
                                  if (partialQuoteId) {
                                     const saved = await savePartialQuote({
                                       ...eligibilitySelection,
                                      storageBranchDistanceKm: storageRec.distanceKm,
                                      storageAccepted: false,
                                    });
                                     if (!saved) return;
                                  }
                                   setStorageDecision('declined');
                                }}
                              >
                                {isSpanish ? 'No, gracias' : 'No, thanks'}
                              </Button>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-sm font-semibold text-success" data-testid="text-storage-accepted">
                              {isSpanish ? 'Bodega agregada a tu cotización' : 'Storage added to your quote'}
                            </span>
                            {storageRec.reservationUrl && (
                              <a
                                href={storageRec.reservationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-semibold text-[#4E2069] underline"
                                data-testid="link-storage-reserve"
                              >
                                {isSpanish ? 'Reservar bodega en U-Storage →' : 'Reserve your unit at U-Storage →'}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                    )}

                    <Separator className="my-8" />

                    <div className="space-y-4">
                      <h3 className="text-lg font-bold" style={{ color: primaryColor }}>{t('quote.form.addons.title')}</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <FormField
                          control={form.control}
                          name="needsInsurance"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-slate-50">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t('quote.form.addons.insurance')}
                                </FormLabel>
                                <p className="text-sm text-slate-500">
                                  {t('quote.form.addons.insuranceDesc')}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="needsBox"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-slate-50">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t('quote.form.addons.box')}
                                </FormLabel>
                                <p className="text-sm text-slate-500">
                                  {t('quote.form.addons.boxDesc')}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="needsPacking"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-slate-50">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t('quote.form.addons.packing')}
                                </FormLabel>
                                <p className="text-sm text-slate-500">
                                  {t('quote.form.addons.packingDesc')}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                        <FormField
                          control={form.control}
                          name="needsUnpacking"
                          render={({ field }) => (
                            <FormItem className="flex flex-row items-start space-x-3 space-y-0 rounded-md border p-4 hover:bg-slate-50">
                              <FormControl>
                                <Checkbox
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FormControl>
                              <div className="space-y-1 leading-none">
                                <FormLabel>
                                  {t('quote.form.addons.unpacking')}
                                </FormLabel>
                                <p className="text-sm text-slate-500">
                                  {t('quote.form.addons.unpackingDesc')}
                                </p>
                              </div>
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Additional Notes Section */}
                      <div className="mt-6 pt-6 border-t">
                        <FormField
                          control={form.control}
                          name="clientNotes"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-base font-semibold">
                                {isSpanish ? 'Notas y Comentarios Adicionales' : 'Additional Notes and Comments'}
                              </FormLabel>
                              <p className="text-sm text-slate-500 mb-2">
                                {isSpanish 
                                  ? 'Incluye cualquier detalle adicional, solicitudes especiales o aclaraciones sobre tu mudanza.'
                                  : 'Include any additional details, special requests, or clarifications about your move.'}
                              </p>
                              <FormControl>
                                <Textarea
                                  {...field}
                                  placeholder={isSpanish 
                                    ? 'Ej: Tengo un piano que requiere cuidado especial, necesito que lleguen antes de las 9am...'
                                    : 'Ex: I have a piano that requires special care, I need you to arrive before 9am...'}
                                  className="min-h-[100px] resize-y"
                                  data-testid="textarea-client-notes"
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>
                  </motion.div>
                )}

                {currentStepType === 'review' && (
                  <motion.div
                    key="review"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="rounded-xl bg-slate-50 p-6 space-y-4 border">
                      <h3 className="font-bold text-lg" style={{ color: primaryColor }}>{t('quote.summary')}</h3>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-slate-500 block">{t('quote.form.fromLabel')}</span>
                          <span className="font-medium text-lg break-words">{form.getValues('fromAddress')}</span>
                        </div>
                        <div className="col-span-2 sm:col-span-1">
                          <span className="text-slate-500 block">{t('quote.form.toLabel')}</span>
                          <span className="font-medium text-lg break-words">{form.getValues('toAddress')}</span>
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">
                            {isSpanish ? "Disponibilidad" : "Availability"}
                          </span>
                          <span className="font-medium text-lg">
                            {form.getValues("availabilityStart")} — {form.getValues("availabilityEnd")}
                          </span>
                          {form.getValues("preferredDates").length > 0 ? (
                            <span className="mt-1 block text-sm text-slate-600">
                              {(isSpanish ? "Preferencias: " : "Preferences: ")}
                              {form.getValues("preferredDates").map((date, index) => `${index + 1}) ${date}`).join(" · ")}
                            </span>
                          ) : (
                            <span className="mt-1 block text-sm text-slate-600">
                              {isSpanish ? "Todos los días disponibles funcionan igual." : "All available dates work equally well."}
                            </span>
                          )}
                          {form.getValues("blockedDates").length > 0 && (
                            <span className="mt-1 block text-sm text-slate-600">
                              {(isSpanish ? "No disponibles: " : "Unavailable: ")}
                              {form.getValues("blockedDates").join(" · ")}
                            </span>
                          )}
                        </div>
                        <div>
                          <span className="text-slate-500 block">{t('quote.form.sizeLabel')}</span>
                          <span className="font-medium text-lg capitalize">{form.getValues('homeSize')}</span>
                        </div>
                        {!skipAccountStep && (
                          <div className="col-span-2">
                            <span className="text-slate-500 block">{isSpanish ? "Contacto" : "Contact"}</span>
                            <span className="font-medium text-lg">
                              {form.getValues('contactName')} 
                              {form.getValues('contactEmail') && ` • ${form.getValues('contactEmail')}`}
                              {form.getValues('contactPhone') && ` • ${form.getValues('contactPhone')}`}
                            </span>
                          </div>
                        )}
                        <div className="col-span-2">
                          <span className="text-slate-500 block">{t('quote.form.storage.label')}</span>
                          <span className="font-medium text-lg">
                            {form.getValues('storage') === 'none' ? t('quote.form.storage.options.none') :
                             form.getValues('storage') === 'need' ? t('quote.form.storage.options.need') :
                             form.getValues('storage') === 'ustorage' ? t('quote.form.storage.options.ustorage') :
                             t('quote.form.storage.options.other')}
                          </span>
                        </div>
                        {storageRec?.moveType === 'into_storage' && (
                          <div className="col-span-2 rounded-lg border border-[#4E2069]/20 bg-[#4E2069]/5 p-3" data-testid="storage-review-snapshot">
                            <span className="text-slate-500 block">{isSpanish ? 'Decisión de bodega' : 'Storage decision'}</span>
                            <span className="font-semibold">{storageContractStatus === 'existing'
                              ? (isSpanish ? 'Ya tengo contrato en esta sucursal' : 'I already have a contract at this branch')
                              : (isSpanish ? 'Necesito una bodega' : 'I need a storage unit')}</span>
                            {selectedStorageOption && <span className="mt-1 block text-sm text-slate-700">{selectedStorageOption.usableSizeM2} m² · {selectedStorageOption.dimensions || '—'} · {selectedStorageOption.floor || '—'} {selectedStorageOption.priceMxn != null ? `· $${Number(selectedStorageOption.priceMxn).toLocaleString()} MXN/mes` : ''}</span>}
                          </div>
                        )}
                        <div className="col-span-2 rounded-lg border border-[#FF6C00]/25 bg-[#FF6C00]/5 p-3">
                          <span className="text-slate-500 block">{isSpanish ? "Servicio y sucursal" : "Service and branch"}</span>
                          <span className="font-semibold text-base">
                            {selectedBranches.to
                              ? (isSpanish ? "Entrada a U-Storage" : "Into U-Storage")
                              : selectedBranches.from
                                ? (isSpanish ? "Salida de U-Storage" : "Out of U-Storage")
                                : (servicePolicy?.generalMovesEnabled ? (isSpanish ? "Mudanza general" : "General move") : "—")}
                          </span>
                          {(selectedBranches.to || selectedBranches.from) && (
                            <span className="block text-sm text-slate-600">
                              {(selectedBranches.to || selectedBranches.from)?.brand} · {(selectedBranches.to || selectedBranches.from)?.name}
                            </span>
                          )}
                        </div>
                        <div className="col-span-2">
                          <span className="text-slate-500 block">{t('quote.form.addons.title')}</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {form.getValues('needsInsurance') && (
                              <span className="px-2 py-1 bg-success/10 text-success rounded-md text-sm font-medium">
                                {t('quote.form.addons.insurance')}
                              </span>
                            )}
                            {form.getValues('needsBox') && (
                              <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded-md text-sm font-medium">
                                {t('quote.form.addons.box')}
                              </span>
                            )}
                            {form.getValues('needsPacking') && (
                              <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded-md text-sm font-medium">
                                {t('quote.form.addons.packing')}
                              </span>
                            )}
                            {form.getValues('needsUnpacking') && (
                              <span className="px-2 py-1 bg-orange-100 text-orange-700 rounded-md text-sm font-medium">
                                {t('quote.form.addons.unpacking')}
                              </span>
                            )}
                            {!form.getValues('needsInsurance') && 
                             !form.getValues('needsBox') && 
                             !form.getValues('needsPacking') && 
                             !form.getValues('needsUnpacking') && (
                              <span className="text-slate-400 italic">{t('common.noneSelected')}</span>
                            )}
                          </div>
                        </div>
                        {form.getValues('clientNotes') && (
                          <div className="col-span-2 mt-2">
                            <span className="text-slate-500 block">
                              {isSpanish ? 'Notas Adicionales' : 'Additional Notes'}
                            </span>
                            <p className="font-medium text-slate-700 whitespace-pre-wrap">
                              {form.getValues('clientNotes')}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    
                    <div 
                      className="rounded-xl p-8 text-center space-y-4 border"
                      style={{ backgroundColor: `${primaryColor}10`, borderColor: `${primaryColor}30` }}
                    >
                      <h3 className="text-xl font-bold" style={{ color: primaryColor }}>{t('quote.preliminary.title')}</h3>
                      {estimatedCost ? (
                        <>
                          <div className="text-4xl font-black" style={{ color: primaryColor }} data-testid="text-estimated-cost">
                            ${estimatedCost.low.toLocaleString()} - ${estimatedCost.high.toLocaleString()} {estimatedCost.currency}
                          </div>
                          {truckRecommendation && (
                            <div className="flex flex-wrap justify-center gap-3 text-sm text-slate-600">
                              {truckRecommendation.truckBreakdown && truckRecommendation.truckBreakdown.length > 0 ? (
                                truckRecommendation.truckBreakdown.map((truck, idx) => (
                                  <span key={idx} className="bg-white px-3 py-1 rounded-full border">
                                    <UsgIcon name="truck" size={18} className="mr-1 text-[#4E2069]" />{truck.count}× {truck.name}
                                  </span>
                                ))
                              ) : (
                                <span className="bg-white px-3 py-1 rounded-full border">
                                  <UsgIcon name="truck" size={18} className="mr-1 text-[#4E2069]" />{truckRecommendation.truckCount}× {truckRecommendation.recommendedTruck}
                                </span>
                              )}
                              <span className="bg-white px-3 py-1 rounded-full border">
                                <UsgIcon name="team" size={18} className="mr-1 text-[#4E2069]" />{truckRecommendation.includedMovers} {isSpanish ? "cargadores" : "movers"}
                              </span>
                              <span className="bg-white px-3 py-1 rounded-full border">
                                <UsgIcon name="clock" size={18} className="mr-1 text-[#4E2069]" />~{truckRecommendation.estimatedHours} {isSpanish ? "horas" : "hours"}
                              </span>
                              <span className="bg-white px-3 py-1 rounded-full border">
                                <UsgIcon name="checklist" size={18} className="mr-1 text-[#4E2069]" />{truckRecommendation.totalItemCount ?? inventoryItems.reduce((sum, item) => sum + item.quantity, 0)} {isSpanish ? "artículos" : "items"}
                              </span>
                              <span className="bg-white px-3 py-1 rounded-full border">
                                {truckRecommendation.totalWeightKg.toLocaleString()} kg
                              </span>
                              {truckRecommendation.totalVolumeM3 !== undefined && (
                                <span className="bg-white px-3 py-1 rounded-full border">
                                  <UsgIcon name="box" size={18} className="mr-1 text-[#4E2069]" />{truckRecommendation.totalVolumeM3} m³
                                </span>
                              )}
                            </div>
                          )}
                        </>
                      ) : (
                        <div className="text-4xl font-black" style={{ color: primaryColor }}>{t('quote.preliminary.range')}</div>
                      )}
                      <p className="text-slate-600 max-w-md mx-auto">
                        {t('quote.preliminary.message')}
                      </p>
                    </div>
                  </motion.div>
                )}

                {currentStepType === 'account' && (
                  <motion.div
                    key="account"
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-6"
                  >
                    <div className="text-center mb-8">
                      <h3 className="text-xl font-bold mb-2" style={{ color: primaryColor }}>
                        {isSpanish ? "Crea tu cuenta" : "Create your account"}
                      </h3>
                      <p className="text-slate-500">
                        {isSpanish 
                          ? "Completa tu información para acceder a tu cuenta y dar seguimiento a tu mudanza" 
                          : "Complete your info to access your account and track your move"}
                      </p>
                    </div>

                    <div className="bg-slate-50 rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-slate-500">{isSpanish ? "Nombre:" : "Name:"}</span>
                        <span className="font-medium text-slate-700">{form.getValues('contactName') || form.getValues('name')}</span>
                      </div>
                      {form.getValues('contactPhone') && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">{isSpanish ? "Teléfono:" : "Phone:"}</span>
                          <span className="font-medium text-slate-700">{form.getValues('contactPhone')}</span>
                        </div>
                      )}
                      {form.getValues('contactEmail') && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-slate-500">{isSpanish ? "Correo:" : "Email:"}</span>
                          <span className="font-medium text-slate-700">{form.getValues('contactEmail')}</span>
                        </div>
                      )}
                    </div>

                    {!form.getValues('contactEmail') && (
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="text-base font-semibold">
                              {isSpanish ? "Correo electrónico" : "Email"} *
                            </FormLabel>
                            <FormControl>
                              <Input 
                                placeholder="tu@correo.com" 
                                type="email" 
                                className="h-12 text-lg"
                                {...field} 
                                data-testid="input-email"
                              />
                            </FormControl>
                            <p className="text-xs text-slate-500 mt-1">
                              {isSpanish ? "Necesario para crear tu cuenta" : "Required to create your account"}
                            </p>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={form.control}
                      name="password"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="text-base font-semibold">
                            {isSpanish ? "Contraseña" : "Password"} *
                          </FormLabel>
                          <FormControl>
                            <Input 
                              placeholder="••••••••" 
                              type="password" 
                              className="h-12 text-lg"
                              {...field} 
                              data-testid="input-password"
                            />
                          </FormControl>
                          <p className="text-xs text-slate-500 mt-1">
                            {isSpanish ? "Mínimo 8 caracteres" : "Minimum 8 characters"}
                          </p>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex justify-between pt-6 border-t">
                {step > 1 ? (
                  <Button type="button" variant="outline" onClick={prevStep} className="text-base" data-testid="button-back">
                    <ArrowLeft className="mr-2 w-4 h-4" /> {t('quote.form.back')}
                  </Button>
                ) : (
                  <div />
                )}
                
                {step < totalSteps ? (
                  <Button 
                    type="button" 
                    onClick={nextStep} 
                    disabled={addressValidating}
                    className="text-base px-8"
                    style={{ backgroundColor: primaryColor, color: '#FBF9F6' }}
                    data-testid="button-next"
                  >
                    {addressValidating
                      ? (isSpanish ? "Verificando..." : "Checking...")
                      : t('quote.form.next')} <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                ) : (
                  <Button 
                    type="submit" 
                    className="text-[#24152E] text-base px-8 shadow-lg"
                    style={{ backgroundColor: secondaryColor }}
                    data-testid="button-submit-quote"
                  >
                    {skipAccountStep ? t('quote.form.submitQuote') : t('quote.form.createAndSubmit')}
                  </Button>
                )}
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
