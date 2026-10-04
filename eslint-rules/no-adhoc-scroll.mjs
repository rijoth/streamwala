/**
 * Guardrail — no ad-hoc scrolling outside `src/shared/scroll`.
 *
 * The focus-driven scrolling system owns every scroll decision. Calling
 * `scrollIntoView` (edge-pinned, uncontrollable, animation-stacking) or using a
 * native smooth scroll re-introduces the class of bugs this system removed:
 * clipped focus rings, half-collapsed heroes and stacked tweens.
 *
 * Only `src/shared/scroll/**` may scroll. Listeners on ordinary elements are
 * out of scope (this rule targets scroll APIs, not input).
 */

const SMOOTH_SCROLL = /scroll-behavior\s*:\s*[^;{}]*smooth/;
const TAILWIND_SMOOTH = /(^|[\s"'`])scroll-smooth([\s"'`]|$)/;

function isAllowedFile(filename) {
  return /(^|[/\\])src[/\\]shared[/\\]scroll[/\\]/.test(filename);
}

/** @type {import('eslint').Rule.RuleModule} */
const noAdhocScroll = {
  meta: {
    type: 'problem',
    docs: {
      description:
        'Disallow scrollIntoView and smooth scrolling outside the shared scroll module',
    },
    schema: [],
    messages: {
      noScrollIntoView:
        'Do not call scrollIntoView; drive scrolling through src/shared/scroll (offset math + transform axis) instead.',
      noSmoothScroll:
        'Do not use smooth scrolling (`scroll-behavior: smooth` / `scroll-smooth`); the scroll axis animates transform. Use src/shared/scroll.',
    },
  },

  create(context) {
    const filename = context.filename ?? context.getFilename?.() ?? '';
    if (isAllowedFile(filename)) return {};

    const report = (node, messageId) => context.report({ node, messageId });

    return {
      CallExpression(node) {
        const callee = node.callee;
        if (
          callee.type === 'MemberExpression' &&
          !callee.computed &&
          callee.property.type === 'Identifier' &&
          callee.property.name === 'scrollIntoView'
        ) {
          report(node, 'noScrollIntoView');
        }
      },
      Literal(node) {
        if (typeof node.value !== 'string') return;
        if (SMOOTH_SCROLL.test(node.value) || TAILWIND_SMOOTH.test(node.value)) {
          report(node, 'noSmoothScroll');
        }
      },
      TemplateLiteral(node) {
        const text = node.quasis.map((quasi) => quasi.value.cooked ?? '').join('');
        if (SMOOTH_SCROLL.test(text) || TAILWIND_SMOOTH.test(text)) {
          report(node, 'noSmoothScroll');
        }
      },
    };
  },
};

export default noAdhocScroll;
