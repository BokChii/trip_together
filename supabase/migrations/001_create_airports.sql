-- airports 테이블: 공항/도시 검색용
CREATE TABLE IF NOT EXISTS airports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  iata_code VARCHAR(3) NOT NULL,
  name_en VARCHAR(255) NOT NULL,
  city_en VARCHAR(255),
  country_code VARCHAR(2),
  name_ko VARCHAR(255),
  city_ko VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- IATA 코드 유니크 (동일 도시 여러 공항은 별도 행)
CREATE UNIQUE INDEX IF NOT EXISTS idx_airports_iata_unique ON airports(iata_code);

-- 검색용 인덱스: IATA, 영문명, 한글명
CREATE INDEX IF NOT EXISTS idx_airports_iata ON airports(iata_code);
CREATE INDEX IF NOT EXISTS idx_airports_name_en ON airports(name_en);
CREATE INDEX IF NOT EXISTS idx_airports_city_en ON airports(city_en);
CREATE INDEX IF NOT EXISTS idx_airports_name_ko ON airports(name_ko) WHERE name_ko IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_airports_city_ko ON airports(city_ko) WHERE city_ko IS NOT NULL;

-- RLS: anon 읽기 허용 (공항 데이터는 공개)
ALTER TABLE airports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access on airports"
  ON airports FOR SELECT
  TO anon
  USING (true);
