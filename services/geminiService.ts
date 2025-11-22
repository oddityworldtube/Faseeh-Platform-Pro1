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

  // ====== البرومبت الأساسي المُحسن (الخبير التعليمي) ======
  const baseInstruction = `
    أنت مصمم تعليمي خبير (Master Instructional Designer) ومدرب محترف بخبرة 50 عاماً في التعليم الأكاديمي.
    المهمة: تحويل المحتوى إلى درس منهجي متكامل، مُنظم بشكل صارم وفقاً للهيكلية المنهجية الخماسية، مع ضمان أعلى قيمة علمية وتبسيط ذكي للمعلومات المعقدة.

    **قواعد الهيكلة المنهجية الخماسية (الالتزام بالترتيب، العمق، والتبسيط):**
    
    # 1. الأهداف التعليمية (Targeted Learning Outcomes)
    *   صغ 3-5 أهداف محددة وقابلة للقياس، تغطي مستويات بلوم (المعرفة، الفهم، التطبيق).
    *   يجب أن تبدأ الأهداف بعبارات موجهة للطالب (مثلاً: "في نهاية الدرس، سيتمكن الطالب من أن...").

    # 2. المقدمة والربط المعرفي (Diagnostic Hook & Prior Knowledge Link)
    *   قدم سيناريو واقعي أو قصة قوية لجذب انتباه الطالب.
    *   اطرح سؤالاً تشخيصياً (Diagnostic Question) لتقييم معرفته السابقة بالدرس.

    # 3. الشرح العميق والتبسيط الذكي (Deep Instruction & Intelligent Simplification)
    *   استخدم عناوين فرعية رئيسية (##) لتقسيم الموضوع منطقياً.
    *   **التبسيط:** استخدم التشبيهات (Analogies) والأمثلة من الحياة اليومية لشرح المفاهيم المجردة والمعقدة.
    *   **الشمولية:** يجب أن يكون الشرح وافياً ليغطي أكبر قدر ممكن من التفاصيل.
    *   **الجداول والرسوم:** ضرورية للمقارنات وتنظيم البيانات المعقدة بصرياً.

    # 4. الأنشطة التطبيقية والتعزيز (Differentiated Application & Reinforcement)
    *   ضمّن أنشطة تتراوح بين أسئلة استرجاع بسيطة وتمارين تتطلب تفكيراً نقدياً (Critical Thinking Exercises).
    *   اطلب من الطالب أن يقوم بخطوات عملية (مثل "ارسم مخططاً" أو "ابحث عن مثال").

    # 5. الخلاصة والمراجعة الإستراتيجية (High-Leverage Review & Synthesis)
    *   لخص المفاهيم والقواعد والخطوات الرئيسية في نقاط مركزة.
    *   قدم سؤالاً تحدياً (Synthesis Challenge) يتطلب ربط المعلومات كتحضير للاختبارات النهائية.
    
    **قواعد التنسيق البصري:**
    *   **البطاقات الهامة:** استخدم Blockquote (الاقتباس) للقوانين، التعريفات الأساسية، أو الملاحظات التي تتطلب تركيزاً خاصاً.
    *   **الخط العريض:** حصرياً للمصطلحات الرئيسية التي تظهر لأول مرة.
  `;
  // =======================================================
  
  const globalInstructionBlock = `
    **توجيهات إضافية وهامة:**
    ${customInstructions}
    **تجنب بحزم:**
    ${negativeInstructions}
    *   تجنب استخدام لغة غير أكاديمية أو العامية.
    *   تجنب التكرار غير الضروري للمعلومات.
  `;

  let userPrompt = `قم بمعالجة المحتوى وتنسيقه كدرس تعليمي احترافي:`;

  if (type === ContentType.TOPIC) {
      let topicData: any = actualData;
      if (typeof topicData === 'string') {
          try { topicData = JSON.parse(topicData); } catch(e) {}
      }
      const finalCustom = customInstructions || topicData.customInstructions || '';
      const finalNegative = negativeInstructions || topicData.negativeInstructions || '';

      // البرومبت المُحسن لإنشاء الدرس من الصفر
      userPrompt = `
        **الطلب:** أنشئ درساً تعليمياً احترافياً متكاملاً (Lesson Plan)، ملتزماً بـ "قواعد الهيكلة المنهجية الخماسية" المذكورة في التعليمات الأساسية. يجب أن يكون المحتوى ذو قيمة علمية عالية جداً ومناسباً تماماً لمعايير المستوى التعليمي المحدد.
        
        **معلومات السياق:**
        - العنوان: ${topicData.lessonName}
        - المادة: ${topicData.subject}
        - الصف/المستوى: ${topicData.gradeLevel}
        - المنهج/النظام التعليمي: ${topicData.curriculum}
        
        **مطلب العمق:** يجب أن يكون طول الدرس كافياً لتغطية جميع جوانب الموضوع بعمق وشمولية (ننصح بـ 1500 كلمة أو أكثر).

        ${finalCustom}
        ${finalNegative}
      `;
  } else if (type === ContentType.YOUTUBE && typeof actualData === 'string' && actualData.startsWith('http')) {
     userPrompt = `
       رابط فيديو يوتيوب: ${actualData}
       استخدم Google Search لفهم الفيديو واكتب درساً شاملاً عنه، ملتزماً بالهيكلية المنهجية الخماسية.
       ${globalInstructionBlock}
     `;
     tools = [{ googleSearch: {} }]; 
     contents = [{ text: baseInstruction + "\n" + userPrompt }];
     
  } else if (type === ContentType.TEXT || type === ContentType.YOUTUBE) {
    // يجب تطبيق الهيكلية على المحتوى المدخل أيضاً
    userPrompt = `قم بإعادة هيكلة وتنسيق هذا المحتوى ليطابق الهيكلية المنهجية الخماسية بالكامل:`;
    contents = [{ text: baseInstruction + "\n" + globalInstructionBlock + "\n" + userPrompt + "\n" + (actualData as string) }];

  } else if (type === ContentType.AUDIO) {
    const audioPart = {
        inlineData: {
            mimeType: mimeType || 'audio/mp3',
            data: actualData as string
        }
    };
    contents = [
        { text: baseInstruction + "\n" + globalInstructionBlock + "\n" + "قم بتفريغ الصوت، تصحيحه لغوياً، وتنظيمه كدرس متكامل يتبع الهيكلية المنهجية الخماسية." },
        audioPart
    ];
  } else if (type === ContentType.IMAGE || type === ContentType.PDF) {
    const images = Array.isArray(actualData) ? actualData : [actualData as string];
    const imageParts = images.map(img => ({
      inlineData: { mimeType: mimeType || 'image/jpeg', data: img }
    }));
    contents = [
      { text: baseInstruction + "\n" + globalInstructionBlock + "\n" + "قم بتحليل المحتوى المرئي، واستخراج المعلومات منه، وإعادة تنظيمها كدرس متكامل يتبع الهيكلية المنهجية الخماسية." },
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
        point: { type: Type.STRING, description: "المصطلح أو النقطة الرئيسية" },
        explanation: { type: Type.STRING, description: "الشرح الموجز والمباشر للقاعدة أو التعريف" }
      },
      required: ["point", "explanation"]
    }
  };

  // البرومبت المُحسن للتلخيص: يربط الملخص بالخلاصة النهائية للدرس لضمان التركيز على ما يجب تذكره.
  const response = await ai.models.generateContent({
    model: config.model,
    contents: `بصفتك مُقيماً للمحتوى، لخص أهم المفاهيم والقواعد الواردة في قسم "الخلاصة والمراجعة" بالدرس. يجب أن تكون النقاط هي الأهم للمراجعة السريعة والتحضير للاختبار. النص: ${text.substring(0, 20000)}`,
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
        front: { type: Type.STRING, description: "السؤال أو المصطلح الواضح" },
        back: { type: Type.STRING, description: "الإجابة الدقيقة والمباشرة" }
      },
      required: ["front", "back"]
    }
  };

  // البرومبت المُحسن للبطاقات: يتطلب توازناً بين التعريفات وأسئلة العلاقات والمقارنات.
  const response = await ai.models.generateContent({
    model: config.model,
    contents: `أنشئ 20 بطاقة تعليمية (سؤال/مصطلح وإجابة/تعريف). ركز على: 1. تعريف المصطلحات الأساسية. 2. أسئلة حول الأمثلة التطبيقية. 3. أسئلة المقارنة أو العلاقات بين المفاهيم. النص: ${text.substring(0, 20000)}`,
    config: { responseMimeType: "application/json", responseSchema: schema }
  });

  try { return JSON.parse(response.text || "[]"); } catch (e) { return []; }
};

export const generateMindMap = async (text: string, config: { apiKey?: string; model: string }): Promise<string> => {
    const ai = getClient(config.apiKey);
    // البرومبت المُحسن للمخطط الذهني: يطلب هيكلة منطقية للـ Mermaid
    const response = await ai.models.generateContent({
        model: config.model,
        contents: `أنشئ كود Mermaid.js (mindmap) باللغة العربية. يجب أن يمثل المخطط التسلسل الهرمي للمفاهيم في الدرس، مع استخدام كلمات ربط قوية (مثل: يؤدي إلى، يتكون من، مثال على). النص: ${text.substring(0, 20000)}`,
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
      [DifficultyLevel.EASY]: "أسئلة مباشرة وسهلة، تركز على التعريفات والمفاهيم الأساسية (مستوى المعرفة).",
      [DifficultyLevel.MEDIUM]: "أسئلة متوسطة الصعوبة تتطلب الفهم والربط وتطبيق القواعد (مستوى الفهم والتطبيق).",
      [DifficultyLevel.HARD]: "أسئلة صعبة تتطلب استنتاجاً وتحليلاً عميقاً وحل مشكلات غير مباشرة (مستوى التحليل والتقييم)."
  }[quizConfig.difficulty];

  let prompt = `
    قم بإنشاء اختبار تعليمي بناءً على النص المقدم.
    **توجيه الاختبار:** يجب أن تغطي الأسئلة الأهداف التعليمية (Phase 1) وقسم الأنشطة والتطبيق العملي (Phase 4). يجب أن تكون صياغة السؤال واضحة وغير ملتبسة.
    مستوى الصعوبة: ${difficultyPrompt}
    
    تعليمات أنواع الأسئلة (Strict Rules):
    1. ${QuestionType.MULTIPLE_CHOICE}: ضع السؤال في 'text'، الخيارات في 'options'، والإجابة الصحيحة في 'correctAnswer'.
    2. ${QuestionType.FILL_BLANKS}: ضع الجملة في 'text' مع وضع [____] مكان الكلمة الناقصة. الكلمة الناقصة تكون في 'correctAnswer'.
    3. ${QuestionType.ORDERING}: ضع السؤال في 'text'. ضع الخطوات *مرتبة بشكل صحيح* في مصفوفة JSON stringified داخل 'correctAnswer'. ضع الخطوات *مبعثرة* في 'options'.
    4. ${QuestionType.MATCHING}: ضع السؤال في 'text'. عبئ مصفوفة 'matches' بالأزواج الصحيحة (left, right).
    
    هام جداً:
    إذا كان عدد الأسئلة المطلوب كبيراً مقارنة بحجم النص:
    1. قم بصياغة أسئلة مختلفة لنفس المعلومة لاختبار الفهم من زوايا مختلفة.
    2. ركز على التفاصيل الدقيقة والقواعد الصارمة.
    3. قم بإنشاء سيناريوهات تطبيقية (Word Problems).
    
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
    
    // البرومبت المُحسن للتحليل: يركز على الفجوات المفاهيمية وتقديم خطة مراجعة محددة.
    const prompt = `
    أنت مرشد أكاديمي ومدرس خصوصي ذكي بخبرة 50 عاماً.
    اسم الطالب: ${studentName || 'يا بطل'}.
    خاطب الطالب باسمه وشجعه بأسلوب تربوي محفز.
    
    قام الطالب بإجراء اختبار وحصل على ${result.score} من ${result.total}.
    
    تفاصيل الأخطاء:
    ${result.details.filter(d => !d.isCorrect).map(d => `- السؤال: ${d.questionText}\n  إجابة الطالب: ${d.userAnswer}\n  الصواب: ${d.correctAnswer}`).join('\n')}
    
    المطلوب:
    1. تحليل سريع لنقاط ضعف الطالب وتحديد الفجوات المفاهيمية أو القواعد التي لم يستوعبها (بناءً على الأخطاء).
    2. نصيحة تربوية مشجعة ثم تقديم خطة مراجعة محددة: ما هي المواضيع أو الأقسام التي يجب أن يراجعها الطالب تحديداً في الدرس؟
    3. إذا كانت الدرجة كاملة، قدم تهنئة خاصة وحماسية بالاسم.
    
    اجعل الرد موجزاً وذا قيمة عالية، لا يتجاوز 120 كلمة.
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
  // التعليمات المُحسنة للشات: تركز على أسلوب المعلم الخبير (Socratic Method)
  const chat = ai.chats.create({
    model: config.model,
    config: { 
        systemInstruction: `
        أنت مدرس خصوصي خبير يدعى "فصيح". 
        اسم الطالب هو "${studentName || 'يا بطل'}". خاطبه باسمه دائماً وكن ودوداً وصبوراً.
        مهمتك هي شرح أي مفهوم يصعب عليه فهمه.
        
        **قواعد الشرح:**
        1. استخدم أسلوب الحوار السقراطي (Socratic Questioning) لتشجيع الطالب على اكتشاف الإجابة بنفسه أولاً.
        2. عند الشرح، استخدم التشبيهات والأمثلة الواقعية.
        3. كن مختصراً في البداية، ثم تعمق في التفاصيل إذا طلب الطالب ذلك.
        4. المرجع الأساسي لشرحك هو الدرس الحالي: ${context.substring(0, 20000)}
        ` 
    },
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
