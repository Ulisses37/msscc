// Next
import { NextResponse } from 'next/server';

/**
 * Deepl API Implementation
 * Sends our desired text to the Deepl servers to be translated to Japanese
 */
export async function POST(req: Request){
  try{
    const { text, targetLang = 'JA'} = await req.json();
    const apiKey = process.env.DEEPL_API_KEY;

    if (!text){
      return NextResponse.json({ error: 'No text provided'}, { status: 400 });
    }

    // Ping DeepL API
    const response = await fetch ('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${apiKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      // Send the text we want translated and the target language we want it in (Japanese)
      body: new URLSearchParams({
        text,
        target_lang: targetLang,
      }),
    });

    const data = await response.json();

    // Return translated text
    return NextResponse.json({
      translation: data.translations[0].text
    });

  } catch (error){
    console.error('Translation Error', error);
    return NextResponse.json({ error: 'Failed to translate' }, {status: 500 });
  }
}
