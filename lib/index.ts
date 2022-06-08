import * as Puppeteer from 'puppeteer';

import { Locale } from './types/locales';
import { normalizer } from './normalizer';

export interface Translate {
  from?: Locale;
  to: Locale;
}

function indexToBreak(txt: string, index: number): number {
  if (txt[index] === ' ') {
    return index;
  }

  if (index === 0) {
    return index;
  }

  return indexToBreak(txt, index - 1);
}

function breakText(txt: string, array: string[], limit: number): string[] {
  const index = indexToBreak(txt, limit) || txt.length / 2;

  const separate = txt.slice(0, index);
  const rest = txt.slice(index, txt.length);
  array.push(separate.trim());

  if (rest.length > limit) {
    return breakText(rest.trim(), array, limit);
  }

  array.push(rest);
  return array;
}

async function translator(
  from: string,
  to: string,
  text: string,
): Promise<string> {
  try {
    const browser = await Puppeteer.launch();
    const page = await browser.newPage();

    const url = `https://translate.google.com/?sl=${from}&text=${text}&tl=${to}&op=translate`;
    await page.goto(url);
    page.evaluate(() => {
      // click ok on google consent
      const button = document.querySelector(
        'form[action="https://consent.google.com/s"] button',
      ) as HTMLElement;
      if (button) {
        button.click();
      }
    });

    await page.waitForFunction(
      () => !!document.querySelector('span[jsname=jqKxS]'),
    );

    const translatedText = await page.evaluate(
      () =>
        (document.querySelector('span[jsname=jqKxS]') as HTMLElement).innerText,
    );

    await browser.close();

    if (!translatedText) {
      throw new Error('Unable to translate.');
    }

    return translatedText.toString();
  } catch (error) {
    throw new Error(error);
  }
}

const GOOGLE_TRANSLATE_CHARACTER_LIMIT = 5000;

export async function translate(
  text: string,
  languages: Translate,
): Promise<string> {
  const from = normalizer(languages?.from || 'auto');
  const to = normalizer(languages.to);

  if (text.length > GOOGLE_TRANSLATE_CHARACTER_LIMIT) {
    const textArr = breakText(text, [], GOOGLE_TRANSLATE_CHARACTER_LIMIT);

    const promises = textArr.map(txt => translator(from, to, txt));
    const promisesResolved = await Promise.all(promises);
    const translatedText = promisesResolved.join(' ');

    return translatedText;
  }

  const translatedText = await translator(from, to, encodeURIComponent(text));

  return translatedText;
}
