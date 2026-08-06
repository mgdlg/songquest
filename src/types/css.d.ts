/**
 * Side-effect stylesheet imports.
 *
 * Next.js ships declarations for `*.module.css` (typed as a class-name map) but
 * not for plain global stylesheets imported for their side effect. `RangeMap`
 * needs one: Leaflet's CSS lives in `node_modules` and is pulled in with
 * `await import('leaflet/dist/leaflet.css')` inside the same dynamic block that
 * loads Leaflet itself, so the stylesheet cannot land before the library it
 * styles.
 *
 * `*.module.css` is the more specific wildcard, so this declaration does not
 * shadow Next's typed one — CSS Modules keep their class-name typing.
 */
declare module '*.css';
