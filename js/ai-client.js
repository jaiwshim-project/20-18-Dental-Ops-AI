/**
 * AI 클라이언트 - 프론트엔드에서 AI API 호출
 * 자동으로 사용 가능한 AI 모델 선택
 */

const AIClient = {
  /**
   * AI로 텍스트 생성
   * @param {string} prompt - 프롬프트
   * @param {object} options - 옵션 (model, temperature, maxTokens)
   * @returns {Promise<{success, model, text, usage}>}
   */
  async generate(prompt, options = {}) {
    try {
      console.log('[AIClient] 요청:', { promptLength: prompt.length, options });

      const response = await fetch('/api/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, options })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'AI 호출 실패');
      }

      const result = await response.json();
      console.log('[AIClient] ✅ 완료:', { model: result.model, textLength: result.text.length });
      return result;

    } catch (e) {
      console.error('[AIClient] ❌ 에러:', e.message);
      throw e;
    }
  },

  /**
   * 병원 상담 분석
   * @param {string} consultText - 상담 내용
   * @returns {Promise<string>} 분석 결과
   */
  async analyzeConsultation(consultText) {
    const prompt = `다음 치과 상담 내용을 분석하여 핵심 내용을 요약해주세요:

${consultText}

분석 항목:
1. 주요 문제점
2. 진단 결과
3. 권장 치료법
4. 예방 조치`;

    const result = await this.generate(prompt, {
      temperature: 0.5,
      maxTokens: 1024
    });

    return result.text;
  },

  /**
   * 진단 보고서 생성
   * @param {object} patient - 환자 정보
   * @param {string} diagnosis - 진단 내용
   * @returns {Promise<string>} 보고서
   */
  async generateDiagnosisReport(patient, diagnosis) {
    const prompt = `다음 정보로 치과 진단 보고서를 작성해주세요:

환자명: ${patient.name}
나이: ${patient.age}
주증상: ${patient.symptom}

진단 내용:
${diagnosis}

보고서는 의료진을 위한 공식 문서 형식으로 작성해주세요.`;

    const result = await this.generate(prompt, {
      temperature: 0.3,
      maxTokens: 2048
    });

    return result.text;
  },

  /**
   * 교육 자료 생성
   * @param {string} topic - 주제
   * @param {string} level - 난이도 (basic, intermediate, advanced)
   * @returns {Promise<string>} 교육 자료
   */
  async generateEducationalMaterial(topic, level = 'intermediate') {
    const prompt = `${level} 수준의 치과 환자 교육 자료를 작성해주세요:

주제: ${topic}
난이도: ${level}

다음 형식으로 작성:
1. 개요 (100자 이내)
2. 주요 내용 (3-5개 항목)
3. 주의사항 (2-3개)
4. 추가 정보`;

    const result = await this.generate(prompt, {
      temperature: 0.6,
      maxTokens: 1500
    });

    return result.text;
  },

  /**
   * 현재 사용 중인 AI 모델 확인
   * @returns {Promise<{availableModels, selectedModel}>}
   */
  async checkAvailableModels() {
    try {
      const response = await fetch('/api/ai-status');
      if (response.ok) {
        return await response.json();
      }
      return { message: 'AI 상태 확인 불가' };
    } catch (e) {
      console.error('[AIClient] 모델 확인 실패:', e.message);
      return { error: e.message };
    }
  }
};

// 전역 객체에 등록
if (typeof window !== 'undefined') {
  window.AIClient = AIClient;
}

// 모듈 내보내기 (필요시)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = AIClient;
}
