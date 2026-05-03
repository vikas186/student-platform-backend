import { translateText } from '../utils/translateText';

const translateResponse = async (req: any, res: any, next: any) => {
  // Intercept the response method
  res.originalJson = res.json;

  // Override the response JSON method
  res.json = async function (data: any) {
    const language = req.headers['language'] || 'en';

    // Translate the `message` field if it exists
    if (data.message) {
      data.message = await translateText(data.message, language);
    }

    // Send the translated response
    res.originalJson(data);
  };

  next();
};

module.exports = { translateResponse };
