import { load } from 'js-yaml';

const yamlExtension = /\.ya?ml$/;

export default function() {
  return {
    name: 'vite-plugin-yaml',
    async transform(code, id) {
      const [cleanId] = id.split('?');

      if (yamlExtension.test(cleanId)) {
        try {
          const yamlData = load(code, {
            filename: cleanId,
          });

          return {
            code: `const data = ${ JSON.stringify(yamlData) };\nexport default data;`,
            map: { mappings: '' },
          };
        } catch (exception) {
          console.error(`${ cleanId } errored during yaml processing: `, exception);
          return null;
        }
      }

      return null;
    },
  };
}
