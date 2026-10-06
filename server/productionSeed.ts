import { db } from "./db";
import { sql, eq } from "drizzle-orm";
import {
  inventoryCategories,
  inventoryRooms,
  services,
  addOns,
  truckTypes,
  aiAgentConfig,
  websiteConfig,
  pricingTemplates,
  countries,
  cities,
  cityTruckPricing,
  pricingFormulaParameters,
  aiPricingPrompts,
  emailSenders,
  emailTemplates,
  emailTriggers,
} from "@shared/schema";

interface ExportedConfig {
  exportedAt: string;
  inventoryCategories: any[];
  inventoryRooms: any[];
  services: any[];
  addOns: any[];
  truckTypes: any[];
  aiAgentConfig: any[];
  websiteConfig: any[];
  pricingTemplates: any[];
  countries: any[];
  cities: any[];
  cityTruckPricing: any[];
  pricingFormulaParameters: any[];
  aiPricingPrompts: any[];
  emailSenders: any[];
  emailTemplates: any[];
  emailTriggers: any[];
}

export async function exportConfigData(): Promise<ExportedConfig> {
  console.error("Exporting configuration data from database...");

  const [
    inventoryCategoriesData,
    inventoryRoomsData,
    servicesData,
    addOnsData,
    truckTypesData,
    aiAgentConfigData,
    websiteConfigData,
    pricingTemplatesData,
    countriesData,
    citiesData,
    cityTruckPricingData,
    pricingFormulaParametersData,
    aiPricingPromptsData,
    emailSendersData,
    emailTemplatesData,
    emailTriggersData,
  ] = await Promise.all([
    db.select().from(inventoryCategories),
    db.select().from(inventoryRooms),
    db.select().from(services),
    db.select().from(addOns),
    db.select().from(truckTypes),
    db.select().from(aiAgentConfig),
    db.select().from(websiteConfig),
    db.select().from(pricingTemplates),
    db.select().from(countries),
    db.select().from(cities),
    db.select().from(cityTruckPricing),
    db.select().from(pricingFormulaParameters),
    db.select().from(aiPricingPrompts),
    db.select().from(emailSenders),
    db.select().from(emailTemplates),
    db.select().from(emailTriggers),
  ]);

  const config: ExportedConfig = {
    exportedAt: new Date().toISOString(),
    inventoryCategories: inventoryCategoriesData,
    inventoryRooms: inventoryRoomsData,
    services: servicesData,
    addOns: addOnsData,
    truckTypes: truckTypesData,
    aiAgentConfig: aiAgentConfigData,
    websiteConfig: websiteConfigData,
    pricingTemplates: pricingTemplatesData,
    countries: countriesData,
    cities: citiesData,
    cityTruckPricing: cityTruckPricingData,
    pricingFormulaParameters: pricingFormulaParametersData,
    aiPricingPrompts: aiPricingPromptsData,
    emailSenders: emailSendersData,
    emailTemplates: emailTemplatesData,
    emailTriggers: emailTriggersData,
  };

  console.error("Export complete:");
  console.error(`  - Inventory Categories: ${inventoryCategoriesData.length}`);
  console.error(`  - Inventory Rooms: ${inventoryRoomsData.length}`);
  console.error(`  - Services: ${servicesData.length}`);
  console.error(`  - Add-ons: ${addOnsData.length}`);
  console.error(`  - Truck Types: ${truckTypesData.length}`);
  console.error(`  - AI Agent Config: ${aiAgentConfigData.length}`);
  console.error(`  - Website Config: ${websiteConfigData.length}`);
  console.error(`  - Pricing Templates: ${pricingTemplatesData.length}`);
  console.error(`  - Countries: ${countriesData.length}`);
  console.error(`  - Cities: ${citiesData.length}`);
  console.error(`  - City Truck Pricing: ${cityTruckPricingData.length}`);
  console.error(`  - Pricing Formula Parameters: ${pricingFormulaParametersData.length}`);
  console.error(`  - AI Pricing Prompts: ${aiPricingPromptsData.length}`);
  console.error(`  - Email Senders: ${emailSendersData.length}`);
  console.error(`  - Email Templates: ${emailTemplatesData.length}`);
  console.error(`  - Email Triggers: ${emailTriggersData.length}`);

  return config;
}

function convertDates<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;
  if (typeof obj === 'string') {
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(obj)) {
      return new Date(obj) as unknown as T;
    }
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(convertDates) as unknown as T;
  }
  if (typeof obj === 'object') {
    const result: any = {};
    for (const [key, value] of Object.entries(obj)) {
      result[key] = convertDates(value);
    }
    return result;
  }
  return obj;
}

export async function seedProductionConfig(config: ExportedConfig): Promise<void> {
  console.log("Seeding production configuration data...");
  console.log(`Using export from: ${config.exportedAt}`);
  
  const data = convertDates(config);

  await db.execute(sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'quote_number_seq') THEN
        CREATE SEQUENCE quote_number_seq START WITH 1 INCREMENT BY 1;
      END IF;
    END $$;
  `);
  console.log("Quote number sequence ensured");

  if (data.inventoryCategories.length > 0) {
    for (const item of data.inventoryCategories) {
      const existing = await db.select().from(inventoryCategories).where(eq(inventoryCategories.key, item.key)).limit(1);
      if (existing.length > 0) {
        await db.update(inventoryCategories).set({
          labelEs: item.labelEs,
          labelEn: item.labelEn,
          description: item.description,
          icon: item.icon,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
          avgWeightKg: item.avgWeightKg,
          minWeightKg: item.minWeightKg,
          maxWeightKg: item.maxWeightKg,
        }).where(eq(inventoryCategories.key, item.key));
      } else {
        await db.insert(inventoryCategories).values(item);
      }
    }
    console.log(`  - Inventory Categories: ${data.inventoryCategories.length} upserted`);
  }

  if (data.inventoryRooms.length > 0) {
    for (const item of data.inventoryRooms) {
      const existing = await db.select().from(inventoryRooms).where(eq(inventoryRooms.key, item.key)).limit(1);
      if (existing.length > 0) {
        await db.update(inventoryRooms).set({
          labelEs: item.labelEs,
          labelEn: item.labelEn,
          sortOrder: item.sortOrder,
          isActive: item.isActive,
        }).where(eq(inventoryRooms.key, item.key));
      } else {
        await db.insert(inventoryRooms).values(item);
      }
    }
    console.log(`  - Inventory Rooms: ${data.inventoryRooms.length} upserted`);
  }

  if (data.services.length > 0) {
    for (const item of data.services) {
      const existing = await db.select().from(services).where(eq(services.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(services).set({
          nameEs: item.nameEs,
          description: item.description,
          descriptionEs: item.descriptionEs,
          basePrice: item.basePrice,
          active: item.active,
        }).where(eq(services.name, item.name));
      } else {
        await db.insert(services).values(item);
      }
    }
    console.log(`  - Services: ${data.services.length} upserted`);
  }

  if (data.addOns.length > 0) {
    for (const item of data.addOns) {
      const existing = await db.select().from(addOns).where(eq(addOns.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(addOns).set({
          nameEs: item.nameEs,
          description: item.description,
          descriptionEs: item.descriptionEs,
          price: item.price,
          active: item.active,
        }).where(eq(addOns.name, item.name));
      } else {
        await db.insert(addOns).values(item);
      }
    }
    console.log(`  - Add-ons: ${data.addOns.length} upserted`);
  }

  if (data.truckTypes.length > 0) {
    for (const item of data.truckTypes) {
      const existing = await db.select().from(truckTypes).where(eq(truckTypes.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(truckTypes).set({
          nameEs: item.nameEs,
          capacityTons: item.capacityTons,
          capacityKg: item.capacityKg,
          includedMovers: item.includedMovers,
          baseServiceHours: item.baseServiceHours,
          baseRate: item.baseRate,
          hourlyRate: item.hourlyRate,
          perKmRate: item.perKmRate,
          extraMoverRate: item.extraMoverRate,
          isActive: item.isActive,
          sortOrder: item.sortOrder,
        }).where(eq(truckTypes.name, item.name));
      } else {
        await db.insert(truckTypes).values(item);
      }
    }
    console.log(`  - Truck Types: ${data.truckTypes.length} upserted`);
  }

  if (data.aiAgentConfig.length > 0) {
    for (const item of data.aiAgentConfig) {
      let existing = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.name, item.name)).limit(1);
      // Rebrand migration: match the old Rukuberto row when seeding the Clara config
      let matchName = item.name;
      if (existing.length === 0 && item.name === 'Clara') {
        existing = await db.select().from(aiAgentConfig).where(eq(aiAgentConfig.name, 'Rukuberto')).limit(1);
        if (existing.length > 0) matchName = 'Rukuberto';
      }
      if (existing.length > 0) {
        await db.update(aiAgentConfig).set({
          name: item.name,
          greeting: item.greeting,
          greetingEs: item.greetingEs,
          systemPrompt: item.systemPrompt,
          systemPromptEs: item.systemPromptEs,
          mission: item.mission,
          missionEs: item.missionEs,
          guardrails: item.guardrails,
          guardrailsEs: item.guardrailsEs,
          inventoryRules: item.inventoryRules,
          inventoryRulesEs: item.inventoryRulesEs,
          costEstimationRules: item.costEstimationRules,
          costEstimationRulesEs: item.costEstimationRulesEs,
          imageAnalysisPrompt: item.imageAnalysisPrompt,
          imageAnalysisPromptEs: item.imageAnalysisPromptEs,
          documentParsePrompt: item.documentParsePrompt,
          documentParsePromptEs: item.documentParsePromptEs,
          enforceInventorySummary: item.enforceInventorySummary,
          baseCostPerKm: item.baseCostPerKm,
          baseCostPerItem: item.baseCostPerItem,
          laborCostPerHour: item.laborCostPerHour,
          model: item.model,
          temperature: item.temperature,
          maxTokens: item.maxTokens,
          active: item.active,
        }).where(eq(aiAgentConfig.name, matchName));
      } else {
        await db.insert(aiAgentConfig).values(item);
      }
    }
    console.log(`  - AI Agent Config: ${data.aiAgentConfig.length} upserted`);
  }

  if (data.websiteConfig.length > 0) {
    for (const item of data.websiteConfig) {
      let existing = await db.select().from(websiteConfig).where(eq(websiteConfig.siteName, item.siteName)).limit(1);
      // Rebrand migration: match the old Ruku Move row when seeding the U-Storage Go config
      let matchSiteName = item.siteName;
      if (existing.length === 0 && item.siteName === 'U-Storage Go') {
        existing = await db.select().from(websiteConfig).where(eq(websiteConfig.siteName, 'Ruku Move')).limit(1);
        if (existing.length > 0) matchSiteName = 'Ruku Move';
      }
      if (existing.length > 0) {
        await db.update(websiteConfig).set({
          siteName: item.siteName,
          domain: item.domain,
          primaryColor: item.primaryColor,
          secondaryColor: item.secondaryColor,
          accentColor: item.accentColor,
          contactEmail: item.contactEmail,
          contactPhone: item.contactPhone,
          metaDescription: item.metaDescription,
          metaDescriptionEs: item.metaDescriptionEs,
          maintenanceMode: item.maintenanceMode,
        }).where(eq(websiteConfig.siteName, matchSiteName));
      } else {
        await db.insert(websiteConfig).values(item);
      }
    }
    console.log(`  - Website Config: ${data.websiteConfig.length} upserted`);
  }

  if (data.pricingTemplates.length > 0) {
    for (const item of data.pricingTemplates) {
      const existing = await db.select().from(pricingTemplates).where(eq(pricingTemplates.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(pricingTemplates).set({
          nameEs: item.nameEs,
          description: item.description,
          descriptionEs: item.descriptionEs,
          currency: item.currency,
          baseCostPerKm: item.baseCostPerKm,
          baseCostPerItem: item.baseCostPerItem,
          laborCostPerHour: item.laborCostPerHour,
          largeFurnitureMultiplier: item.largeFurnitureMultiplier,
          fragileItemMultiplier: item.fragileItemMultiplier,
          floorSurchargePercent: item.floorSurchargePercent,
          isDefault: item.isDefault,
          isActive: item.isActive,
        }).where(eq(pricingTemplates.name, item.name));
      } else {
        await db.insert(pricingTemplates).values(item);
      }
    }
    console.log(`  - Pricing Templates: ${data.pricingTemplates.length} upserted`);
  }

  if (data.countries.length > 0) {
    for (const item of data.countries) {
      const existing = await db.select().from(countries).where(eq(countries.code, item.code)).limit(1);
      if (existing.length > 0) {
        await db.update(countries).set({
          name: item.name,
          nameEs: item.nameEs,
          currency: item.currency,
          currencySymbol: item.currencySymbol,
          pricingTemplateId: item.pricingTemplateId,
          baseCostPerKm: item.baseCostPerKm,
          baseCostPerItem: item.baseCostPerItem,
          laborCostPerHour: item.laborCostPerHour,
          isActive: item.isActive,
        }).where(eq(countries.code, item.code));
      } else {
        await db.insert(countries).values(item);
      }
    }
    console.log(`  - Countries: ${data.countries.length} upserted`);
  }

  const countryIdMap: Record<string, string> = {};
  if (data.countries.length > 0) {
    for (const item of data.countries) {
      const prodCountry = await db.select().from(countries).where(eq(countries.code, item.code)).limit(1);
      if (prodCountry.length > 0) {
        countryIdMap[item.id] = prodCountry[0].id;
      }
    }
  }

  if (data.cities.length > 0) {
    for (const item of data.cities) {
      const prodCountryId = countryIdMap[item.countryId] || item.countryId;
      const existing = await db.select().from(cities).where(eq(cities.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(cities).set({
          countryId: prodCountryId,
          nameEs: item.nameEs,
          state: item.state,
          stateCode: item.stateCode,
          baseCostPerKm: item.baseCostPerKm,
          baseCostPerItem: item.baseCostPerItem,
          laborCostPerHour: item.laborCostPerHour,
          extraMoverRate: item.extraMoverRate,
          moverHourlyRate: item.moverHourlyRate,
          complicatedMoveMultiplier: item.complicatedMoveMultiplier,
          isActive: item.isActive,
        }).where(eq(cities.name, item.name));
      } else {
        await db.insert(cities).values({ ...item, countryId: prodCountryId });
      }
    }
    console.log(`  - Cities: ${data.cities.length} upserted`);
  }

  const cityIdMap: Record<string, string> = {};
  if (data.cities.length > 0) {
    for (const item of data.cities) {
      const prodCity = await db.select().from(cities).where(eq(cities.name, item.name)).limit(1);
      if (prodCity.length > 0) {
        cityIdMap[item.id] = prodCity[0].id;
      }
    }
  }

  const truckTypeIdMap: Record<string, string> = {};
  if (data.truckTypes.length > 0) {
    for (const item of data.truckTypes) {
      const prodTruck = await db.select().from(truckTypes).where(eq(truckTypes.name, item.name)).limit(1);
      if (prodTruck.length > 0) {
        truckTypeIdMap[item.id] = prodTruck[0].id;
      }
    }
  }

  if (data.cityTruckPricing.length > 0) {
    for (const item of data.cityTruckPricing) {
      const prodCityId = cityIdMap[item.cityId] || item.cityId;
      const prodTruckTypeId = truckTypeIdMap[item.truckTypeId] || item.truckTypeId;
      
      const existing = await db.select().from(cityTruckPricing)
        .where(sql`${cityTruckPricing.cityId} = ${prodCityId} AND ${cityTruckPricing.truckTypeId} = ${prodTruckTypeId}`)
        .limit(1);
      
      if (existing.length > 0) {
        await db.update(cityTruckPricing).set({
          baseRate: item.baseRate,
          hourlyRate: item.hourlyRate,
          perKmRate: item.perKmRate,
        }).where(eq(cityTruckPricing.id, existing[0].id));
      } else {
        await db.insert(cityTruckPricing).values({
          ...item,
          id: undefined,
          cityId: prodCityId,
          truckTypeId: prodTruckTypeId,
        });
      }
    }
    console.log(`  - City Truck Pricing: ${data.cityTruckPricing.length} upserted`);
  }

  if (data.pricingFormulaParameters.length > 0) {
    for (const item of data.pricingFormulaParameters) {
      const existing = await db.select().from(pricingFormulaParameters).where(eq(pricingFormulaParameters.key, item.key)).limit(1);
      if (existing.length > 0) {
        await db.update(pricingFormulaParameters).set({
          value: item.value,
          labelEn: item.labelEn,
          labelEs: item.labelEs,
          descriptionEn: item.descriptionEn,
          descriptionEs: item.descriptionEs,
          unit: item.unit,
          minValue: item.minValue,
          maxValue: item.maxValue,
          category: item.category,
          sortOrder: item.sortOrder,
        }).where(eq(pricingFormulaParameters.key, item.key));
      } else {
        await db.insert(pricingFormulaParameters).values(item);
      }
    }
    console.log(`  - Pricing Formula Parameters: ${data.pricingFormulaParameters.length} upserted`);
  }

  if (data.aiPricingPrompts.length > 0) {
    for (const item of data.aiPricingPrompts) {
      const existing = await db.select().from(aiPricingPrompts).where(eq(aiPricingPrompts.name, item.name)).limit(1);
      if (existing.length > 0) {
        await db.update(aiPricingPrompts).set({
          scope: item.scope,
          scopeId: item.scopeId,
          content: item.content,
          contentEs: item.contentEs,
          versionTag: item.versionTag,
          isActive: item.isActive,
        }).where(eq(aiPricingPrompts.name, item.name));
      } else {
        await db.insert(aiPricingPrompts).values(item);
      }
    }
    console.log(`  - AI Pricing Prompts: ${data.aiPricingPrompts.length} upserted`);
  }

  if (data.emailSenders.length > 0) {
    for (const item of data.emailSenders) {
      const existing = await db.select().from(emailSenders).where(eq(emailSenders.email, item.email)).limit(1);
      if (existing.length > 0) {
        await db.update(emailSenders).set({
          displayName: item.displayName,
          isDefault: item.isDefault,
          isActive: item.isActive,
        }).where(eq(emailSenders.email, item.email));
      } else {
        await db.insert(emailSenders).values(item);
      }
    }
    console.log(`  - Email Senders: ${data.emailSenders.length} upserted`);
  }

  const emailSenderIdMap: Record<string, string> = {};
  if (data.emailSenders.length > 0) {
    for (const item of data.emailSenders) {
      const prodSender = await db.select().from(emailSenders).where(eq(emailSenders.email, item.email)).limit(1);
      if (prodSender.length > 0) {
        emailSenderIdMap[item.id] = prodSender[0].id;
      }
    }
  }

  if (data.emailTemplates.length > 0) {
    for (const item of data.emailTemplates) {
      const prodSenderId = item.senderId ? (emailSenderIdMap[item.senderId] || item.senderId) : null;
      const existing = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, item.templateKey)).limit(1);
      if (existing.length > 0) {
        await db.update(emailTemplates).set({
          category: item.category,
          subjectEn: item.subjectEn,
          subjectEs: item.subjectEs,
          bodyHtmlEn: item.bodyHtmlEn,
          bodyHtmlEs: item.bodyHtmlEs,
          bodyTextEn: item.bodyTextEn,
          bodyTextEs: item.bodyTextEs,
          senderId: prodSenderId,
          triggerId: item.triggerId,
          sendMode: item.sendMode,
          isActive: item.isActive,
        }).where(eq(emailTemplates.templateKey, item.templateKey));
      } else {
        await db.insert(emailTemplates).values({ ...item, senderId: prodSenderId });
      }
    }
    console.log(`  - Email Templates: ${data.emailTemplates.length} upserted`);
  }

  const emailTemplateIdMap: Record<string, string> = {};
  if (data.emailTemplates.length > 0) {
    for (const item of data.emailTemplates) {
      const prodTemplate = await db.select().from(emailTemplates).where(eq(emailTemplates.templateKey, item.templateKey)).limit(1);
      if (prodTemplate.length > 0) {
        emailTemplateIdMap[item.id] = prodTemplate[0].id;
      }
    }
  }

  if (data.emailTriggers.length > 0) {
    for (const item of data.emailTriggers) {
      const prodTemplateId = item.templateId ? (emailTemplateIdMap[item.templateId] || item.templateId) : null;
      const existing = await db.select().from(emailTriggers).where(eq(emailTriggers.eventKey, item.eventKey)).limit(1);
      if (existing.length > 0) {
        await db.update(emailTriggers).set({
          eventTypeId: item.eventTypeId,
          eventNameEn: item.eventNameEn,
          eventNameEs: item.eventNameEs,
          eventDescriptionEn: item.eventDescriptionEn,
          eventDescriptionEs: item.eventDescriptionEs,
          templateId: prodTemplateId,
          isEnabled: item.isEnabled,
          delayMinutes: item.delayMinutes,
          recipientType: item.recipientType,
          metadata: item.metadata,
        }).where(eq(emailTriggers.eventKey, item.eventKey));
      } else {
        await db.insert(emailTriggers).values({ ...item, templateId: prodTemplateId });
      }
    }
    console.log(`  - Email Triggers: ${data.emailTriggers.length} upserted`);
  }

  console.log("Production configuration seeding complete!");
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const command = process.argv[2];

  if (command === "export") {
    exportConfigData()
      .then((config) => {
        process.stdout.write(JSON.stringify(config, null, 2));
        process.exit(0);
      })
      .catch((err) => {
        console.error("Export failed:", err);
        process.exit(1);
      });
  } else if (command === "seed") {
    const configPath = process.argv[3];
    if (!configPath) {
      console.error("Usage: tsx server/productionSeed.ts seed <config.json>");
      process.exit(1);
    }
    import("fs")
      .then(async (fs) => {
        const configJson = fs.readFileSync(configPath, "utf-8");
        const config = JSON.parse(configJson) as ExportedConfig;
        await seedProductionConfig(config);
        process.exit(0);
      })
      .catch((err) => {
        console.error("Seed failed:", err);
        process.exit(1);
      });
  } else {
    console.log("Usage:");
    console.log("  Export config:  tsx server/productionSeed.ts export > config.json");
    console.log("  Seed config:    tsx server/productionSeed.ts seed config.json");
    process.exit(0);
  }
}
