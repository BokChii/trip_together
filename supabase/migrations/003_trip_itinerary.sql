-- AI 여행 일정을 trip 단위로 저장·공유
ALTER TABLE public.trips ADD COLUMN IF NOT EXISTS itinerary text;

COMMENT ON COLUMN public.trips.itinerary IS 'AI-generated travel itinerary shared across trip participants';
