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
        throw new Error('API 호출 제한에 걸렸습니다. 잠시 후 다시 시도해주세요.');
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

    // 시간 계산
    const departureTime = new Date(firstSegment.departure.at);
    const arrivalTime = new Date(firstSegment.arrival.at);
    const durationMs = arrivalTime.getTime() - departureTime.getTime();
    const hours = Math.floor(durationMs / (1000 * 60 * 60));
    const minutes = Math.floor((durationMs % (1000 * 60 * 60)) / (1000 * 60));
    const duration = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;

    return {
      destination: destinationName,
      destinationCode: destination,
      price,
      currency,
      airline,
      departure: firstSegment.departure.at,
      arrival: firstSegment.arrival.at,
      duration,
      bookingUrl: `https://www.google.com/travel/flights?q=Flights%20${origin}%20to%20${destination}%20on%20${formattedDepartureDate}`, // Google Flights 링크
    };
  } catch (error) {
    console.error(`❌ Error searching flight ${origin} -> ${destination}:`, error);
    return null;
  }
};

// 날짜를 유효한 범위로 조정 (오늘부터 3개월 이내)
const adjustDateToValidRange = (dateString: string): string => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const maxDate = new Date(today);
  maxDate.setMonth(today.getMonth() + 3); // 3개월 후
  
  const inputDate = new Date(dateString);
  inputDate.setHours(0, 0, 0, 0);
  
  // 과거 날짜면 오늘로
  if (inputDate < today) {
    return today.toISOString().split('T')[0];
  }
  
  // 3개월을 넘으면 3개월 후로
  if (inputDate > maxDate) {
    return maxDate.toISOString().split('T')[0];
  }
  
  return dateString.split('T')[0];
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

  // 날짜 유효성 검사 및 조정 (3개월 이내로 제한)
  const adjustedDepartureDate = adjustDateToValidRange(departureDate);
  const adjustedReturnDate = returnDate ? adjustDateToValidRange(returnDate) : undefined;
  
  // 날짜가 조정되었는지 확인
  const originalDeparture = departureDate.split('T')[0];
  if (adjustedDepartureDate !== originalDeparture) {
    console.log(`📅 날짜 조정: ${originalDeparture} → ${adjustedDepartureDate} (3개월 이내로 제한)`);
  }

  // 배치 처리: 3개씩 나누어서 검색 (API 제한 방지)
  const BATCH_SIZE = 3;
  const batches: string[][] = [];
  for (let i = 0; i < searchDestinations.length; i += BATCH_SIZE) {
    batches.push(searchDestinations.slice(i, i + BATCH_SIZE));
  }

  const allFlights: FlightResult[] = [];

  // 배치별로 순차 처리
  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    const batchPromises = batch.map(dest =>
      searchFlight(origin, dest, adjustedDepartureDate, adjustedReturnDate)
    );

    const batchResults = await Promise.allSettled(batchPromises);
    
    const flights: FlightResult[] = batchResults
      .filter((r): r is PromiseFulfilledResult<FlightResult | null> => 
        r.status === 'fulfilled' && r.value !== null
      )
      .map(r => r.value as FlightResult);
    
    allFlights.push(...flights);

    // 마지막 배치가 아니면 딜레이 추가 (API 제한 방지)
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000)); // 1초 대기
    }
  }

  // 가격 오름차순 정렬
  return allFlights.sort((a, b) => a.price - b.price);
};
