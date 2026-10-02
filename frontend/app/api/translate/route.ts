// Next
import { NextResponse } from 'next/server';

import { sanitizeRichText } from '@/utils/richText';

// Data the page editor sends when requesting a translation.
interface TranslateRequest {
  text?: unknown;
  targetLang?: unknown;
}

// The part of DeepL's response we need: the translated text.
interface DeepLResponse {
  translations?: Array<{ text?: unknown }>;
}

/**
 * Translate page-editor text while preserving Bold and Italic formatting.
 *
 * The page editor sends the English text to this route. DeepL translates the
 * text in HTML mode so it can keep the formatting attached to the translated
 * words. The shared rich-text utilities clean the formatting before sending
 * it
 * and before returning the Japanese result.
 *
 * Used by the page editor's translation button.
 */
export async function POST(req: Request) {
  try {
    // Read the translation request from the page editor.
    const requestData = (await req.json()) as TranslateRequest;

    // Use Japanese by default if the caller does not provide a target language.
    const text = requestData.text;
    const targetLang =
      typeof requestData.targetLang === 'string' ? requestData.targetLang : 'JA';
    const apiKey = process.env.DEEPL_API_KEY;

    // Do not send an empty value to DeepL.
    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'No text provided' }, { status: 400 });
    }

    // Do not try to call DeepL if the API key is missing.
    if (!apiKey) {
      console.error('Translation failed: DEEPL_API_KEY is not configured.');
      return NextResponse.json({ error: 'Translation is unavailable' }, { status: 500 });
    }

    // Ping DeepL API
    const response = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Send the text we want translated and the target language we want it in (Japanese)
      body: new URLSearchParams({
        text: sanitizeRichText(text),
        target_lang: targetLang,

        // Tell DeepL that <strong>, <em>, and other supported tags are formatting,
        // so it can place them around the correct translated words.
        tag_handling: 'html',
      }),
    });

    // Stop if DeepL reports a failed request.
    if (!response.ok) {
      console.error(`Translation service returned status ${response.status}.`);
      return NextResponse.json({ error: 'Translation failed' }, { status: 502 });
    }

    // Get the translated text from DeepL's response.
    const data = (await response.json()) as DeepLResponse;
    const translation = data.translations?.[0]?.text;

    // Make sure DeepL actually returned translated text.
    if (typeof translation !== 'string') {
      console.error('Translation service returned an invalid response.');
      return NextResponse.json({ error: 'Translation failed' }, { status: 502 });
    }

    // Clean the returned HTML before sending it back to the page editor.
    return NextResponse.json({
      translation: sanitizeRichText(translation),
    });
  } catch (error) {
    console.error('Translation Error', error);
    return NextResponse.json({ error: 'Failed to translate' }, { status: 500 });
  }
}
