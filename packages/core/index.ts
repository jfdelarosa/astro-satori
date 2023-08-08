import type { AstroIntegration, AstroConfig } from 'astro'
import type { SatoriOptions } from 'satori'
import satori from 'satori'
import urlJoin from 'url-join'
import { readFile, writeFile } from 'fs/promises'
import cheerio from 'cheerio'
import kleur from 'kleur'
import { basename } from 'path/win32'
import { defaultOgImageELement, defaultGenerateOptions } from './ssg.js'
import { ogTemplate } from './ogTemplate.js'
import { fileURLToPath } from 'url'

type ReactNode = Parameters<typeof satori>[0]

const genOgAndReplace = async (
  url: URL | undefined,
  component: string,
  route: string,
  site: string,
  element?: ReactNode,
  optionsFactory?: () => Promise<SatoriOptions>
) => {
  if (!url) {
    return
  }

  const ogUrl = urlJoin(site, route)

  const generateOgImage = async frontmatter => {
    const generateOptions = optionsFactory ?? defaultGenerateOptions
    const ogImageELement = element ?? defaultOgImageELement

    const options = await generateOptions()
    const res = await satori(ogImageELement(frontmatter), options)
    return {
      svgSource: res,
      width: (options as any).width ?? 1200,
      height: (options as any).height ?? 630,
    }
  }

  const componentSource = await readFile(url.pathname, {
    encoding: 'utf-8',
  })

  const $ = cheerio.load(componentSource)

  let parsedFrontMatter = {
    title: '',
    description: '',
  }

  $('meta').map((i, el) => {
    const name = $(el).attr('name') || $(el).attr('property')

    if (!name) {
      return
    }

    parsedFrontMatter[name] = $(el).attr('content')
  })

  const pathname = fileURLToPath(url)

  const html = await readFile(pathname, { encoding: 'utf-8' })

  const { svgSource, width, height } = await generateOgImage(parsedFrontMatter)

  const htmlBase = basename(pathname, '.html')

  const svgPath = pathname.replace(`${htmlBase}.html`, `og-${htmlBase}.svg`)

  await writeFile(svgPath, svgSource, { encoding: 'utf-8' })

  const relativeSvgPath = `/${basename(svgPath)}`

  const ogMetaToBeInserted = ogTemplate({
    imageHref: urlJoin(ogUrl, relativeSvgPath),
    width,
    height,
    title: parsedFrontMatter.title,
    description: parsedFrontMatter?.description ?? '',
    ogUrl,
  })

  const newHtml = html.replace('</head>', `${ogMetaToBeInserted}</head>`)

  await writeFile(pathname, newHtml, { encoding: 'utf-8' })
}

export interface SatoriIntegrationOptions {
  satoriOptionsFactory?: () => Promise<SatoriOptions>
  satoriElement?: (frontmatter) => ReactNode
}

function Satori(options: SatoriIntegrationOptions = {}): AstroIntegration {
  const { satoriElement, satoriOptionsFactory } = options

  let astroConfig: AstroConfig

  return {
    name: 'astro-satori',
    hooks: {
      'astro:config:done': ({ config }) => {
        astroConfig = config
      },

      'astro:build:done': async ({ routes }) => {
        const isSSR = astroConfig.output === 'server'

        if (!astroConfig?.site) {
          console.error(kleur.bgRed('[astro-satori]: error! site is required.'))
          return
        }

        const site = urlJoin(astroConfig.site, astroConfig?.base ?? '/')

        if (!isSSR) {
          try {
            await Promise.all(
              routes.map(r =>
                genOgAndReplace(
                  r.distURL,
                  r.component,
                  r.route,
                  site,
                  satoriElement,
                  satoriOptionsFactory
                )
              )
            )

            console.log(kleur.bgGreen('open graph images generated'))
          } catch (e: unknown) {
            console.log(e)
            console.error(kleur.bgRed('failed to generate open graph images'))
          }
        }
      },
    },
  }
}

export default Satori
