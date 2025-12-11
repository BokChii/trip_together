// 입력 검증 및 프롬프트 인젝션 방지 유틸리티

// 금지 키워드 목록
const FORBIDDEN_KEYWORDS = [
  'api key', 'api_key', 'apikey', 'api-key',
  'password', 'secret', 'token',
  'ignore', 'forget', '무시', '잊어',
  'system', 'admin', 'root',
  'prompt', 'instruction', '지시',
  'tell me', '알려줘', '말해줘',
  'show me', '보여줘', '공개',
];

// 프롬프트 인젝션 패턴
const INJECTION_PATTERNS = [
  /ignore\s+(previous|all|above)/i,
  /forget\s+(previous|all|above)/i,
  /무시\s*(해|하세요|하라)/i,
  /잊어\s*(버려|버리세요)/i,
  /system\s*:/i,
  /user\s*:/i,
  /assistant\s*:/i,
];

// 입력 검증 함수
export const validateDestination = (input: string): { valid: boolean; error?: string } => {
  // 1. 길이 검증
  if (!input || input.trim().length === 0) {
    return { valid: false, error: '여행지를 입력해주세요.' };
  }
  
  if (input.length > 100) {
    return { valid: false, error: '여행지는 100자 이하로 입력해주세요.' };
  }

  // 2. 금지 키워드 검사
  const lowerInput = input.toLowerCase();
  for (const keyword of FORBIDDEN_KEYWORDS) {
    if (lowerInput.includes(keyword.toLowerCase())) {
      return { valid: false, error: '부적절한 입력이 감지되었습니다. 여행지 이름만 입력해주세요.' };
    }
  }

  // 3. 프롬프트 인젝션 패턴 검사
  for (const pattern of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return { valid: false, error: '부적절한 입력이 감지되었습니다. 여행지 이름만 입력해주세요.' };
    }
  }

  // 4. 특수 문자 과다 사용 검사 (프롬프트 인젝션 시도 가능성)
  const specialCharCount = (input.match(/[<>{}[\]\\|`]/g) || []).length;
  if (specialCharCount > 3) {
    return { valid: false, error: '부적절한 입력이 감지되었습니다.' };
  }

  return { valid: true };
};

// 입력 sanitization (안전하게 정리)
export const sanitizeDestination = (input: string): string => {
  // 앞뒤 공백 제거
  let sanitized = input.trim();
  
  // 연속된 공백을 하나로
  sanitized = sanitized.replace(/\s+/g, ' ');
  
  // 길이 제한
  if (sanitized.length > 100) {
    sanitized = sanitized.substring(0, 100);
  }
  
  return sanitized;
};

