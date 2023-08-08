// index.ts
import satori from "satori";
import urlJoin from "url-join";
import { readFile, writeFile } from "fs/promises";
import cheerio from "cheerio";
import kleur from "kleur";
import { basename } from "path/win32";

// ssg.ts
import { html } from "satori-html";
var defaultOgImageELement = ({ title, description, author }) => {
  return html`
  <div
      style="
        background: #fefbfb;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
      "
    >
      <div
        style="
          position: absolute;
          top: -1px;
          right: -1px;
          border: 4px solid #000;
          background: #ecebeb;
          opacity: 0.9;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          margin: 2.5rem;
          width: 88%;
          height: 80%;
        "
      />
      <div
        style="
          border: 4px solid #000;
          background: #fefbfb;
          border-radius: 4px;
          display: flex;
          justify-content: center;
          margin: 2rem;
          width: 88%;
          height: 80%;
        "
      >
        <div
          style="
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            margin: 20px;
            width: 90%;
            height: 90%;
          "
        >
          <p
            style="
              font-size: 72px;
              font-weight: bold;
              max-height: 84%;
              overflow: hidden;
            "
          >
            ${title}
          </p>
          <div
            style="
              display: flex;
              justify-content: space-between;
              width: 100%;
              margin-bottom: 8px;
              font-size: 28px;
            "
          >
            <span>
              by  
              <span
                style="
                  color: transparent;
                "
              >
                "
              </span>
              <span style="overflow: hidden; fontWeight: bold; ">
                ${author}
              </span>
            </span>

            <span style=" overflow: hidden; font-weight: bold; ">
              ${title}
            </span>
          </div>
        </div>
      </div>
    </div>
  `;
};
var defaultGenerateOptions = async () => {
  const fontFileRegular = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.regular.ttf"
  );
  const fontRegular = await fontFileRegular.arrayBuffer();
  const fontFileBold = await fetch(
    "https://www.1001fonts.com/download/font/ibm-plex-mono.bold.ttf"
  );
  const fontBold = await fontFileBold.arrayBuffer();
  const options = {
    width: 1200,
    height: 630,
    embedFont: true,
    fonts: [
      {
        name: "IBM Plex Mono",
        data: fontRegular,
        weight: 400,
        style: "normal"
      },
      {
        name: "IBM Plex Mono",
        data: fontBold,
        weight: 600,
        style: "normal"
      }
    ]
  };
  return options;
};

// ogTemplate.ts
var ogTemplate = ({
  imageHref,
  title,
  description,
  width,
  height,
  ogUrl
}) => {
  return `
<meta property="og:type" content="website" >
<meta property="og:url" content="${ogUrl}" >
<meta property="og:image" content="${imageHref}" >
<meta property="og:title" content="${title}"/>
<meta property="og:description" content="${description}"/>
<meta property="og:image:width" content="${width}"/>
<meta property="og:image:height" content="${height}"/>
`;
};

// index.ts
import { fileURLToPath } from "url";
var genOgAndReplace = async (url, component, route, site, element, optionsFactory) => {
  if (!url) {
    return;
  }
  const ogUrl = urlJoin(site, route);
  const generateOgImage = async (frontmatter) => {
    const generateOptions = optionsFactory ?? defaultGenerateOptions;
    const ogImageELement = element ?? defaultOgImageELement;
    const options = await generateOptions();
    const res = await satori(ogImageELement(frontmatter), options);
    return {
      svgSource: res,
      width: options.width ?? 1200,
      height: options.height ?? 630
    };
  };
  const componentSource = await readFile(url.pathname, {
    encoding: "utf-8"
  });
  const $ = cheerio.load(componentSource);
  let parsedFrontMatter = {
    title: "",
    description: ""
  };
  $("meta").map((i, el) => {
    const name = $(el).attr("name") || $(el).attr("property");
    if (!name) {
      return;
    }
    parsedFrontMatter[name] = $(el).attr("content");
  });
  const pathname = fileURLToPath(url);
  const html2 = await readFile(pathname, { encoding: "utf-8" });
  const { svgSource, width, height } = await generateOgImage(parsedFrontMatter);
  const htmlBase = basename(pathname, ".html");
  const svgPath = pathname.replace(`${htmlBase}.html`, `og-${htmlBase}.svg`);
  await writeFile(svgPath, svgSource, { encoding: "utf-8" });
  const relativeSvgPath = `/${basename(svgPath)}`;
  const ogMetaToBeInserted = ogTemplate({
    imageHref: urlJoin(ogUrl, relativeSvgPath),
    width,
    height,
    title: parsedFrontMatter.title,
    description: parsedFrontMatter?.description ?? "",
    ogUrl
  });
  const newHtml = html2.replace("</head>", `${ogMetaToBeInserted}</head>`);
  await writeFile(pathname, newHtml, { encoding: "utf-8" });
};
function Satori(options = {}) {
  const { satoriElement, satoriOptionsFactory } = options;
  let astroConfig;
  return {
    name: "astro-satori",
    hooks: {
      "astro:config:done": ({ config }) => {
        astroConfig = config;
      },
      "astro:build:done": async ({ routes }) => {
        const isSSR = astroConfig.output === "server";
        if (!astroConfig?.site) {
          console.error(kleur.bgRed("[astro-satori]: error! site is required."));
          return;
        }
        const site = urlJoin(astroConfig.site, astroConfig?.base ?? "/");
        if (!isSSR) {
          try {
            await Promise.all(
              routes.map(
                (r) => genOgAndReplace(
                  r.distURL,
                  r.component,
                  r.route,
                  site,
                  satoriElement,
                  satoriOptionsFactory
                )
              )
            );
            console.log(kleur.bgGreen("open graph images generated"));
          } catch (e) {
            console.log(e);
            console.error(kleur.bgRed("failed to generate open graph images"));
          }
        }
      }
    }
  };
}
var core_default = Satori;
export {
  core_default as default
};
