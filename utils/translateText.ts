import axios from 'axios';

const translateText = async (text: any, targetLanguage: any) => {
  const apiKey = 'YOUR_GOOGLE_TRANSLATE_API_KEY';
  const url = `https://translation.googleapis.com/language/translate/v2`;

  try {
    const response = await axios.post(url, {
      q: text,
      target: targetLanguage,
      key: apiKey,
    });

    return response.data.data.translations[0].translatedText;
  } catch (error: unknown) {
    console.error('Translation Error:', error instanceof Error ? error.message : error);
    return text; // Fallback to the original text if translation fails
  }
};

export { translateText };
