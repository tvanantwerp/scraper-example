import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import axios, { AxiosError } from 'axios';
import {JSDOM} from 'jsdom';

function fetchPage(url: string): Promise<string | undefined> {
  console.log(`Now fetching ${url}...`)
  const HTMLData = axios.get(url).then(res => res.data).catch((error: AxiosError) => {
    console.error(`There was an error with ${error.config.url}.`)
    console.error(error.toJSON())
  })

  return HTMLData;
}

export async function fetchFromWebOrCache(url: string, ignoreCache = false) {
  console.log(`Getting data for ${url}...`);
  if (
    !ignoreCache &&
    existsSync(
      path.resolve(
        __dirname,
        `.cache/${Buffer.from(url).toString('base64')}.html`,
      ),
    )
  ) {
    console.log(`I read ${url} from cache`);
    const HTMLData = await readFile(
      path.resolve(
        __dirname,
        `.cache/${Buffer.from(url).toString('base64')}.html`,
      ),
      { encoding: 'utf8' },
    );
    const dom = new JSDOM(HTMLData);
    return dom.window.document;
  } else {
    console.log(`I fetched ${url} fresh`);
    const HTMLData = await fetchPage(url);
    if (!ignoreCache && HTMLData) {
      writeFile(
        path.resolve(
          __dirname,
          `.cache/${Buffer.from(url).toString('base64')}.html`,
        ),
        HTMLData,
        { encoding: 'utf8' },
      );
    }
    const dom = new JSDOM(HTMLData);
    return dom.window.document;
  }
}

function extractData(document: Document) {
  const writingLinks: HTMLAnchorElement[] = Array.from(
    document.querySelectorAll('a.titlelink'),
  );
  return writingLinks.map(link => {
    return {
      title: link.text,
      url: link.href,
    };
  });
}

function saveData(filename: string, data: any) {
  if (!existsSync(resolve(__dirname, 'data'))) {
    mkdirSync('data');
  }
  writeFile(resolve(__dirname, `data/${filename}.json`), JSON.stringify(data), {
    encoding: 'utf8',
  });
}

async function getData() {
  const document = await fetchFromWebOrCache(
    'https://news.ycombinator.com/',
    true,
  );
  const data = extractData(document);
  saveData('hacker-news-links', data);
}

getData();
