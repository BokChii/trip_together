// Amadeus API Access Token (flightSearchService, airportSearchService 공유)
let cachedToken: { token: string; expiresAt: number } | null = null;

export const getAmadeusAccessToken = async (): Promise<string> => {
  const apiKey = import.meta.env.VITE_AMADEUS_API_KEY;
  const apiSecret = import.meta.env.VITE_AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus API credentials are not configured');
  }

  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  const response = await fetch('https://api.amadeus.com/v1/security/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: apiKey,
      client_secret: apiSecret,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`);
  }

  const data = await response.json();
  const expiresIn = data.expires_in || 1799;
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  };
  return cachedToken.token;
};
