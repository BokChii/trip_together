import { POPULAR_DESTINATIONS, findDestination, Destination } from '../utils/popularDestinations';

export interface FlightResult {
  destination: string;   // "제주도"
  destinationCode: string; // "CJU"
  price: number;        // 150000
  currency: string;     // "KRW"
  airline: string;      // "대한항공"
  departure: string;    // "2024-12-25T08:00"
  arrival: string;      // "2024-12-25T09:30"
  duration: string;     // "1h 30m"
  bookingUrl: string;   // 예약 링크
}

interface AmadeusFlightOffer {
  price: {
    total: string;
    currency: string;
  };
  itineraries: Array<{
    segments: Array<{
      departure: {
        iataCode: string;
        at: string;
      };
      arrival: {
        iataCode: string;
        at: string;
      };
      carrierCode: string;
      duration: string;
    }>;
  }>;
}

// Amadeus API Access Token 발급
let cachedToken: { token: string; expiresAt: number } | null = null;

const getAmadeusAccessToken = async (): Promise<string> => {
  const apiKey = import.meta.env.VITE_AMADEUS_API_KEY;
  const apiSecret = import.meta.env.VITE_AMADEUS_API_SECRET;

  if (!apiKey || !apiSecret) {
    throw new Error('Amadeus API credentials are not configured');
  }

  // 캐시된 토큰이 유효하면 재사용
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.token;
  }

  try {
    const response = await fetch('https://test.api.amadeus.com/v1/security/oauth2/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
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
    const expiresIn = data.expires_in || 1799; // 기본값 30분 - 1초
    
    cachedToken = {
      token: data.access_token,
      expiresAt: Date.now() + (expiresIn * 1000),
    };

    return cachedToken.token;
  } catch (error) {
    console.error('❌ Error getting Amadeus access token:', error);
    throw error;
  }
};

// 단일 목적지 항공권 검색
export const searchFlight = async (
  origin: string,
  destination: string,
  departureDate: string,
  returnDate?: string
): Promise<FlightResult | null> => {
  try {
    const accessToken = await getAmadeusAccessToken();
    
    // 날짜 형식 변환 (YYYY-MM-DD)
    const formattedDepartureDate = departureDate.split('T')[0];
    const formattedReturnDate = returnDate ? returnDate.split('T')[0] : undefined;

    const url = new URL('https://test.api.amadeus.com/v2/shopping/flight-offers');
    url.searchParams.append('originLocationCode', origin.toUpperCase());
    url.searchParams.append('destinationLocationCode', destination.toUpperCase());
    url.searchParams.append('departureDate', formattedDepartureDate);
    url.searchParams.append('adults', '1');
    url.searchParams.append('max', '1'); // 최저가 1개만
    
    if (formattedReturnDate) {
      url.searchParams.append('returnDate', formattedReturnDate);
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });

    if (!response.ok) {
      // 에러 응답 본문 읽기
      let errorMessage = response.statusText;
      let errorDetails: any = null;
      try {
        const errorData = await response.json();
        errorDetails = errorData;
        errorMessage = errorData.errors?.[0]?.detail || errorData.error_description || response.statusText;
        if (response.status === 400) {
          console.warn(`⚠️ Invalid request for ${origin} -> ${destination} on ${formattedDepartureDate}:`, errorMessage, errorData);
        }
      } catch (e) {
        // JSON 파싱 실패 시 기본 메시지 사용
      }

      if (response.status === 404 || response.status === 400) {
        // 해당 날짜/목적지에 항공편이 없는 경우
        return null;
      }
      
      if (response.status === 429) {
        console.warn(`⚠️ Rate limit exceeded for ${origin} -> ${destination}`);
        // 429 에러는 즉시 throw하여 상위에서 처리
        const rateLimitError = new Error('API 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.');
        (rateLimitError as any).isRateLimit = true;
        throw rateLimitError;
      }
      
      throw new Error(`Flight search failed: ${errorMessage}`);
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return null;
    }

    const offer: AmadeusFlightOffer = data.data[0];
    const firstSegment = offer.itineraries[0]?.segments[0];
    
    if (!firstSegment) {
      return null;
    }

    const destinationInfo = findDestination(destination);
    const destinationName = destinationInfo?.name || destination;

    // 항공사 코드를 이름으로 변환 (간단한 매핑)
    const airlineNames: Record<string, string> = {
      'KE': '대한항공',
      'OZ': '아시아나항공',
      '7C': '제주항공',
      'TW': '티웨이항공',
      'LJ': '진에어',
      'BX': '에어부산',
      '5J': '필리핀항공',
      'NH': '전일본공수',
      'JL': '일본항공',
    };

    const airlineCode = firstSegment.carrierCode;
    const airline = airlineNames[airlineCode] || airlineCode;

    // 가격 파싱
    const price = parseFloat(offer.price.total);
    const currency = offer.price.currency;

    // EUR를 KRW로 변환 (환율: 대략 1 EUR = 1,400 KRW)
    let finalPrice = price;
    let finalCurrency = currency;
    if (currency === 'EUR') {
      const EUR_TO_KRW_RATE = 1400; // 예시 환율 (실제로는 동적 환율 사용 권장)
      finalPrice = Math.round(price * EUR_TO_KRW_RATE);
      finalCurrency = 'KRW';
    }

    // 시간 계산
    const departureTime = new Date(firstSegment.departure.at);
    const arrivalTime = new Date(firstSegment.arrival.at);
    const durationMs = arrivalTime.getTime() - departureTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    // Google Flights 링크 생성 (왕복일 경우 귀국일 포함)
    let bookingUrl = `https://www.google.com/travel/flights?q=Flights%20${origin}%20to%20${destination}%20on%20${formattedDepartureDate}`;
    if (formattedReturnDate) {
      bookingUrl = `https://www.google.com/travel/flights?q=Flights%20${origin}%20to%20${destination}%20on%20${formattedDepartureDate}%20returning%20${formattedReturnDate}`;
    }

    return {
      destination: destinationName,
      destinationCode: destination,
      price: finalPrice,
      currency: finalCurrency,
      airline,
      departure: firstSegment.departure.at,
      arrival: firstSegment.arrival.at,
      duration,
      bookingUrl,
    };
  } catch (error: any) {
    // Rate limit 에러는 다시 throw
    if (error?.isRateLimit) {
      throw error;
    }
    console.error(`❌ Error searching flight ${origin} -> ${destination}:`, error);
    return null;
  }
};

// 여러 목적지에 대해 병렬 검색 후 최저가 순 정렬
export const searchCheapestFlights = async (
  departureDate: string,
  returnDate?: string,
  origin: string = 'ICN',
  destinations?: string[]
): Promise<FlightResult[]> => {
  // 목적지가 지정되지 않으면 인기 여행지 전체 사용
  const searchDestinations = destinations || POPULAR_DESTINATIONS.map(d => d.code);

  // 사용자가 선택한 날짜를 그대로 사용 (날짜 조정 로직 제거)
  // API가 날짜 범위를 제한한다면, API가 에러를 반환할 것이고 그때 처리하면 됨

  // 배치 처리: 2개씩 나누어서 검색 (API 제한 방지)
  const BATCH_SIZE = 2;
  const batches: string[][] = [];
  for (let i = 0; i < searchDestinations.length; i += BATCH_SIZE) {
    batches.push(searchDestinations.slice(i, i + BATCH_SIZE));
  }

  const allFlights: FlightResult[] = [];
  let rateLimitHit = false;

  // 배치별로 순차 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    // Rate limit에 걸렸으면 중단
    if (rateLimitHit) {
      console.warn('⚠️ Rate limit에 걸려 검색을 중단합니다.');
      break;
    }

    const batch = batches[batchIndex];
    const batchPromises = batch.map(dest =>
      searchFlight(origin, dest, departureDate, returnDate)
    );

    const batchResults = await Promise.allSettled(batchPromises);
    
    // 429 에러 확인
    const hasRateLimit = batchResults.some(r => 
      r.status === 'rejected' && 
      (r.reason as any)?.isRateLimit === true
    );
    
    if (hasRateLimit) {
      rateLimitHit = true;
      console.warn('⚠️ Rate limit 감지 - 검색 중단');
      break;
    }
    
    const flights: FlightResult[] = batchResults
      .filter((r): r is PromiseFulfilledResult<FlightResult | null> => 
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as FlightResult);
    
    allFlights.push(...flights);

    // 마지막 배치가 아니면 딜레이 추가 (API 제한 방지)
    if (batchIndex < batches.length - 1 && !rateLimitHit) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2초 대기 (더 긴 딜레이)
    }
  }
  
  if (rateLimitHit && allFlights.length === 0) {
    throw new Error('API 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.');
  }

  // 가격 오름차순 정렬
  return allFlights.sort((a, b) => a.price - b.price);
};
