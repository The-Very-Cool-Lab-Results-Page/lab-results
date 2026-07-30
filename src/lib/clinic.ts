/** The product name, shown as the brand mark in page chrome. */
export const APP_NAME = 'Lab Result Explainer';

/**
 * Demo clinic identity shown on patient-facing pages. Synthetic: a real
 * deployment would derive these from the provider account. The clinic name is
 * content (who shared the results, who to call), distinct from the product
 * brand in the header (APP_NAME).
 */
export const CLINIC = {
  name: 'Meadowbrook Health',
  providerName: 'Dr. Anderson',
  phone: '(555) 123-7890',
} as const;
