import type { TestRunnerConfig } from '@storybook/test-runner';
import { getStoryContext } from '@storybook/test-runner';
import { injectAxe, checkA11y } from 'axe-playwright';

const config: TestRunnerConfig = {
  async preVisit(page) {
    await injectAxe(page);
  },
  async postVisit(page, context) {
    const storyContext = await getStoryContext(page, context);

    if (storyContext.parameters?.a11y?.disable) {
      return;
    }

    await checkA11y(
      page,
      {
        include: ['#storybook-root'],
        exclude: ['[data-a11y-ignore]', '[disabled]', '[aria-disabled="true"]'],
      },
      {
        detailedReport: true,
        detailedReportOptions: { html: true },
        axeOptions: {
          runOnly: ['wcag2a', 'wcag2aa'],
          ...storyContext.parameters?.a11y?.options,
        },
      },
    );
  },
};

export default config;
