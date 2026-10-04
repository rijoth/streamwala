import { describe, it } from 'vitest';
import { RuleTester } from 'eslint';
import rule from './no-adhoc-scroll.mjs';

RuleTester.describe = describe;
RuleTester.it = it;

const ruleTester = new RuleTester({
  languageOptions: { ecmaVersion: 2022, sourceType: 'module' },
});

ruleTester.run('no-adhoc-scroll', rule, {
  valid: [
    "axis.scrollToOffset(120, { animate: true })",
    "el.style.transform = 'translate3d(0, -10px, 0)'",
    "const className = 'will-change-transform'",
    "const style = { transition: 'transform 140ms' }",
    // The shared scroll module is the sole owner of scroll APIs.
    {
      code: "el.scrollIntoView({ block: 'nearest' })",
      filename: '/project/src/shared/scroll/useThing.ts',
    },
    {
      code: "const s = { scrollBehavior: 'smooth' }",
      filename: '/project/src/shared/scroll/useThing.ts',
    },
  ],
  invalid: [
    {
      code: "el.scrollIntoView()",
      filename: '/project/src/features/home/HomeView.tsx',
      errors: [{ messageId: 'noScrollIntoView' }],
    },
    {
      code: "document.querySelector('#x').scrollIntoView({ block: 'center' })",
      filename: '/project/src/features/home/HomeView.tsx',
      errors: [{ messageId: 'noScrollIntoView' }],
    },
    {
      code: "const style = 'scroll-behavior: smooth';",
      filename: '/project/src/index.css.ts',
      errors: [{ messageId: 'noSmoothScroll' }],
    },
    {
      code: "const cls = 'overflow-y-auto scroll-smooth';",
      filename: '/project/src/features/home/HomeView.tsx',
      errors: [{ messageId: 'noSmoothScroll' }],
    },
    {
      code: "const a = 'scroll-behavior: smooth'; const b = `overflow-y-auto scroll-smooth`;",
      filename: '/project/src/features/home/HomeView.tsx',
      errors: [{ messageId: 'noSmoothScroll' }, { messageId: 'noSmoothScroll' }],
    },
  ],
});
