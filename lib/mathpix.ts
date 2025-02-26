import { storage } from './firebase';
import { ref, listAll, getDownloadURL, uploadBytes } from 'firebase/storage';

interface MathpixResponse {
  text?: string;
  mmd?: string;
  error?: string;
  pdf_id?: string;
}

interface MathpixTextResponse {
  text: string;
  html: string;
  latex_styled: string;
  confidence: number;
  confidence_rate: number;
  error?: string;
}

enum MathpixErrorCode {
  INVALID_CREDENTIALS = 'invalid_credentials',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  FILE_TOO_LARGE = 'file_too_large',
  UNSUPPORTED_FORMAT = 'unsupported_format',
  PROCESSING_ERROR = 'processing_error',
  EMPTY_RESPONSE = 'empty_response',
  NETWORK_ERROR = 'network_error',
  TIMEOUT = 'timeout',
  LOW_CONFIDENCE = 'low_confidence',
  NO_MATH_DETECTED = 'no_math_detected',
  INVALID_CONTENT = 'invalid_content',
}

class MathpixError extends Error {
  code: MathpixErrorCode;
  details?: any;

  constructor(code: MathpixErrorCode, message: string, details?: any) {
    super(message);
    this.name = 'MathpixError';
    this.code = code;
    this.details = details;
  }
}

const MATHPIX_BASE_URL = 'https://api.mathpix.com/v3';
const CONFIDENCE_THRESHOLD = 0.7;
const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

async function handleMathpixResponse(response: Response, endpoint: string): Promise<any> {
  let errorText: string;
  try {
    errorText = await response.text();
  } catch {
    errorText = 'Unable to read error response';
  }

  console.error('Mathpix API error:', {
    endpoint,
    status: response.status,
    statusText: response.statusText,
    errorText,
  });

  switch (response.status) {
    case 400:
      throw new MathpixError(
        MathpixErrorCode.INVALID_CONTENT,
        'The request content was invalid or malformed',
        errorText
      );
    case 401:
      throw new MathpixError(
        MathpixErrorCode.INVALID_CREDENTIALS,
        'Invalid API credentials. Please check your app ID and key',
        errorText
      );
    case 429:
      throw new MathpixError(
        MathpixErrorCode.RATE_LIMIT_EXCEEDED,
        'API rate limit exceeded. Please try again later',
        errorText
      );
    case 413:
      throw new MathpixError(
        MathpixErrorCode.FILE_TOO_LARGE,
        'The file size exceeds the maximum limit',
        errorText
      );
    case 415:
      throw new MathpixError(
        MathpixErrorCode.UNSUPPORTED_FORMAT,
        'The file format is not supported',
        errorText
      );
    case 500:
    case 502:
    case 503:
    case 504:
      throw new MathpixError(
        MathpixErrorCode.PROCESSING_ERROR,
        'Mathpix service error. Please try again later',
        errorText
      );
    default:
      throw new MathpixError(
        MathpixErrorCode.NETWORK_ERROR,
        `Unexpected error (${response.status}): ${response.statusText}`,
        errorText
      );
  }
}

async function retryWithDelay<T>(
  operation: () => Promise<T>,
  retries: number = MAX_RETRIES
): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (
        error instanceof MathpixError &&
        (error.code === MathpixErrorCode.NETWORK_ERROR ||
         error.code === MathpixErrorCode.PROCESSING_ERROR) &&
        attempt < retries
      ) {
        console.log(`Retry attempt ${attempt} of ${retries}...`);
        await new Promise(resolve => setTimeout(resolve, RETRY_DELAY * attempt));
        continue;
      }
      throw error;
    }
  }
  throw new MathpixError(
    MathpixErrorCode.TIMEOUT,
    'Maximum retry attempts reached'
  );
}

async function waitForProcessing(pdfId: string): Promise<void> {
  const maxAttempts = 30;
  const delayMs = 10000;
  
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(`${MATHPIX_BASE_URL}/pdf/${pdfId}`, {
        headers: {
          'app_id': process.env.EXPO_PUBLIC_MATHPIX_APP_ID!,
          'app_key': process.env.EXPO_PUBLIC_MATHPIX_APP_KEY!,
        },
      });
      
      if (!response.ok) {
        await handleMathpixResponse(response, '/pdf/status');
      }
      
      const status = await response.json();
      console.log('PDF processing status:', status);
      
      if (status.status === 'completed') {
        return;
      }
      
      if (status.status === 'error') {
        throw new MathpixError(
          MathpixErrorCode.PROCESSING_ERROR,
          status.error || 'PDF processing failed',
          status
        );
      }
      
      await new Promise(resolve => setTimeout(resolve, delayMs));
    } catch (error) {
      if (error instanceof MathpixError) {
        throw error;
      }
      throw new MathpixError(
        MathpixErrorCode.PROCESSING_ERROR,
        'Error checking PDF status',
        error
      );
    }
  }
  
  throw new MathpixError(
    MathpixErrorCode.TIMEOUT,
    'PDF processing timeout'
  );
}

async function downloadMMD(pdfId: string, userId: string, filename: string): Promise<string> {
  console.log('Downloading MMD for PDF ID:', pdfId);
  
  const response = await fetch(`${MATHPIX_BASE_URL}/pdf/${pdfId}.mmd`, {
    headers: {
      'app_id': process.env.EXPO_PUBLIC_MATHPIX_APP_ID!,
      'app_key': process.env.EXPO_PUBLIC_MATHPIX_APP_KEY!,
    },
  });

  if (!response.ok) {
    await handleMathpixResponse(response, '/pdf/mmd');
  }

  const mmdContent = await response.text();
  if (!mmdContent.trim()) {
    throw new MathpixError(
      MathpixErrorCode.EMPTY_RESPONSE,
      'Received empty MMD content from Mathpix'
    );
  }
  
  const mmdStoragePath = `users/${userId}/mmd/${filename}`;
  const mmdRef = ref(storage, mmdStoragePath);
  const mmdBlob = new Blob([mmdContent], { type: 'text/markdown' });
  await uploadBytes(mmdRef, mmdBlob);
  
  return mmdContent;
}

export async function processWithMathpix(
  storageUrl: string,
  userId: string,
  filename: string
): Promise<MathpixResponse> {
  console.log('Starting Mathpix processing:', { storageUrl, userId, filename });
  
  if (!process.env.EXPO_PUBLIC_MATHPIX_APP_ID || !process.env.EXPO_PUBLIC_MATHPIX_APP_KEY) {
    throw new MathpixError(
      MathpixErrorCode.INVALID_CREDENTIALS,
      'Mathpix credentials not configured'
    );
  }

  try {
    if (/\.(jpg|jpeg|png)$/i.test(filename)) {
      console.log('Processing image file with text recognition API');
      return await retryWithDelay(() => processImageWithMathpix(storageUrl));
    }

    console.log('Processing PDF file with PDF API');
    return await retryWithDelay(async () => {
      const response = await fetch(`${MATHPIX_BASE_URL}/pdf`, {
        method: 'POST',
        headers: {
          'app_id': process.env.EXPO_PUBLIC_MATHPIX_APP_ID,
          'app_key': process.env.EXPO_PUBLIC_MATHPIX_APP_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          url: storageUrl,
          options_json: JSON.stringify({
            math_inline_delimiters: ["$", "$"],
            math_display_delimiters: ["$$", "$$"],
            enable_tables_fallback: true,
            conversion_formats: ["mmd"]
          })
        }),
      });

      if (!response.ok) {
        await handleMathpixResponse(response, '/pdf');
      }

      const result = await response.json();
      console.log('Mathpix API response:', result);
      
      if (!result.pdf_id) {
        throw new MathpixError(
          MathpixErrorCode.INVALID_CONTENT,
          'No PDF ID received from Mathpix'
        );
      }

      await waitForProcessing(result.pdf_id);
      const mmd = await downloadMMD(result.pdf_id, userId, filename);

      return { ...result, mmd };
    });
  } catch (error) {
    if (error instanceof MathpixError) {
      throw error;
    }
    throw new MathpixError(
      MathpixErrorCode.PROCESSING_ERROR,
      'Mathpix processing error',
      error
    );
  }
}

async function processImageWithMathpix(imageUrl: string): Promise<MathpixResponse> {
  console.log('Processing image with Mathpix text recognition:', imageUrl);

  try {
    console.log('Sending request to Mathpix text API...');
    const response = await fetch(`${MATHPIX_BASE_URL}/text`, {
      method: 'POST',
      headers: {
        'app_id': process.env.EXPO_PUBLIC_MATHPIX_APP_ID!,
        'app_key': process.env.EXPO_PUBLIC_MATHPIX_APP_KEY!,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        src: imageUrl,
        formats: ["text", "data", "latex_styled", "html"],
        math_inline_delimiters: ["$", "$"],
        math_display_delimiters: ["$$", "$$"],
        rm_spaces: true,
        include_line_breaks: true,
        include_asciimath: true,
        numbers_default_to_math: true,
        enable_spell_check: true,
        enable_math_ocr: true,
        enable_tables_fallback: true,
      }),
    });

    if (!response.ok) {
      await handleMathpixResponse(response, '/text');
    }

    const result: MathpixTextResponse = await response.json();
    console.log('Mathpix text recognition response:', {
      confidence: result.confidence,
      confidence_rate: result.confidence_rate,
      hasText: !!result.text,
      hasLatex: !!result.latex_styled,
      error: result.error
    });

    if (result.error) {
      throw new MathpixError(
        MathpixErrorCode.PROCESSING_ERROR,
        `Mathpix processing error: ${result.error}`,
        result
      );
    }

    if (result.confidence < CONFIDENCE_THRESHOLD) {
      throw new MathpixError(
        MathpixErrorCode.LOW_CONFIDENCE,
        `Low confidence in text recognition: ${result.confidence}`,
        { confidence: result.confidence }
      );
    }

    if (!result.text && !result.latex_styled) {
      throw new MathpixError(
        MathpixErrorCode.NO_MATH_DETECTED,
        'No text or mathematical content detected in the image'
      );
    }

    const mmd = result.latex_styled
      .replace(/\\\[/g, '$$')
      .replace(/\\\]/g, '$$')
      .replace(/\\\(/g, '$')
      .replace(/\\\)/g, '$')
      .replace(/\n{3,}/g, '\n\n')
      .trim();

    if (!mmd) {
      throw new MathpixError(
        MathpixErrorCode.EMPTY_RESPONSE,
        'Failed to convert Mathpix response to MMD format'
      );
    }

    console.log('Successfully processed image and generated MMD content');

    return {
      mmd,
      text: result.text,
    };
  } catch (error) {
    if (error instanceof MathpixError) {
      throw error;
    }
    throw new MathpixError(
      MathpixErrorCode.PROCESSING_ERROR,
      'Mathpix text recognition error',
      error
    );
  }
}

export { processWithMathpix, MathpixError, MathpixErrorCode }