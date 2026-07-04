import { describe, expect, it } from 'vitest';
import { buildCodeRabbitReviewPlan, resolveCodeRabbitConfig } from '../src/coderabbit.js';

describe('coderabbit workflow layer', () => {
  it('provides stable defaults and allows overrides', () => {
    const cfg = resolveCodeRabbitConfig({ reviewMode: 'deep', requiredLabels: ['security'] });
    expect(cfg.enabled).toBe(true);
    expect(cfg.reviewMode).toBe('deep');
    expect(cfg.requiredLabels).toEqual(['security']);
    expect(cfg.requiredChecks).toEqual(['tests']);
  });

  it('runs only for eligible pull requests', () => {
    const plan = buildCodeRabbitReviewPlan({
      event: 'pull_request',
      isDraft: false,
      labels: ['security'],
      changedFiles: ['src/index.ts', 'tests/coderabbit.test.ts']
    }, {
      requiredLabels: ['security'],
      requiredChecks: ['tests', 'security-scan']
    });

    expect(plan.run).toBe(true);
    expect(plan.reason).toBe('eligible');
    expect(plan.blockingChecks).toEqual(['tests', 'security-scan']);
  });

  it('skips drafts when draft reviews are disabled', () => {
    const plan = buildCodeRabbitReviewPlan({
      event: 'pull_request',
      isDraft: true,
      labels: [],
      changedFiles: ['src/integrations.ts']
    });

    expect(plan.run).toBe(false);
    expect(plan.reason).toBe('draft-pr-disabled');
  });

  it('ignores documentation-only changes', () => {
    const plan = buildCodeRabbitReviewPlan({
      event: 'pull_request',
      isDraft: false,
      labels: [],
      changedFiles: ['docs/SIRIUS_INTEGRATION_PLAN.md', 'README.md']
    });

    expect(plan.run).toBe(false);
    expect(plan.reason).toBe('no-reviewable-files');
    expect(plan.includedFiles).toEqual([]);
  });
});
