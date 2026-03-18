-- 시드 데이터: 주요 공항 (한글명 포함)
-- Supabase SQL Editor에서 001_create_airports.sql 실행 후 이 파일 실행

INSERT INTO airports (iata_code, name_en, city_en, country_code, name_ko, city_ko) VALUES
-- 한국
('ICN', 'Incheon International', 'Seoul', 'KR', '인천국제공항', '서울'),
('GMP', 'Gimpo International', 'Seoul', 'KR', '김포국제공항', '서울'),
('CJU', 'Jeju International', 'Jeju', 'KR', '제주국제공항', '제주'),
('PUS', 'Gimhae International', 'Busan', 'KR', '김해국제공항', '부산'),
('TAE', 'Daegu International', 'Daegu', 'KR', '대구국제공항', '대구'),
('KWJ', 'Gwangju Airport', 'Gwangju', 'KR', '광주공항', '광주'),
-- 일본
('NRT', 'Narita International', 'Tokyo', 'JP', '나리타국제공항', '도쿄'),
('HND', 'Haneda International', 'Tokyo', 'JP', '하네다공항', '도쿄'),
('KIX', 'Kansai International', 'Osaka', 'JP', '간사이국제공항', '오사카'),
('ITM', 'Osaka International', 'Osaka', 'JP', '오사카국제공항', '오사카'),
('NGO', 'Chubu Centrair International', 'Nagoya', 'JP', '주부국제공항', '나고야'),
('FUK', 'Fukuoka Airport', 'Fukuoka', 'JP', '후쿠오카공항', '후쿠오카'),
('CTS', 'New Chitose Airport', 'Sapporo', 'JP', '신치토세공항', '삿포로'),
-- 동남아
('BKK', 'Suvarnabhumi Airport', 'Bangkok', 'TH', '수완나품공항', '방콕'),
('SIN', 'Singapore Changi', 'Singapore', 'SG', '싱가포르 창이', '싱가포르'),
('HKG', 'Hong Kong International', 'Hong Kong', 'HK', '홍콩국제공항', '홍콩'),
('DAD', 'Da Nang International', 'Da Nang', 'VN', '다낭국제공항', '다낭'),
('CEB', 'Mactan-Cebu International', 'Cebu', 'PH', '맥탄세부국제공항', '세부'),
('MNL', 'Ninoy Aquino International', 'Manila', 'PH', '니노이아키노국제공항', '마닐라'),
('HAN', 'Noi Bai International', 'Hanoi', 'VN', '노이바이국제공항', '하노이'),
('SGN', 'Tan Son Nhat International', 'Ho Chi Minh City', 'VN', '떤선녓국제공항', '호치민'),
('DPS', 'Ngurah Rai International', 'Bali', 'ID', '응우라라이국제공항', '발리'),
('KUL', 'Kuala Lumpur International', 'Kuala Lumpur', 'MY', '쿠알라룸푸르국제공항', '쿠알라룸푸르'),
-- 중국/대만
('PVG', 'Shanghai Pudong International', 'Shanghai', 'CN', '상하이푸둥국제공항', '상하이'),
('PEK', 'Beijing Capital International', 'Beijing', 'CN', '베이징서우두국제공항', '베이징'),
('TPE', 'Taiwan Taoyuan International', 'Taipei', 'TW', '타이완타오위안국제공항', '타이페이'),
-- 유럽
('LHR', 'London Heathrow', 'London', 'GB', NULL, '런던'),
('CDG', 'Charles de Gaulle', 'Paris', 'FR', NULL, '파리'),
('FRA', 'Frankfurt Airport', 'Frankfurt', 'DE', NULL, '프랑크푸르트'),
('AMS', 'Amsterdam Schiphol', 'Amsterdam', 'NL', NULL, '암스테르담'),
('MUC', 'Munich Airport', 'Munich', 'DE', NULL, '뮌헨'),
('FCO', 'Rome Fiumicino', 'Rome', 'IT', NULL, '로마'),
('MAD', 'Madrid-Barajas', 'Madrid', 'ES', NULL, '마드리드'),
('BCN', 'Barcelona El Prat', 'Barcelona', 'ES', NULL, '바르셀로나'),
-- 미국
('LAX', 'Los Angeles International', 'Los Angeles', 'US', NULL, '로스앤젤레스'),
('JFK', 'John F. Kennedy International', 'New York', 'US', NULL, '뉴욕'),
('SFO', 'San Francisco International', 'San Francisco', 'US', NULL, '샌프란시스코'),
('ORD', 'Chicago O''Hare International', 'Chicago', 'US', NULL, '시카고'),
('SEA', 'Seattle-Tacoma International', 'Seattle', 'US', NULL, '시애틀'),
('LGA', 'LaGuardia Airport', 'New York', 'US', NULL, '뉴욕'),
-- 오세아니아
('SYD', 'Sydney Kingsford Smith', 'Sydney', 'AU', NULL, '시드니'),
('MEL', 'Melbourne Airport', 'Melbourne', 'AU', NULL, '멜버른'),
-- 중동
('DXB', 'Dubai International', 'Dubai', 'AE', NULL, '두바이'),
('DOH', 'Hamad International', 'Doha', 'QA', NULL, '도하'),
-- 기타 아시아
('DEL', 'Indira Gandhi International', 'New Delhi', 'IN', NULL, '뉴델리'),
('BOM', 'Chhatrapati Shivaji International', 'Mumbai', 'IN', NULL, '뭄바이')
ON CONFLICT (iata_code) DO NOTHING;
