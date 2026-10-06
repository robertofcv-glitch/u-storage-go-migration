// API client for U-Storage Go backend

const API_BASE = "/api";

export interface User {
  id: string;
  email: string;
  fullName: string;
  userType: string;
  phone: string | null;
  createdAt: string;
}

export interface Quote {
  id: string;
  userId: string;
  movingFrom: string;
  movingTo: string;
  moveDate: string;
  propertyType: string;
  bedrooms: number;
  status: string;
  estimatedPrice: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  quoteId: string;
  itemName: string;
  quantity: number;
  room: string;
  fragile: boolean;
  notes: string | null;
}

export interface Service {
  id: string;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  basePrice: string;
  active: boolean;
}

export interface AddOn {
  id: string;
  name: string;
  nameEs: string;
  description: string;
  descriptionEs: string;
  price: string;
  active: boolean;
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "An error occurred" }));
    throw new Error(error.message || `HTTP error! status: ${response.status}`);
  }
  return response.json();
}

// Auth API
export const authAPI = {
  register: async (data: {
    email: string;
    password: string;
    fullName: string;
    userType: string;
    phone?: string;
  }): Promise<{ user: User }> => {
    const response = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  login: async (email: string, password: string): Promise<{ user: User }> => {
    const response = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    return handleResponse(response);
  },

  logout: async (): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
    });
    return handleResponse(response);
  },

  me: async (): Promise<{ user: User }> => {
    const response = await fetch(`${API_BASE}/auth/me`);
    return handleResponse(response);
  },
};

// Quotes API
export const quotesAPI = {
  create: async (quote: {
    userId: string;
    movingFrom: string;
    movingTo: string;
    moveDate: string;
    propertyType: string;
    bedrooms: number;
    status?: string;
    notes?: string;
  }): Promise<{ quote: Quote }> => {
    const response = await fetch(`${API_BASE}/quotes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(quote),
    });
    return handleResponse(response);
  },

  getByUser: async (userId: string): Promise<{ quotes: Quote[] }> => {
    const response = await fetch(`${API_BASE}/quotes/user/${userId}`);
    return handleResponse(response);
  },

  getById: async (id: string): Promise<{
    quote: Quote;
    inventory: InventoryItem[];
    services: Service[];
    addOns: AddOn[];
  }> => {
    const response = await fetch(`${API_BASE}/quotes/${id}`);
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<Quote>): Promise<{ quote: Quote }> => {
    const response = await fetch(`${API_BASE}/quotes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};

// Inventory API
export const inventoryAPI = {
  add: async (item: {
    quoteId: string;
    itemName: string;
    quantity: number;
    room: string;
    fragile?: boolean;
    notes?: string;
  }): Promise<{ item: InventoryItem }> => {
    const response = await fetch(`${API_BASE}/inventory`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(item),
    });
    return handleResponse(response);
  },

  getByQuote: async (quoteId: string): Promise<{ items: InventoryItem[] }> => {
    const response = await fetch(`${API_BASE}/inventory/${quoteId}`);
    return handleResponse(response);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/inventory/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },
};

// Services API
export const servicesAPI = {
  getActive: async (): Promise<{ services: Service[] }> => {
    const response = await fetch(`${API_BASE}/services`);
    return handleResponse(response);
  },

  getAll: async (): Promise<{ services: Service[] }> => {
    const response = await fetch(`${API_BASE}/admin/services`);
    return handleResponse(response);
  },

  create: async (service: Omit<Service, "id">): Promise<{ service: Service }> => {
    const response = await fetch(`${API_BASE}/admin/services`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(service),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<Service>): Promise<{ service: Service }> => {
    const response = await fetch(`${API_BASE}/admin/services/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/admin/services/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },
};

// AddOns API
export const addOnsAPI = {
  getActive: async (): Promise<{ addOns: AddOn[] }> => {
    const response = await fetch(`${API_BASE}/addons`);
    return handleResponse(response);
  },

  getAll: async (): Promise<{ addOns: AddOn[] }> => {
    const response = await fetch(`${API_BASE}/admin/addons`);
    return handleResponse(response);
  },

  create: async (addOn: Omit<AddOn, "id">): Promise<{ addOn: AddOn }> => {
    const response = await fetch(`${API_BASE}/admin/addons`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(addOn),
    });
    return handleResponse(response);
  },

  update: async (id: string, data: Partial<AddOn>): Promise<{ addOn: AddOn }> => {
    const response = await fetch(`${API_BASE}/admin/addons/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  delete: async (id: string): Promise<{ message: string }> => {
    const response = await fetch(`${API_BASE}/admin/addons/${id}`, {
      method: "DELETE",
    });
    return handleResponse(response);
  },
};

// Admin API
export const adminAPI = {
  getAllQuotes: async (): Promise<{ quotes: Quote[] }> => {
    const response = await fetch(`${API_BASE}/admin/quotes`);
    return handleResponse(response);
  },

  getAiConfig: async (): Promise<{
    config: {
      id: string;
      name: string;
      greeting: string;
      greetingEs: string;
      systemPrompt: string;
      model: string;
      temperature: string;
      active: boolean;
      updatedAt: string;
    };
  }> => {
    const response = await fetch(`${API_BASE}/admin/ai-config`);
    return handleResponse(response);
  },

  updateAiConfig: async (data: any): Promise<{ config: any }> => {
    const response = await fetch(`${API_BASE}/admin/ai-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  getWebsiteConfig: async (): Promise<{ config: any }> => {
    const response = await fetch(`${API_BASE}/website-config`);
    return handleResponse(response);
  },

  updateWebsiteConfig: async (data: any): Promise<{ config: any }> => {
    const response = await fetch(`${API_BASE}/admin/website-config`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },
};
