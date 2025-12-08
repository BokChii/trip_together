export type VoteType = 'available' | 'unavailable';

export interface DateVote {
  date: string; // ISO Date string YYYY-MM-DD
  userId: string;
  type: VoteType;
}

export interface User {
  id: string;
  name: string;
  trip_id: string; // DB 연동을 위해 추가
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  isToday: boolean;
  isoString: string;
}

export interface ItineraryRequest {
  destination: string;
  startDate: string;
  endDate: string;
}