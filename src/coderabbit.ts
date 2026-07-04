export type CodeRabbitReviewMode = 'light' | 'standard' | 'deep';

export interface CodeRabbitConfig {
  enabled: boolean;
  reviewMode: CodeRabbitReviewMode;
  runOnDrafts: boolean;
  requiredLabels: string[];
  ignoredPaths: string[];
  requiredChecks: string[];
}

export interface CodeRabbitContext {
  event: 'pull_request' | 'pull_request_review' | 'push';
  isDraft: boolean;
  labels: string[];
  changedFiles: string[];
}

export interface CodeRabbitReviewPlan {
  run: boolean;
  mode: CodeRabbitReviewMode;
  reason: string;
  blockingChecks: string[];
  includedFiles: string[];
}

export const defaultCodeRabbitConfig: CodeRabbitConfig = {
  enabled: true,
  reviewMode: 'standard',
  runOnDrafts: false,
  requiredLabels: [],
  ignoredPaths: ['docs/', 'README.md'],
  requiredChecks: ['tests']
};

export function resolveCodeRabbitConfig(overrides: Partial<CodeRabbitConfig> = {}): CodeRabbitConfig {
  return {
    ...defaultCodeRabbitConfig,
    ...overrides,
    requiredLabels: overrides.requiredLabels ?? defaultCodeRabbitConfig.requiredLabels,
    ignoredPaths: overrides.ignoredPaths ?? defaultCodeRabbitConfig.ignoredPaths,
    requiredChecks: overrides.requiredChecks ?? defaultCodeRabbitConfig.requiredChecks
  };
}

function startsWithIgnoredPath(file: string, ignoredPaths: string[]): boolean {
  return ignoredPaths.some((path) => file === path || file.startsWith(path));
}

export function buildCodeRabbitReviewPlan(
  context: CodeRabbitContext,
  overrides: Partial<CodeRabbitConfig> = {}
): CodeRabbitReviewPlan {
  const config = resolveCodeRabbitConfig(overrides);
  const includedFiles = context.changedFiles.filter((file) => !startsWithIgnoredPath(file, config.ignoredPaths));

  if (!config.enabled) {
    return { run: false, mode: config.reviewMode, reason: 'disabled', blockingChecks: [], includedFiles };
  }

  if (context.event !== 'pull_request') {
    return { run: false, mode: config.reviewMode, reason: 'unsupported-event', blockingChecks: [], includedFiles };
  }

  if (context.isDraft && !config.runOnDrafts) {
    return { run: false, mode: config.reviewMode, reason: 'draft-pr-disabled', blockingChecks: [], includedFiles };
  }

  if (config.requiredLabels.length > 0 && !config.requiredLabels.every((label) => context.labels.includes(label))) {
    return { run: false, mode: config.reviewMode, reason: 'missing-required-labels', blockingChecks: [], includedFiles };
  }

  if (includedFiles.length === 0) {
    return { run: false, mode: config.reviewMode, reason: 'no-reviewable-files', blockingChecks: [], includedFiles };
  }

  return {
    run: true,
    mode: config.reviewMode,
    reason: 'eligible',
    blockingChecks: [...config.requiredChecks],
    includedFiles
  };
}
