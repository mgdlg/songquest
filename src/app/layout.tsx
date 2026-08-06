import type { CSSProperties, ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import { Instrument_Serif } from 'next/font/google';

import './globals.css';

const instrumentSerif = Instrument_Serif({
  weight: '400',
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-instrument-serif',
  fallback: ['Times New Roman', 'Times', 'Georgia', 'serif'],
});

/**
 * `globals.css` declares `--font-display` with the literal family name
 * 'Instrument Serif', which `next/font` never emits — it self-hosts the face
 * under a hashed family and exposes it only through the variable declared
 * above. Rather than edit the canonical stylesheet, the token is re-pointed
 * here at the element that carries the font's own variable. Inline styles beat
 * the `:root` rule, so every `var(--font-display)` downstream resolves to the
 * self-hosted face with the same fallback chain.
 */
const fontTokens = {
  '--font-display':
    "var(--font-instrument-serif), 'Times New Roman', Times, Georgia, serif",
} as CSSProperties;

/**
 * Shell chrome that no component owns: the skip link (which needs a `:focus`
 * rule and so cannot be expressed inline) and the global attribution footer.
 * Values are tokens only — this block must not introduce new design constants.
 */
const shellStyles = `
.skipLink {
  position: fixed;
  top: var(--space-3);
  left: var(--space-3);
  z-index: var(--z-toast);
  transform: translateY(calc(-100% - var(--space-6)));
  padding: var(--space-2) var(--space-4);
  background: var(--card);
  color: var(--ink);
  border: var(--rule-hair) solid var(--paper-edge);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-raised);
  font-family: var(--font-body);
  font-size: var(--step--2);
  text-transform: uppercase;
  letter-spacing: var(--tracking-label);
  text-decoration: none;
  transition: transform var(--dur-base) var(--ease-settle);
}

.skipLink:focus {
  transform: translateY(0);
}

.appShell {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-height: 100dvh;
}

.appMain {
  flex: 1 0 auto;
}

.siteFooter {
  flex-shrink: 0;
  margin-top: var(--space-6);
  border-top: var(--rule-hair) solid var(--paper-edge);
  padding: var(--space-5) var(--space-5) var(--space-6);
}

.siteFooterInner {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-4) var(--space-6);
  align-items: flex-start;
  justify-content: space-between;
  max-width: var(--shell-max);
  margin: 0 auto;
  color: var(--ink-faint);
  font-size: var(--step--2);
  line-height: var(--leading-normal);
}

.siteFooterSources {
  max-width: var(--measure);
}

.siteFooterSources p {
  margin-top: var(--space-2);
}

.siteFooter a {
  color: var(--ink-faint);
  text-decoration-color: var(--ink-ghost);
}

.siteFooter a:hover {
  color: var(--clay-deep);
}

.siteFooterMark {
  font-family: var(--font-display);
  font-size: var(--step-0);
  letter-spacing: var(--tracking-wide);
  color: var(--ink-soft);
}
`;

export const metadata: Metadata = {
  title: 'Song Quest — the birdsong identification game',
  description:
    'Name the bird by ear. Four attempts, four escalating hints — recording, range, taxonomy, then a blurred plate — over Creative-Commons audio from Xeno-canto and imagery from iNaturalist.',
  applicationName: 'Song Quest',
  keywords: [
    'birdsong',
    'bird identification',
    'birding game',
    'ornithology',
    'Xeno-canto',
    'field guide',
  ],
  openGraph: {
    title: 'Song Quest — the birdsong identification game',
    description:
      'Four attempts, four hints, one bird a day. A field-guide game built entirely on Creative-Commons recordings.',
    siteName: 'Song Quest',
    locale: 'en_US',
    type: 'website',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  // The one place a literal is unavoidable: a meta tag cannot read a custom
  // property. Mirrors --paper in globals.css; change both together.
  themeColor: '#ffffff',
  colorScheme: 'light',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={instrumentSerif.variable} style={fontTokens}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: shellStyles }} />
      </head>
      <body>
        <a className="skipLink" href="#content">
          Skip to content
        </a>

        <div className="appShell">
          <main id="content" className="appMain">
            {children}
          </main>

          <footer className="siteFooter noPrint">
            <div className="siteFooterInner">
              <div className="siteFooterSources">
                <p className="fieldLabel">Sources &amp; licences</p>
                <p>
                  Recordings from{' '}
                  <a
                    href="https://xeno-canto.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Xeno-canto
                  </a>
                  , used under Creative Commons licences that permit
                  non-commercial use, with the recordist credited on every clip.
                  Song Quest is a non-commercial project. Photographs and
                  taxonomy from{' '}
                  <a
                    href="https://www.inaturalist.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    iNaturalist
                  </a>
                  . Occurrence density from{' '}
                  <a
                    href="https://www.gbif.org"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    GBIF
                  </a>
                  . Base map ©{' '}
                  <a
                    href="https://www.openstreetmap.org/copyright"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    OpenStreetMap
                  </a>{' '}
                  contributors, tiles ©{' '}
                  <a
                    href="https://carto.com/attributions"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    CARTO
                  </a>
                  .
                </p>
              </div>

              <p className="siteFooterMark">Song Quest</p>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
