import { AstroIntegration } from 'astro';
import satori, { SatoriOptions } from 'satori';

type ReactNode = Parameters<typeof satori>[0];
interface SatoriIntegrationOptions {
    satoriOptionsFactory?: () => Promise<SatoriOptions>;
    satoriElement?: (frontmatter: any) => ReactNode;
}
declare function Satori(options?: SatoriIntegrationOptions): AstroIntegration;

export { SatoriIntegrationOptions, Satori as default };
