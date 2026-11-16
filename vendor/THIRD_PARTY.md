# Third-party software

All libraries are bundled locally. No library or student data is fetched from a third-party server during application use.

| Software | Version | License | Upstream |
| --- | --- | --- | --- |
| SheetJS Community Edition | 0.20.3 | Apache-2.0 | https://docs.sheetjs.com/ |
| glpk.js | 4.0.2 | GPL-3.0 | https://github.com/jvail/glpk.js |
| GLPK, compiled into glpk.js | 5.0 | GPL-3.0-or-later | https://www.gnu.org/software/glpk/ |
| pako, embedded in the browser GLPK bundle | 2.0.4 | MIT AND Zlib | https://github.com/nodeca/pako |

`glpk.js` is the self-contained browser ESM bundle with a worker and its embedded WebAssembly payload. `glpk-node.cjs` and `glpk.wasm` are used for automated tests. The full GLPK license is included in `GLPK-LICENSE.txt`. The SheetJS license is included in `SHEETJS-LICENSE.txt`; pako's licenses are included in `PAKO-LICENSE.txt`.
