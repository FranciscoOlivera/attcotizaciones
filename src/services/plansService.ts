import { ATTPlan } from '../types/pricing';

const STORAGE_KEY = 'att_custom_plans_v2';

export const loadPlans = (): ATTPlan[] => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    try {
      const parsed: ATTPlan[] = JSON.parse(saved);
      if (Array.isArray(parsed)) {
        return parsed;
      }
    } catch (e) {
      console.error('Error loading plans', e);
    }
  }
  // If no table is linked, do not put default fake prices
  return [];
};

export const savePlans = (plans: ATTPlan[]): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(plans));
};

export const updatePlanPrice = (planId: string, newPrice: number): ATTPlan[] => {
  const current = loadPlans();
  const updated = current.map((p) => (p.id === planId ? { ...p, monthlyPrice: newPrice } : p));
  savePlans(updated);
  return updated;
};

export const addCustomPlan = (name: string, monthlyPrice: number, description?: string): ATTPlan[] => {
  const current = loadPlans();
  const id = name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
  
  const existingIndex = current.findIndex((p) => p.id === id || p.name.toLowerCase() === name.toLowerCase());
  
  let updated: ATTPlan[];
  if (existingIndex >= 0) {
    updated = [...current];
    updated[existingIndex] = { ...updated[existingIndex], monthlyPrice, description: description || updated[existingIndex].description };
  } else {
    const newPlan: ATTPlan = {
      id,
      name,
      monthlyPrice,
      description: description || `Plan ${name}`,
      isCustom: true,
    };
    updated = [...current, newPlan];
  }

  savePlans(updated);
  return updated;
};

export const deleteCustomPlan = (planId: string): ATTPlan[] => {
  const current = loadPlans();
  const updated = current.filter((p) => p.id !== planId);
  savePlans(updated);
  return updated;
};

export const clearPlans = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const findPlanByName = (plans: ATTPlan[], name: string): ATTPlan | undefined => {
  const cleanName = name.trim().toLowerCase();
  return plans.find((p) => p.name.toLowerCase() === cleanName || cleanName.includes(p.name.toLowerCase()));
};
