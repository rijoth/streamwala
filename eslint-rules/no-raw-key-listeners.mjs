/**
 * Guardrail B — single owner of raw key events.
 *
 * Bans direct `addEventListener('keydown' | 'keyup' | 'keypress', ...)` on
 * `window`, `document`, `document.body`, `globalThis`, `self` (and bare global
 * calls) so keyboard input can only be registered through `src/shared/input`.
 * Duplicate listeners previously caused the BACK double-dispatch bug (BUG-002).
 *
 * Non-literal event names are flagged too: they cannot be proven not to be a
 * key event.
 *
 * Listeners on plain elements (e.g. an HTMLVideoElement in PlayerEngine.ts) are
 * intentionally out of scope. There is no autofix: this is a prevention rule.
 */

const TARGET_GLOBALS = new Set(['window', 'document', 'globalThis', 'self']);
const KEY_EVENT = /^key(down|up|press)$/i;

/** @returns {{ isLiteral: boolean, value?: string }} */
function readEventName(node) {
  if (!node) return { isLiteral: false };
  if (node.type === 'Literal' && typeof node.value === 'string') {
    return { isLiteral: true, value: node.value };
  }
  if (node.type === 'TemplateLiteral') {
    if (node.expressions.length === 0) {
      return { isLiteral: true, value: node.quasis.map((q) => q.value.cooked ?? '').join('') };
    }
    return { isLiteral: false };
  }
  return { isLiteral: false };
}

function isTargetReceiver(node) {
  if (node.type === 'Identifier') {
    return TARGET_GLOBALS.has(node.name);
  }
  if (
    node.type === 'MemberExpression' &&
    !node.computed &&
    node.object.type === 'Identifier' &&
    node.object.name === 'document' &&
    node.property.type === 'Identifier' &&
    node.property.name === 'body'
  ) {
    return true;
  }
  return false;
}

/** @type {import('eslint').Rule.RuleModule} */
const noRawKeyListeners = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow raw keyboard event listeners outside the shared input module',
    },
    schema: [],
    messages: {
      noRawKeyListener:
        'Do not register raw keyboard listeners on {{target}}. Route keyboard input through src/shared/input (useTvInput / useBackHandler) instead.',
    },
  },

  create(context) {
    return {
      CallExpression(node) {
        const callee = node.callee;
        let methodName = null;
        let receiver = null;

        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier'
        ) {
          methodName = callee.property.name;
          receiver = callee.object;
        } else if (callee.type === 'Identifier') {
          methodName = callee.name;
          receiver = null; // bare global addEventListener(...)
        } else {
          return;
        }

        if (methodName !== 'addEventListener') return;
        if (receiver !== null && !isTargetReceiver(receiver)) return;

        const { isLiteral, value } = readEventName(node.arguments[0]);
        if (isLiteral && !(typeof value === 'string' && KEY_EVENT.test(value))) {
          return;
        }

        context.report({
          node,
          messageId: 'noRawKeyListener',
          data: { target: receiver === null ? 'the global scope' : context.sourceCode.getText(receiver) },
        });
      },
    };
  },
};

export default noRawKeyListeners;
