/**
 * Formats engagement metrics (likes, comments, shares, saves) into a readable string.
 * Numbers over 1000 are converted to K format (e.g., 1.5K).
 * 
 * @param count - The numeric count to format
 * @returns Formatted string representation of the count
 * 
 * @example
 * formatEngagementMetric(500) // returns "500"
 * formatEngagementMetric(1500) // returns "1.5K"
 * formatEngagementMetric(12345) // returns "12.3K"
 */
export function formatEngagementMetric(count: number): string {
  if (count > 1000) {
    return `${(count / 1000).toFixed(1)}K`;
  }
  return count.toLocaleString();
}

/**
 * Formats property price with currency and listing type.
 * Adds "/year" suffix for rental properties.
 * 
 * @param price - The property price as a number
 * @param currency - Currency code (e.g., "AED", "USD")
 * @param listingType - Type of listing ("RENT" or "BUY")
 * @returns Formatted price string
 * 
 * @example
 * formatPrice(2500000, "AED", "RENT") // returns "AED 2,500,000/year"
 * formatPrice(2500000, "AED", "BUY") // returns "AED 2,500,000"
 */
export function formatPrice(price: number, currency: string, listingType: string): string {
  const formattedPrice = `${currency} ${price.toLocaleString()}`;
  return listingType === 'RENT' ? `${formattedPrice}/year` : formattedPrice;
}

/**
 * Formats location by combining area and city with a comma separator.
 * 
 * @param area - The area/neighborhood name
 * @param city - The city name
 * @returns Formatted location string
 * 
 * @example
 * formatLocation("Dubai Marina", "Dubai") // returns "Dubai Marina, Dubai"
 * formatLocation("Downtown", "Abu Dhabi") // returns "Downtown, Abu Dhabi"
 */
export function formatLocation(area: string, city: string): string {
  return `${area}, ${city}`;
}
