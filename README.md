# Web Scraping with TypeScript and Node.js

Sometimes you'll find yourself wanting to use a set of data from a website, but the data won't be available as an API or in a downloadable format like CSV. In these cases, you may have to write a web scraper to download individual web pages and extract the data you want from within their HTML. This guide will teach you the basics of writing a web scraper using TypeScript and Node.js, and will note several of the obstacles you might encounter during web scraping.

If you want to skip straight to the finish code example, [check it out on GitHub](https://github.com/tvanantwerp/scraper-example).

## Setup

First things first: we need to initialize our project and install the base dependencies. We'll be writing our web scraper in [TypeScript](https://www.typescriptlang.org/) and running it as [Node.js](https://nodejs.org/en/) scripts using [ts-node](https://www.npmjs.com/package/ts-node). For simplicity, we'll create an `index.ts` file in the project root to work from. From the command line, run the following to get started.

```sh
mkdir my-web-scraper && cd my-web-scraper # create project directory
git init # initialize new git repository
echo "node_modules" >> .gitignore # do not track node_modules in git
npm init -y # initialize Node.js project
# install dependencies
npm install typescript ts-node
npm install --save-dev @types/node
touch index.ts # create an empty TypeScript file
```

Node.js doesn't run TypeScript files natively. Rather than use the TypeScript compiler to output new JavaScript files whenever we want to run the script, we'll use ts-node to run the TypeScript files directly. We'll go ahead and add this to our new `package.json` file as an npm script.

```json
  "scripts": {
    "scrape": "ts-node ./index.ts"
  }
```

Now, we'll be able to run our scraper from `index.ts` with the command `npm run scrape`.

## Fetching Websites

In our examples, we'll be using [Axios](https://axios-http.com/docs/intro) to make our http requests. If you'd prefer something else, like [Node Fetch](https://www.npmjs.com/package/node-fetch) to match the Fetch API until it's ready in Node.js, that's fine too.

```sh
npm install axios
```

Let's create our first function for fetching a given URL and returning the HTML from that page.

```typescript
import axios from 'axios';

function fetchPage(url: string): Promise<string | undefined> {
  const HTMLData = axios
    .get(url)
    .then(res => res.data)
    .catch((error: AxiosError) => {
      console.error(`There was an error with ${error.config.url}.`);
      console.error(error.toJSON());
    });

  return HTMLData;
}
```

This function will use Axios to create a promise to fetch a given URL, and return the HTML it gets back as a string. If there's an error, it will log that error to the console and return `undefined` instead. Since you're probably going to be running this scraper from your command line throughout development, a healthy number of `console.log`s will help you make sure the script is running as expected.

## Caching Scraped Pages

In the event that you're trying to scrape many, many static web pages in a single script, you might want to cache the pages locally as you download them. This will save you time and headache as you work on your scraper. You're much less likely to annoy the website you're scraping with high traffic and the bandwidth costs associated with it, and your scripts will probably run faster if they aren't limited by your Internet connection.

Let's go ahead and create a `.cache` folder in the project root. You probably won't want to keep cached files in your git history, so we'll want to add this folder to your `.gitignore` file.

```sh
mkdir .cache
echo ".cache" >> .gitignore
```

To cache our results, we'll first check if a cached version of the given page already exists. If so, we'll use that. If not, we'll fetch the page and save it to the `.cache` folder. For filenames, we're just going to base-64 encode the page's URL. If you prefer some other way to generate a unique filename, that's fine too—I've chosen the base-64 encoded URLs because it's easy and very obviously a temporary sort of file. We've also got an optional function argument `ignoreCache`, in case you've built up your cache but want to scrape fresh data anyway.

```typescript
import { existsSync, mkdirSync } from 'fs';
import { readFile, writeFile } from 'fs/promises';
import { resolve } from 'path';

async function fetchFromWebOrCache(url: string, ignoreCache = false) {
  // If the cache folder doesn't exist, create it
  if (!existsSync(resolve(__dirname, '.cache'))) {
    mkdirSync('.cache');
  }
  console.log(`Getting data for ${url}...`);
  if (
    !ignoreCache &&
    existsSync(
      resolve(__dirname, `.cache/${Buffer.from(url).toString('base64')}.html`),
    )
  ) {
    console.log(`I read ${url} from cache`);
    const HTMLData = await readFile(
      resolve(__dirname, `.cache/${Buffer.from(url).toString('base64')}.html`),
      { encoding: 'utf8' },
    );
    return HTMLData;
  } else {
    console.log(`I fetched ${url} fresh`);
    const HTMLData = await fetchPage(url);
    if (!ignoreCache && HTMLData) {
      writeFile(
        resolve(
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
```

## Extracting Data with jsdom

Now that we have HTML to work with, we want to extract the relevant data from it. To do this, we will use [jsdom](https://github.com/jsdom/jsdom), a JavaScript implementation of the DOM. This will let us interact with the downloaded HTML in the exact same way as if we were working in a browser's console, giving access to methods like `querySelector`.

(If you prefer a syntax more like jQuery's, [Cheerio](https://cheerio.js.org/) is also a popular option.)

```sh
npm install jsdom
npm install --save-dev @types/jsdom
```

Now let's import jsdom and use it to return the Document object of our HTML string. Just modify the previous `fetchFromWebOrCache` to turn `HTMLData` into a DOM object, and return its `window.document`.

```typescript
import { JSDOM } from 'jsdom';

async function fetchFromWebOrCache(url: string, ignoreCache = false) {
  // Get the HTMLData from fetching or from cache
  const HTMLData = '<html>...</html>'
  const dom = new JSDOM(HTMLData);
  return dom.window.document;
}
```

Now that we're working with a Document instead of a string, we've got access to everything we'd have if we were working in the browser console. This makes it much easier to write code that extracts the pieces of a page that we want! For example, let's scrape whatever is on the front page of [Hacker News](https://news.ycombinator.com/) right now. We'll write a function that accepts the Document of the Hacker News front page, finds all of the links, and gives us back the link text and URL as a JavaScript object.

Using your browser's developer tools, you can easily inspect an element on the page with desired data to figure out a selector path. In our example, we can right-click a link and choose Inspect to view it in DevTools. Then we right-click the DOM element, and choose "Copy > Copy selector" in Chrome or "Copy > CSS Selector" in Firefox, for example.

A copied selector will give you a string of text that selects _only_ the element you copied it from in DevTools. And often that is useful! Just throw your selector into `document.querySelector('selector')`, and you're good to go. But in our case, we want _all_ of the front page links. So we need a broader selector than copy-pasting from DevTools will give us. This is where you'll have to actually read through the HTML, classes, ids, etc., to figure out how to craft the right selector.

Fortunately for us in this example, all of the links on the Hacker News feed have a unique class: `titlelink`. So we can use `document.querySelectorAll('a.titlelink')` to get all of them.

```typescript
// Pass the scraped Document from news.ycombinator.com to this
// function to extract data about front page links.
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
```

This function is only a simple example, and would be different depending on what you want to get out of a page. When working with jsdom, remember that you're not working with arrays and objects but with [NodeLists](https://developer.mozilla.org/en-US/docs/Web/API/NodeList) and [Elements](https://developer.mozilla.org/en-US/docs/Web/API/Element). To get useful data out of your selections, you'll often have to do things like convert a NodeList into an array as shown above.

Sometimes you'll have to get creative with your selections. I recently tried to scrape the information from an HTML `table` on a pages with varying numbers of tables and no classes. Because the number of tables was always different, I couldn't reliably select from a list of tables by which number table it was. I had to select every table present on a page, then filter them by the text in the first cell to get precisely the one table I needed!

```typescript
// Sometimes, web scraping is just hard...
const table: HTMLTableElement = Array.from(
    data.querySelectorAll('table'),
  ).filter(t =>
    t.children[0].children[0].children[0].innerHTML.match(
      /Unique Text in First Cell which IDs the Table/,
    ),
  )[0];
```

## Extracting Data with Regular Expressions

Unfortunately for us, not all pages on the Internet are well-structured and ready for scraping. Sometimes, they don't even try to use HTML tags properly. In these sad cases, you may need to turn to [regular expressions](https://xkcd.com/1171/) (regex) to extract what you need. We won't need to resort to such extreme measures in our example of scraping Hacker News, but it's worth knowing that you might need to do this.

I'll give you a contrived example where you would need some regex, based on another site I recently scraped. Imagine the following badly-done HTML:

```html
<div class="pokemon">
  Name: Pikachu<br />
  Number: 25<br />
  Type: Electric<br />
  Weakness: Ground
</div>
```

The various data attributes we care about aren't wrapped by their own HTML elements! Everything is just inside a `div` with some `br` tags to create line breaks. If I wanted to extract the data from this, I could use regex to find and match the text and patterns I expect to find. This can require trial and error, and I recommend using a tool like [regex101](https://regex101.com/) to test the regular expressions you come up with. In this example, we might write the following code:

```typescript
const rawPokemonHTML = document.querySelector('.pokemon');
const name = rawPokemonHTML.match(/Name: (\w+)/)[0];
const num = rawPokemonHTML.match(/Number: (\d+)/)[0];
// etc...
```

## Saving Data

Once we've extracted our data from the HTML, we'll want to save it. This is basically the same as when we created a cache for the downloaded HTML files.

```typescript
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { resolve } from 'path';

function saveData(filename: string, data: any) {
  if (!existsSync(resolve(__dirname, 'data'))) {
    mkdirSync('data');
  }
  writeFile(resolve(__dirname, `data/${filename}.json`), JSON.stringify(data), {
    encoding: 'utf8',
  });
}
```

## Putting It All Together

Now that we've got all the necessary pieces, we're ready to build our JSON file of Hacker News front page stories. To see all of our code in one piece, [check it out on GitHub](https://github.com/tvanantwerp/scraper-example).

```typescript
async function getData() {
  const document = await fetchFromWebOrCache(
    'https://news.ycombinator.com/',
    true, // Hacker News is always changing, so ignore the cache!
  );
  const data = extractData(document);
  saveData('hacker-news-links', data);
}

getData();
```

When we run our script from the command line, it will execute `getData()`. That function will fetch the HTML from Hacker News' front page, extract all of the links and their titles, and then save it to `data/hacker-news-links.json`. And while you probably don't need a list of links from Hacker News, this information should be enough to get you started with collecting some data from the web which you do care about.