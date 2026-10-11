/**
 * Formats a number to Indian Rupee representation (e.g. ₹1,499)
 */
export function formatINR(amount: number): string {
  return `₹${Math.round(amount).toLocaleString('en-IN')}`;
}

/**
 * Calculates absolute savings and percentage
 */
export function getDealSavings(originalPrice: number, dealPrice: number): {
  savingsAmount: number;
  savingsPercent: number;
} {
  const savingsAmount = Math.max(0, originalPrice - dealPrice);
  const savingsPercent = originalPrice > 0 
    ? Math.round((savingsAmount / originalPrice) * 100) 
    : 0;
  return { savingsAmount, savingsPercent };
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    } else {
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      const successful = document.execCommand('copy');
      textArea.remove();
      return successful;
    }
  } catch (err) {
    console.error('Failed to copy to clipboard', err);
    return false;
  }
}
