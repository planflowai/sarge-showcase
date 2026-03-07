/**
 * PII Injector — Post-Build Placeholder Replacement
 *
 * Replaces {{placeholder}} tokens in generated HTML with real client values.
 * Called after build completes and before deploy.
 */

export interface PIIData {
  phone?: string;
  email?: string;
  address?: string;
  name?: string;
  city?: string;
  state?: string;
  clientName?: string;
}

const PLACEHOLDER_MAP: Record<keyof PIIData, string[]> = {
  phone: ["{{phone}}", "{{PHONE}}"],
  email: ["{{email}}", "{{EMAIL}}"],
  address: ["{{address}}", "{{ADDRESS}}"],
  name: ["{{name}}", "{{NAME}}", "{{BUSINESS_NAME}}", "{{business_name}}"],
  city: ["{{city}}", "{{CITY}}"],
  state: ["{{state}}", "{{STATE}}"],
  clientName: ["{{client_name}}", "{{CLIENT_NAME}}"],
};

/**
 * Replace all PII placeholder tokens in HTML with real values.
 */
export function injectPII(html: string, piiData: PIIData): string {
  let result = html;

  for (const [key, placeholders] of Object.entries(PLACEHOLDER_MAP)) {
    const value = piiData[key as keyof PIIData];
    if (value) {
      for (const placeholder of placeholders) {
        result = result.split(placeholder).join(value);
      }
    }
  }

  return result;
}

/**
 * Count how many PII placeholders remain in the HTML.
 */
export function countPlaceholders(html: string): number {
  let count = 0;
  for (const placeholders of Object.values(PLACEHOLDER_MAP)) {
    for (const p of placeholders) {
      const matches = html.split(p).length - 1;
      count += matches;
    }
  }
  return count;
}
