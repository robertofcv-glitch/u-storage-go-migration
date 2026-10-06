/**
 * Google Distance Matrix Service
 * Calculates driving distance between two addresses using Google Maps API
 */

interface DistanceResult {
  distanceKm: number;
  durationMinutes: number;
  success: boolean;
  error?: string;
}

export async function calculateDistance(
  fromAddress: string,
  toAddress: string
): Promise<DistanceResult> {
  console.log(`[DistanceService] Calculating distance: "${fromAddress}" → "${toAddress}"`);
  
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  
  if (!apiKey) {
    console.warn('[DistanceService] GOOGLE_PLACES_API_KEY not configured, using fallback distance');
    return {
      distanceKm: 20,
      durationMinutes: 45,
      success: false,
      error: 'API key not configured'
    };
  }

  try {
    const url = new URL('https://maps.googleapis.com/maps/api/distancematrix/json');
    url.searchParams.set('origins', fromAddress);
    url.searchParams.set('destinations', toAddress);
    url.searchParams.set('mode', 'driving');
    url.searchParams.set('units', 'metric');
    url.searchParams.set('key', apiKey);

    console.log(`[DistanceService] Calling Google Distance Matrix API...`);
    const response = await fetch(url.toString());
    const data = await response.json();

    if (data.status !== 'OK') {
      console.error('[DistanceService] Distance Matrix API error:', data.status, data.error_message);
      return {
        distanceKm: 20,
        durationMinutes: 45,
        success: false,
        error: data.error_message || data.status
      };
    }

    const element = data.rows?.[0]?.elements?.[0];
    
    if (element?.status !== 'OK') {
      console.error('[DistanceService] Distance calculation failed:', element?.status);
      return {
        distanceKm: 20,
        durationMinutes: 45,
        success: false,
        error: element?.status || 'Unknown error'
      };
    }

    // Distance is returned in meters, convert to km
    const distanceKm = Math.round((element.distance.value / 1000) * 100) / 100;
    // Duration is returned in seconds, convert to minutes
    const durationMinutes = Math.round(element.duration.value / 60);

    console.log(`[DistanceService] SUCCESS: ${distanceKm}km, ${durationMinutes} min`);

    return {
      distanceKm,
      durationMinutes,
      success: true
    };
  } catch (error) {
    console.error('[DistanceService] Error:', error);
    return {
      distanceKm: 20,
      durationMinutes: 45,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}
