/**
 * CATEGORIES and CITIES (with English + Gujarati names), Indian states and GST state codes.
 */
export interface CatalogItem {
  key: string;
  en: string;
  gu: string;
}

export const CATEGORIES = [
  { key: 'business', en: 'Business', gu: 'બિઝનેસ' },
  { key: 'marketing', en: 'Marketing', gu: 'માર્કેટિંગ' },
  { key: 'tech', en: 'Tech', gu: 'ટેક' },
  { key: 'finance', en: 'Finance', gu: 'ફાઇનાન્સ' },
  { key: 'real_estate', en: 'Real Estate', gu: 'રિયલ એસ્ટેટ' },
  { key: 'food', en: 'Food', gu: 'ફૂડ' },
  { key: 'fashion', en: 'Fashion', gu: 'ફેશન' },
  { key: 'beauty', en: 'Beauty', gu: 'બ્યુટી' },
  { key: 'health', en: 'Health', gu: 'હેલ્થ' },
  { key: 'fitness', en: 'Fitness', gu: 'ફિટનેસ' },
  { key: 'travel', en: 'Travel', gu: 'ટ્રાવેલ' },
  { key: 'education', en: 'Education', gu: 'એજ્યુકેશન' },
  { key: 'automobile', en: 'Automobile', gu: 'ઓટોમોબાઇલ' },
  { key: 'home_interior', en: 'Home & Interior', gu: 'હોમ & ઇન્ટિરિયર' },
  { key: 'local_business', en: 'Local Business', gu: 'લોકલ બિઝનેસ' },
  { key: 'entertainment', en: 'Entertainment', gu: 'એન્ટરટેઇનમેન્ટ' },
] as const satisfies readonly CatalogItem[];
export type CategoryKey = (typeof CATEGORIES)[number]['key'];
export const CATEGORY_KEYS = CATEGORIES.map((c) => c.key) as [CategoryKey, ...CategoryKey[]];

export const CITIES = [
  { key: 'ahmedabad', en: 'Ahmedabad', gu: 'અમદાવાદ' },
  { key: 'surat', en: 'Surat', gu: 'સુરત' },
  { key: 'vadodara', en: 'Vadodara', gu: 'વડોદરા' },
  { key: 'rajkot', en: 'Rajkot', gu: 'રાજકોટ' },
  { key: 'gandhinagar', en: 'Gandhinagar', gu: 'ગાંધીનગર' },
  { key: 'bhavnagar', en: 'Bhavnagar', gu: 'ભાવનગર' },
  { key: 'jamnagar', en: 'Jamnagar', gu: 'જામનગર' },
  { key: 'junagadh', en: 'Junagadh', gu: 'જૂનાગઢ' },
  { key: 'anand', en: 'Anand', gu: 'આણંદ' },
  { key: 'nadiad', en: 'Nadiad', gu: 'નડિયાદ' },
  { key: 'mehsana', en: 'Mehsana', gu: 'મહેસાણા' },
  { key: 'bharuch', en: 'Bharuch', gu: 'ભરૂચ' },
  { key: 'navsari', en: 'Navsari', gu: 'નવસારી' },
  { key: 'valsad', en: 'Valsad', gu: 'વલસાડ' },
  { key: 'vapi', en: 'Vapi', gu: 'વાપી' },
  { key: 'morbi', en: 'Morbi', gu: 'મોરબી' },
  { key: 'porbandar', en: 'Porbandar', gu: 'પોરબંદર' },
  { key: 'bhuj', en: 'Bhuj', gu: 'ભુજ' },
  { key: 'other_gujarat', en: 'Other (Gujarat)', gu: 'અન્ય (ગુજરાત)' },
  { key: 'mumbai', en: 'Mumbai', gu: 'મુંબઈ' },
  { key: 'other_india', en: 'Other (India)', gu: 'અન્ય (ભારત)' },
] as const satisfies readonly CatalogItem[];
export type CityKey = (typeof CITIES)[number]['key'];
export const CITY_KEYS = CITIES.map((c) => c.key) as [CityKey, ...CityKey[]];

/** GST state codes. Bluenova is registered in Gujarat (24). */
export const INDIAN_STATES = [
  { code: '01', name: 'Jammu & Kashmir' }, { code: '02', name: 'Himachal Pradesh' },
  { code: '03', name: 'Punjab' }, { code: '04', name: 'Chandigarh' },
  { code: '05', name: 'Uttarakhand' }, { code: '06', name: 'Haryana' },
  { code: '07', name: 'Delhi' }, { code: '08', name: 'Rajasthan' },
  { code: '09', name: 'Uttar Pradesh' }, { code: '10', name: 'Bihar' },
  { code: '11', name: 'Sikkim' }, { code: '12', name: 'Arunachal Pradesh' },
  { code: '13', name: 'Nagaland' }, { code: '14', name: 'Manipur' },
  { code: '15', name: 'Mizoram' }, { code: '16', name: 'Tripura' },
  { code: '17', name: 'Meghalaya' }, { code: '18', name: 'Assam' },
  { code: '19', name: 'West Bengal' }, { code: '20', name: 'Jharkhand' },
  { code: '21', name: 'Odisha' }, { code: '22', name: 'Chhattisgarh' },
  { code: '23', name: 'Madhya Pradesh' }, { code: '24', name: 'Gujarat' },
  { code: '26', name: 'Dadra & Nagar Haveli and Daman & Diu' }, { code: '27', name: 'Maharashtra' },
  { code: '29', name: 'Karnataka' }, { code: '30', name: 'Goa' },
  { code: '31', name: 'Lakshadweep' }, { code: '32', name: 'Kerala' },
  { code: '33', name: 'Tamil Nadu' }, { code: '34', name: 'Puducherry' },
  { code: '35', name: 'Andaman & Nicobar Islands' }, { code: '36', name: 'Telangana' },
  { code: '37', name: 'Andhra Pradesh' }, { code: '38', name: 'Ladakh' },
] as const;
export const STATE_CODES = INDIAN_STATES.map((s) => s.code) as [string, ...string[]];
export const BLUENOVA_STATE_CODE = '24';

export function catalogLabel(list: readonly CatalogItem[], key: string, lang: 'gu' | 'en'): string {
  const item = list.find((i) => i.key === key);
  return item ? item[lang] : key;
}
