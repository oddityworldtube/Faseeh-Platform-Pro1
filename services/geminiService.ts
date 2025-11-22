
import { GoogleGenAI, Type } from "@google/genai";
import { ContentType, Quiz, QuizConfig, SummaryPoint, QuestionType, Flashcard, DifficultyLevel, QuizResult } from "../types";

const ENV_API_KEY = process.env.API_KEY || '';

const getClient = (apiKey?: string) => {
  return new GoogleGenAI({ apiKey: apiKey || ENV_API_KEY });
};

export const processContentToFusha = async (
  type: ContentType,
  data: string | string[], 
  config: { apiKey?: string; model: string },
  mimeType?: string
): Promise<string> => {
  const ai = getClient(config.apiKey);
  let contents: any = [];
  let tools: any[] = [];

  let actualData: any = data;
  let customInstructions = '';
  let negativeInstructions = '';
  
  if (!Array.isArray(data) && typeof data === 'string') {
      try {
          const parsed = JSON.parse(data);
          if (parsed.isWrapper) {
             actualData = parsed.content;
             customInstructions = parsed.customInstructions || '';
             negativeInstructions = parsed.negativeInstructions || '';
          }
      } catch (e) {
      }
  }

  const baseInstruction = `
    أنت مصمم تعليمي ومحرر محتوى محترف.
    المهمة: تحويل المحتوى المدخل إلى درس تعليمي تفاعلي وجذاب بصرياً.
    قواعد الهيكلة والتصميم:
    1. العناوين الكبيرة: (#) للرئيسي و (##) للفرعي.
    2. الجداول: ضرورية للمقارنات والبيانات.
    3. البطاقات: استخدم Blockquote للمفاهيم الهامة.
    4. التنسيق: استخدم الخط العريض والقوائم.
  `;
  
  const globalInstructionBlock = `
    **توجيهات هامة:**
    ${customInstructions}
    **تجنب:**
    ${negativeInstructions}
  `;

  let userPrompt = `قم بمعالجة المحتوى وتنسيقه كدرس تعليمي احترافي:`;

  if (type === ContentType.TOPIC) {
      let topicData: any = actualData;
      if (typeof topicData === 'string') {
          try { topicData = JSON.parse(topicData); } catch(e) {}
      }
      const finalCustom = customInstructions || topicData.customInstructions || '';
      const finalNegative = negativeInstructions || topicData.negativeInstructions || '';

      userPrompt = `
        أنشئ درس تعليمي شامل من الصفر:
        - العنوان: ${topicData.lessonName}
        - المادة: ${topicData.subject}
        - الصف: ${topicData.gradeLevel}
        - المنهج: ${topicData.curriculum}
        
        ${finalCustom}
        ${finalNegative}
      `;
  } else if (type === ContentType.YOUTUBE && typeof actualData === 'string' && actualData.startsWith('http')) {
     userPrompt = `
       رابط فيديو يوتيوب: ${actualData}
       استخدم Google Search لفهم الفيديو واكتب درساً شاملاً عنه.
       ${globalInstructionBlock}
     `;
     tools = [{ googleSearch: {} }]; 
     contents = [{ text: baseInstruction + "\n" + userPrompt }];
     
  } else if (type === ContentType.TEXT || type === ContentType.YOUTUBE) {
    contents = [{ text: baseInstruction + "\n" + globalInstructionBlock + "\n" + userPrompt + "\n" + (actualData as string) }];

  } else if (type === ContentType.AUDIO) {
    const audioPart = {
        inlineData: {
            mimeType: mimeType || 'audio/mp3',
            data: actualData as string
        }
    };
    contents = [
        { text: baseInstruction + "\n" + globalInstructionBlock + "\n" + "قم بتفريغ الصوت، تصحيحه لغوياً، وتنظيمه كدرس." },
        audioPart
    ];
  } else if (type === ContentType.IMAGE || type === ContentType.PDF) {
    const images = Array.isArray(actualData) ? actualData : [actualData as string];
    const imageParts = images.map(img => ({
      inlineData: { mimeType: mimeType || 'image/jpeg', data: img }
    }));
    contents = [
      { text: baseInstruction + "\n" + globalInstructionBlock + "\n" + userPrompt },
      ...imageParts
    ];
  }
  
  if (type === ContentType.TOPIC) {
      contents = [{ text: baseInstruction + "\n" + userPrompt }];
  }

  const response = await ai.models.generateContent({
    model: config.model,
    contents: contents,
    config: { temperature: 0.3, tools: tools.length > 0 ? tools : undefined }
  });

  return response.text || "عذراً، لم أتمكن من معالجة المحتوى.";
};

export const generateSummary = async (text: string, config: { apiKey?: string; model: string }): Promise<SummaryPoint[]> => {
  const ai = getClient(config.apiKey);
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        point: { type: Type.STRING },
        explanation: { type: Type.STRING }
      },
      required: ["point", "explanation"]
    }
  };

  const response = await ai.models.generateContent({
    model: config.model,
    contents: `لخص الدرس في نقاط رئيسية (Term + Explanation). النص: ${text.substring(0, 20000)}`,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const generateFlashcards = async (text: string, config: { apiKey?: string; model: string }): Promise<Flashcard[]> => {
  const ai = getClient(config.apiKey);
  const schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        front: { type: Type.STRING },
        back: { type: Type.STRING }
      },
      required: ["front", "back"]
    }
  };

  const response = await ai.models.generateContent({
    model: config.model,
    contents: `أنشئ بطاقات تعليمية (سؤال/مصطلح وإجابة/تعريف). النص: ${text.substring(0, 20000)}`,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const generateMindMap = async (text: string, config: { apiKey?: string; model: string }): Promise<string> => {
    const ai = getClient(config.apiKey);
    const response = await ai.models.generateContent({
        model: config.model,
        contents: `أنشئ كود Mermaid.js (mindmap) لهذا الدرس. استخدم العربية أو الإنجليزية حسب لغة الدرس. النص: ${text.substring(0, 20000)}`,
        config: { temperature: 0.2 }
    });
    let code = response.text || "";
    return code.replace(/```mermaid/g, "").replace(/```/g, "").trim();
};

export const generateQuiz = async (text: string, quizConfig: QuizConfig, aiConfig: { apiKey?: string; model: string }): Promise<Quiz> => {
  const ai = getClient(aiConfig.apiKey);
  
  const schema = {
    type: Type.OBJECT,
    properties: {
      title: { type: Type.STRING },
      questions: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.INTEGER },
            text: { type: Type.STRING },
            type: { 
                type: Type.STRING, 
                enum: [
                    QuestionType.TRUE_FALSE, 
                    QuestionType.MULTIPLE_CHOICE, 
                    QuestionType.SHORT_ANSWER, 
                    QuestionType.FILL_BLANKS, 
                    QuestionType.ORDERING, 
                    QuestionType.MATCHING
                ] 
            },
            options: { type: Type.ARRAY, items: { type: Type.STRING } },
            matches: { 
                type: Type.ARRAY, 
                items: { 
                    type: Type.OBJECT, 
                    properties: { left: {type: Type.STRING}, right: {type: Type.STRING} } 
                } 
            },
            correctAnswer: { type: Type.STRING }, 
            explanation: { type: Type.STRING }
          },
          required: ["id", "text", "type", "correctAnswer", "explanation"]
        }
      }
    },
    required: ["title", "questions"]
  };

  const difficultyPrompt = {
      [DifficultyLevel.EASY]: "أسئلة مباشرة وسهلة، تركز على التعريفات والمفاهيم الأساسية.",
      [DifficultyLevel.MEDIUM]: "أسئلة متوسطة الصعوبة تتطلب بعض الفهم والربط.",
      [DifficultyLevel.HARD]: "أسئلة صعبة تتطلب استنتاجاً وتحليلاً عميقاً، وتجنب الأسئلة المباشرة."
  }[quizConfig.difficulty];

  let prompt = `
    قم بإنشاء اختبار تعليمي بناءً على النص المقدم.
    مستوى الصعوبة: ${difficultyPrompt}
    
    تعليمات أنواع الأسئلة (Strict Rules):
    1. ${QuestionType.MULTIPLE_CHOICE}: ضع السؤال في 'text'، الخيارات في 'options'، والإجابة الصحيحة في 'correctAnswer'.
    2. ${QuestionType.FILL_BLANKS}: ضع الجملة في 'text' مع وضع [____] مكان الكلمة الناقصة. الكلمة الناقصة تكون في 'correctAnswer'.
    3. ${QuestionType.ORDERING}: ضع السؤال في 'text'. ضع الخطوات *مرتبة بشكل صحيح* في مصفوفة JSON stringified داخل 'correctAnswer'. ضع الخطوات *مبعثرة* في 'options'.
    4. ${QuestionType.MATCHING}: ضع السؤال في 'text'. عبئ مصفوفة 'matches' بالأزواج الصحيحة (left, right).
    
    هام جداً:
    إذا كان عدد الأسئلة المطلوب كبيراً مقارنة بحجم النص:
    1. قم بصياغة أسئلة مختلفة لنفس المعلومة (مثلاً مرة صح وخطأ ومرة اختياري).
    2. ركز على التفاصيل الدقيقة.
    3. قم بإنشاء سيناريوهات تطبيقية.
    
    المطلوب:
  `;

  if (quizConfig.mode === 'COMPREHENSIVE') {
      prompt += `
      أنشئ 20 سؤالاً متنوعاً وشاملاً يغطي جميع جوانب الدرس. نوع بين الاختياري، صح وخطأ، وأكمل الفراغ.
      `;
  } else {
      const reqs = [];
      Object.entries(quizConfig.typeCounts).forEach(([type, count]) => {
          if(count > 0) reqs.push(`${count} أسئلة من نوع ${type}`);
      });
      prompt += `أنشئ الأسئلة التالية بالضبط: ${reqs.join("، ")}.`;
  }
  
  prompt += `\nالنص: ${text.substring(0, 30000)}`;

  const response = await ai.models.generateContent({
    model: aiConfig.model,
    contents: prompt,
    config: { responseMimeType: "application/json", responseSchema: schema, temperature: 0.4 }
  });

  try {
    const data = JSON.parse(response.text || "{}");
    return data as Quiz;
  } catch (e) {
    console.error("Failed to parse quiz JSON", e);
    throw new Error("فشل في إنشاء الاختبار");
  }
};

export const analyzeQuizPerformance = async (result: QuizResult, studentName: string, aiConfig: { apiKey?: string; model: string }): Promise<string> => {
    const ai = getClient(aiConfig.apiKey);
    
    const prompt = `
    أنت مرشد أكاديمي ومدرس خصوصي ذكي.
    اسم الطالب: ${studentName || 'الطالب'}.
    خاطب الطالب باسمه وشجعه بأسلوب تربوي محفز.
    
    قام الطالب بإجراء اختبار وحصل على ${result.score} من ${result.total}.
    
    تفاصيل الأخطاء:
    ${result.details.filter(d => !d.isCorrect).map(d => `- السؤال: ${d.questionText}\n  إجابة الطالب: ${d.userAnswer}\n  الصواب: ${d.correctAnswer}`).join('\n')}
    
    المطلوب:
    1. تحليل سريع لنقاط ضعف الطالب بناءً على الأخطاء.
    2. نصيحة تربوية مشجعة لتحسين مستواه.
    3. إذا كانت الدرجة كاملة، قدم تهنئة خاصة وحماسية بالاسم.
    
    اجعل الرد موجزاً (لا يتجاوز 100 كلمة) وشخصياً.
    `;

    const response = await ai.models.generateContent({
        model: aiConfig.model,
        contents: prompt
    });

    return response.text || "أحسنت المحاولة! راجع الدرس مرة أخرى لتعزيز المعلومات.";
};

export const chatWithLesson = async (
    context: string, 
    message: string, 
    studentName: string, 
    config: { apiKey?: string; model: string }, 
    history: any[] = [],
    image?: { data: string, mimeType: string }
) => {
  const ai = getClient(config.apiKey);
  const chat = ai.chats.create({
    model: config.model,
    config: { systemInstruction: `أنت مدرس خصوصي يدعى "فصيح". اسم الطالب هو "${studentName || 'يا بطل'}". خاطبه باسمه دائماً وكن ودوداً جداً. اشرح بالعربية. الدرس: ${context.substring(0, 20000)}` },
    history: history
  });
  
  let msgContent: any = { text: message };
  
  if (image) {
      msgContent = {
          parts: [
              { text: message },
              { inlineData: { mimeType: image.mimeType, data: image.data } }
          ]
      };
  }

  const result = await chat.sendMessage({ message: msgContent });
  return result.text;
};
