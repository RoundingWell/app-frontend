export default {
  meta: {
    type: 'layout',
    docs: { description: 'Put each command in a standalone Cypress chain on its own line' },
    fixable: 'whitespace',
    schema: [],
    messages: { newline: 'Put each Cypress command on its own line.' },
  },
  create(context) {
    const source = context.sourceCode;

    return {
      ExpressionStatement(statement) {
        const members = [];
        let node = statement.expression;

        while (node.type === 'CallExpression' && node.callee.type === 'MemberExpression') {
          members.push(node.callee);
          node = node.callee.object;
        }

        if (node.type !== 'Identifier' || node.name !== 'cy' || members.length < 2) return;

        members.forEach(member => {
          if (member.object.loc.end.line !== member.property.loc.start.line) return;

          const token = source.getTokenAfter(member.object);
          const indent = ' '.repeat(statement.loc.start.column + 2);

          context.report({
            node: member.property,
            messageId: 'newline',
            fix: fixer => fixer.insertTextBefore(token, `\n${ indent }`),
          });
        });
      },
    };
  },
};
