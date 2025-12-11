// 마크다운 처리 유틸리티

/**
 * 마크다운을 완전히 제거하고 일반 텍스트로 변환하는 함수
 * 서비스 가벼움을 위해 HTML 변환 대신 제거만 수행
 */
export const removeMarkdown = (text: string): string => {
  if (!text) return text;

  let cleaned = text;

  // 코드 블록 제거 (먼저 처리)
  cleaned = cleaned.replace(/```[\s\S]*?```/g, '');
  
  // 인라인 코드 제거
  cleaned = cleaned.replace(/`([^`]+)`/g, '$1');
  
  // 구분선 제거 (---, ***, ___) - 줄 전체 또는 줄 중간
  cleaned = cleaned.replace(/^[-*_]{3,}\s*$/gm, '');
  cleaned = cleaned.replace(/\s*[-*_]{3,}\s*/g, ' ');
  
  // 헤더 제거 (# ## ### 등) - 이모지나 특수문자 포함
  cleaned = cleaned.replace(/^#{1,6}\s+(.+)$/gm, '$1');
  
  // 볼드 제거 (**text** 또는 __text__) - 여러 번 반복 처리 (중첩된 경우)
  let prevCleaned = '';
  while (prevCleaned !== cleaned) {
    prevCleaned = cleaned;
    cleaned = cleaned.replace(/\*\*([^*]+?)\*\*/g, '$1');
    cleaned = cleaned.replace(/__([^_]+?)__/g, '$1');
  }
  
  // 이탤릭 제거 (*text* 또는 _text_) - 볼드가 아닌 경우만
  cleaned = cleaned.replace(/(?<!\*)\*([^*\n]+?)\*(?!\*)/g, '$1');
  cleaned = cleaned.replace(/(?<!_)_([^_\n]+?)_(?!_)/g, '$1');
  
  // 링크 제거 [text](url) -> text
  cleaned = cleaned.replace(/\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // 이미지 제거 ![alt](url) -> alt
  cleaned = cleaned.replace(/!\[([^\]]+)\]\([^\)]+\)/g, '$1');
  
  // 리스트 기호 제거 (-, *, +) - 들여쓰기 포함
  cleaned = cleaned.replace(/^[\s]*[-*+]\s+/gm, '');
  
  // 번호 리스트 제거 (1. 2. 등)
  cleaned = cleaned.replace(/^\s*\d+\.\s+/gm, '');
  
  // 인용구 제거 (>)
  cleaned = cleaned.replace(/^>\s+/gm, '');
  
  // 테이블 관련 제거
  cleaned = cleaned.replace(/\|/g, ' ');
  cleaned = cleaned.replace(/:-+/g, '');
  
  // 불필요한 공백 정리
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.trim();

  return cleaned;
};

