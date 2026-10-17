/** DeepL character usage normalized for the admin UI. */
export interface DeepLUsage {
  characterCount: number;
  characterLimit: number;
  remainingCharacters: number;
  usagePercentage: number;
}