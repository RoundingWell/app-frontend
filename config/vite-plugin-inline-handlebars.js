import Handlebars from 'handlebars';
import MagicString from 'magic-string';

const precompile = Handlebars.precompile;

const PLUGIN_NAME = 'vite-plugin-hbs-inline-compile';

const JS_FILE_REGEX = /\.[cm]?[jt]sx?$/;
const HBS_TAG_REGEX = /hbs`([^`]*)`/gs;
const HBS_IMPORT_REGEX = /import hbs from 'handlebars-inline-precompile';?\s*\n?/g;

export default function viteHbsInlineCompile() {
  return {
    name: PLUGIN_NAME,
    transform(code, id) {
      // only process if its a js file
      if (!JS_FILE_REGEX.test(id)) return null;

      const string = new MagicString(code);

      let codeWasChanged = false;

      // replace import: 'handlebars-inline-precompile' => 'handlebars/runtime'
      for (const match of code.matchAll(HBS_IMPORT_REGEX)) {
        const [full] = match;
        const start = match.index;
        const end = start + full.length;

        string.overwrite(start, end, 'import HandlebarsRuntime from \'handlebars/runtime\';\n');

        codeWasChanged = true;
      }

      // replace all instances of `hbs``` with precompiled handlebars
      for (const match of code.matchAll(HBS_TAG_REGEX)) {
        const [full, templateSrc] = match;
        const start = match.index;
        const end = start + full.length;

        try {
          const compiled = precompile(templateSrc);
          string.overwrite(start, end, `HandlebarsRuntime.template(${ compiled })`);

          codeWasChanged = true;
        } catch (error) {
          console.error(`Error compiling handlebars template in ${ id }:`, error);
          throw error;
        }
      }

      // bail out if nothing to change in the file
      if (!codeWasChanged) return null;

      return {
        code: string.toString(),
        map: string.generateMap({ hires: true }),
      };
    },
  };
}
