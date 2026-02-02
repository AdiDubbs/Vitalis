/**
 * Shared utility functions for symptom handling and formatting
 */

/**
 * Create a Map of symptom IDs to their display names
 * @param {Object} symptomCategories - Object containing symptom buckets/categories
 * @returns {Map<string, string>} Map of symptom ID to display text
 */
export const createSymptomNameMap = (symptomCategories) => {
  const map = new Map();
  Object.values(symptomCategories || {}).forEach((symptoms) => {
    if (Array.isArray(symptoms)) {
      symptoms.forEach((symptom) => {
        if (symptom?.id) {
          map.set(symptom.id, symptom.text || symptom.id);
        }
      });
    }
  });
  return map;
};

/**
 * Format a contribution value as a percentage string
 * @param {number} value - The contribution value to format
 * @returns {string} Formatted string like "+12.5%" or "-3.2%"
 */
export const formatContribution = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
};

/**
 * Format a contribution value as a percentage (multiplied by 100)
 * @param {number} value - The contribution value to format
 * @returns {string} Formatted string like "+12.5%" or "-3.2%"
 */
export const formatContributionPercent = (value) => {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "";
  }
  const formatted = (value * 100).toFixed(1);
  return value >= 0 ? `+${formatted}%` : `${formatted}%`;
};
