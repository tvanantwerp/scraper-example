import { existsSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import * as path from 'path';
import axios, { AxiosError } from 'axios';

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
    const data = await readFile(
      path.resolve(
        __dirname,
        `.cache/${Buffer.from(url).toString('base64')}.html`,
      ),
      { encoding: 'utf8' },
    );
    return data
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
    return HTMLData;
  }
}

fetchFromWebOrCache('https://tomvanantwerp.com')