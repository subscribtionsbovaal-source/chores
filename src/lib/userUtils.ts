import { User, UserHouseholdSettings } from '../types';

/**
 * Resolves the display name and color for a user within a specific household context.
 * It prioritizes household-specific overrides found in 'householdSettings'.
 */
export const getUserDisplayInfo = (user: User, householdId: string | undefined): { name: string; color: string } => {
  if (!householdId || !user.householdSettings || !user.householdSettings[householdId]) {
    return { name: user.name, color: user.color };
  }
  
  const settings = user.householdSettings[householdId];
  return {
    name: settings.name || user.name,
    color: settings.color || user.color
  };
};
