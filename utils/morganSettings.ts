import morgan from 'morgan';
import colors from 'colors';
import { colorizeText } from './others';

// Define a custom token for the source
morgan.token('source', (req: any) => {
  return req.get('User-Agent') || 'Unknown Source';
});

/**
 * Custom format function for Morgan logging.
 * @param tokens - Morgan tokens.
 * @param req - HTTP request object.
 * @param res - HTTP response object.
 * @returns The formatted log string.
 */
export function customFormat(tokens: any, req: any, res: any): string {
  const status = res.statusCode;
  const color = status >= 200 && status < 300 ? colors.green : colors.red;

  // Modify the format to include yellow color for method and URL
  const methodAndUrl = color(`${tokens.method(req, res)} ${tokens.url(req, res)}`);

  // Wrap the "Hit from" part in green color
  const hitFrom = colors.green(tokens.source(req));

  // Customize the log message
  return `${colorizeText('API Route: ', 'yellow')} "${methodAndUrl}" Status: ${color(status)}`;
}

export { morgan };
