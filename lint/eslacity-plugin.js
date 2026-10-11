/**
 * Свои правила линтера (задача 16.4), в формате плагина ESLint: oxlint подключает его через `jsPlugins`.
 *
 * effect-cleanup — эффект React возвращает только функцию очистки. Стрелка без скобок вернула бы значение выражения:
 * в новом Chrome `scrollIntoView` возвращает Promise, и React при уходе с экрана вызывал его как функцию очистки
 * («l is not a function» в конце миссии, 2.113.3). Можно: тело в фигурных скобках или `() => () => …`.
 */
const EFFECTS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);

const calleeName = (callee) =>
  callee.type === 'Identifier' ? callee.name : callee.type === 'MemberExpression' && !callee.computed ? callee.property.name : null;

const effectCleanup = {
  meta: {
    type: 'problem',
    docs: { description: 'Эффект React возвращает только функцию очистки' },
    messages: {
      expression: 'Эффект без фигурных скобок вернёт значение выражения, а React вызовет его как очистку. Оберните тело в { }.',
    },
    schema: [],
  },
  create(context) {
    return {
      CallExpression(node) {
        if (!EFFECTS.has(calleeName(node.callee))) return;
        const fn = node.arguments[0];
        if (!fn || fn.type !== 'ArrowFunctionExpression' || fn.body.type === 'BlockStatement') return;
        // `() => () => …` — эффект сразу возвращает функцию очистки, это можно.
        if (fn.body.type === 'ArrowFunctionExpression' || fn.body.type === 'FunctionExpression') return;
        context.report({ node: fn.body, messageId: 'expression' });
      },
    };
  },
};

export default {
  meta: { name: 'eslacity' },
  rules: { 'effect-cleanup': effectCleanup },
};
