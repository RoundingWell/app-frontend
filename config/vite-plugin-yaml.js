import { load } from 'js-yaml';

const yamlExtension = /\.ya?ml$/;

export default function() {
  return {
    name: 'vite-plugin-yaml',
    async transform(code, id) {
      if (yamlExtension.test(id)) {
        const yamlData = load(code, {
          filename: id,
        });

        return {
          code: `const data = ${ JSON.stringify(yamlData) };\nexport default data;`,
          map: { mappings: '' },
        };
      }

      return null;
    },
  };
}
