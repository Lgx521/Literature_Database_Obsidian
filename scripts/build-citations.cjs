// Usage: node scripts/build-citations.cjs /absolute/temp/dependency-directory
// npm ci --prefix that-directory, using scripts/vendor/package{,-lock}.json first.
const path=require('path');
const deps=process.argv[2];if(!deps)throw new Error('Provide an external temporary dependency directory');
const root=path.resolve(__dirname,'..');
require(path.join(deps,'node_modules/esbuild-wasm')).buildSync({entryPoints:[path.join(root,'scripts/citation-engine.js')],bundle:true,platform:'browser',format:'cjs',target:'es2020',outfile:path.join(root,'scripts/vendor/citation-engine.cjs'),nodePaths:[path.join(deps,'node_modules')],loader:{'.csl':'text'},define:{'console.Console':'undefined'},minify:true,legalComments:'eof'});
