import { Request, Response, NextFunction } from 'express';
import colors from 'colors';

// Helper function to apply color and bold to text
export const colorizeText = (text: any, color: string, bold: boolean = false): any => {
  // Check if the color method exists in the `colors` module
  const colorMethod = (colors as any)[color];

  if (colorMethod) {
    let styledText = colorMethod(text); // Apply the color method to text
    if (bold) {
      styledText = styledText.bold; // Apply bold if needed
    }
    return styledText;
  } else {
    console.warn(`Color '${color}' is not supported by colors.`);
    return text;
  }
};

// Middleware to log responses with colorized messages
export const globalResponse = (req: Request, res: Response, next: NextFunction): void => {
  const originalJson = res.json;

  // Override the response's json method to log colorized messages
  res.json = function (data: any): Response {
    if (res.statusCode < 300) {
      console.log(`${colorizeText('Response Message :', 'yellow')} ${colorizeText(data?.message, 'green')}`);
    } else {
      console.log(`${colorizeText('Error Message :', 'yellow')} ${colorizeText(data?.message, 'red')}`);
    }

    return originalJson.call(this, data);
  };

  next();
};
