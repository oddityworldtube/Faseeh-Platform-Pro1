
/**
 * خدمة استخراج النصوص من يوتيوب
 * محسن للعمل مع قيود المتصفح باستخدام وكلاء (Proxies) متعددين
 */

export const getVideoId = (url: string): string | null => {
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.match(regExp);
  return (match && match[2].length === 11) ? match[2] : null;
};

export const fetchTranscript = async (videoId: string): Promise<string> => {
  // قائمة وكلاء (Proxies) لتجاوز CORS والحجب
  // نستخدم corsproxy.io كخيار أول لأنه أكثر موثوقية مع يوتيوب
  const proxies = [
    'https://corsproxy.io/?',
    'https://api.allorigins.win/raw?url='
  ];

  let lastError: any = null;

  for (const proxyBase of proxies) {
    try {
      const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
      const targetUrl = proxyBase + encodeURIComponent(videoUrl);
      
      const response = await fetch(targetUrl);
      if (!response.ok) throw new Error(`Proxy responded with ${response.status}`);
      
      const html = await response.text();
      
      // محاولة استخراج بيانات الفيديو من كائن ytInitialPlayerResponse
      // هذا الكائن يحتوي على بيانات أكثر دقة من البحث المباشر عن captionTracks
      const playerResponseRegex = /var\s+ytInitialPlayerResponse\s*=\s*({.+?});/s;
      const match = html.match(playerResponseRegex);
      
      let tracks = null;

      if (match && match[1]) {
        try {
            const playerResponse = JSON.parse(match[1]);
            tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        } catch (e) {
            console.warn('Failed to parse player response JSON', e);
        }
      }

      // محاولة بديلة: البحث المباشر عن captionTracks إذا فشل الكائن أعلاه
      if (!tracks) {
          const captionRegex = /"captionTracks":\s*(\[.*?\])/;
          const match2 = html.match(captionRegex);
          if (match2 && match2[1]) {
              try {
                  tracks = JSON.parse(match2[1]);
              } catch (e) {
                  console.warn('Failed to parse caption tracks JSON', e);
              }
          }
      }

      if (!tracks || tracks.length === 0) {
          // إذا لم نجد ترجمة في هذا البروكسي، نجرب التالي
          continue;
      }

      // نجحنا في العثور على المسارات
      // الترتيب: العربية -> الإنجليزية -> الأول المتاح
      const track = tracks.find((t: any) => t.languageCode === 'ar') || 
                    tracks.find((t: any) => t.languageCode.startsWith('en')) || 
                    tracks[0];

      if (!track || !track.baseUrl) continue;

      // جلب ملف XML للترجمة
      const transcriptResponse = await fetch(proxyBase + encodeURIComponent(track.baseUrl));
      if (!transcriptResponse.ok) continue;
      
      const transcriptXml = await transcriptResponse.text();

      // تحويل XML إلى نص
      return parseTranscriptXml(transcriptXml);

    } catch (error) {
      console.warn(`Failed with proxy ${proxyBase}:`, error);
      lastError = error;
    }
  }

  throw new Error(
    lastError?.message || 
    'لم يتم العثور على ترجمة (Captions) لهذا الفيديو. يرجى التأكد من أن الفيديو يحتوي على زر CC مفعل.'
  );
};

const parseTranscriptXml = (xml: string): string => {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xml, "text/xml");
    const textNodes = xmlDoc.getElementsByTagName('text');

    let fullText = "";
    for (let i = 0; i < textNodes.length; i++) {
      const rawText = textNodes[i].textContent;
      if (rawText) {
          // فك ترميز HTML entities
          const decodedText = new DOMParser().parseFromString(rawText, 'text/html').body.textContent || "";
          // تجاهل النصوص الفارغة أو الموسيقية
          if (decodedText.trim() && !decodedText.startsWith('[') && !decodedText.startsWith('(')) {
               fullText += decodedText + " ";
          }
      }
    }
    return fullText.trim();
};
