import { GoogleGenAI } from "@google/genai";
import { ItineraryRequest } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateItinerary = async (request: ItineraryRequest): Promise<string> => {
  const { destination, startDate, endDate } = request;

  const prompt = `
    ${destination}로 떠나는 단체 여행을 위한 재미있고 간결한 여행 일정을 짜줘.
    여행 기간은 ${startDate}부터 ${endDate}까지야.
    
    다음 내용을 포함해줘:
    1. 이 기간의 예상 날씨 요약.
    2. 일자별 주요 일정 (간결하게 핵심만).
    3. 이 지역의 "숨은 명소" 추천 하나.
    
    깔끔한 마크다운(Markdown) 형식으로 작성해줘. 이모지를 적절히 사용해서 여행 가는 기분이 들게 신나게 작성해줘.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text || "죄송합니다. 지금은 여행 일정을 생성할 수 없습니다.";
  } catch (error) {
    // console.error("Error generating itinerary:", error);
    return "AI 여행 플래너 연결 중 오류가 발생했습니다.";
  }
};