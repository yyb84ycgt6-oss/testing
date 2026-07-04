export interface ApplicationProfile {
  id: string;
  corePurpose: string;
  userFlow: string;
  authModel: string;
  dataModel: string;
  releaseCadence: string;
  reliabilityTier: string;
  domain: string;
  dependencies: string[];
  owners: string[];
  runtimeRequirements: string[];
  sharedLogicRatio: number;
  roadmapOverlapRatio: number;
  failureIsolationRequired?: boolean;
}

export interface MergeAssessment {
  pair: [string, string];
  decision: 'merge' | 'integrate-via-api' | 'keep-separate';
  reasons: string[];
  preMergeCopies: string[];
  expectedGains: string[];
  rollbackPath: string;
  successMetrics: string[];
  riskScore: number;
}

export interface CandidateGroups {
  byDomain: Record<string, string[]>;
  byDependency: Record<string, string[]>;
  byOwner: Record<string, string[]>;
  byRuntimeRequirement: Record<string, string[]>;
}

export interface MergePhase {
  phase: number;
  assessment: MergeAssessment;
}

const MERGE_THRESHOLD = 0.7;

function asPair(a: ApplicationProfile, b: ApplicationProfile): [string, string] {
  return [a.id, b.id];
}

function compareRequiredMatch(a: ApplicationProfile, b: ApplicationProfile): string[] {
  const reasons: string[] = [];
  if (a.corePurpose !== b.corePurpose) reasons.push('different core purpose');
  if (a.userFlow !== b.userFlow) reasons.push('different user flow');
  if (a.authModel !== b.authModel) reasons.push('different auth model');
  if (a.dataModel !== b.dataModel) reasons.push('different data model');
  if (a.releaseCadence !== b.releaseCadence) reasons.push('different release cadence');
  if (a.reliabilityTier !== b.reliabilityTier) reasons.push('different reliability tier');
  return reasons;
}

function countSymmetricDifference(left: string[], right: string[]): number {
  const l = new Set(left);
  const r = new Set(right);
  let diff = 0;
  for (const item of l) {
    if (!r.has(item)) diff += 1;
  }
  for (const item of r) {
    if (!l.has(item)) diff += 1;
  }
  return diff;
}

function buildRiskScore(a: ApplicationProfile, b: ApplicationProfile): number {
  const dependencyRisk = countSymmetricDifference(a.dependencies, b.dependencies);
  const ownerRisk = countSymmetricDifference(a.owners, b.owners);
  const runtimeRisk = countSymmetricDifference(a.runtimeRequirements, b.runtimeRequirements);
  const similarityRisk = Math.round((2 - (a.sharedLogicRatio + b.sharedLogicRatio)) * 10);
  return dependencyRisk + ownerRisk + runtimeRisk + similarityRisk;
}

export function evaluateMergePair(a: ApplicationProfile, b: ApplicationProfile): MergeAssessment {
  const reasons = compareRequiredMatch(a, b);
  if (a.failureIsolationRequired || b.failureIsolationRequired) {
    reasons.push('failure blast radius must stay isolated');
  }
  if (a.sharedLogicRatio < MERGE_THRESHOLD || b.sharedLogicRatio < MERGE_THRESHOLD) {
    reasons.push('shared logic is below 70%');
  }
  if (a.roadmapOverlapRatio < MERGE_THRESHOLD || b.roadmapOverlapRatio < MERGE_THRESHOLD) {
    reasons.push('roadmap overlap is below 70%');
  }

  const decision = reasons.includes('failure blast radius must stay isolated')
    ? 'keep-separate'
    : reasons.length > 0
      ? 'integrate-via-api'
      : 'merge';

  return {
    pair: asPair(a, b),
    decision,
    reasons,
    preMergeCopies: [`copy:${a.id}`, `copy:${b.id}`],
    expectedGains: ['reduced duplicate logic', 'simpler release coordination'],
    rollbackPath: `restore copies for ${a.id} and ${b.id}`,
    successMetrics: [
      'no increase in error rates',
      'deploy frequency unchanged or improved',
      'at least 20% reduction in duplicate modules'
    ],
    riskScore: buildRiskScore(a, b)
  };
}

function addToGroup(group: Record<string, string[]>, key: string, appId: string): void {
  if (!group[key]) group[key] = [];
  group[key].push(appId);
}

export function groupCandidates(apps: ApplicationProfile[]): CandidateGroups {
  const groups: CandidateGroups = {
    byDomain: {},
    byDependency: {},
    byOwner: {},
    byRuntimeRequirement: {}
  };

  for (const app of apps) {
    addToGroup(groups.byDomain, app.domain, app.id);
    for (const dependency of app.dependencies) addToGroup(groups.byDependency, dependency, app.id);
    for (const owner of app.owners) addToGroup(groups.byOwner, owner, app.id);
    for (const runtimeRequirement of app.runtimeRequirements) {
      addToGroup(groups.byRuntimeRequirement, runtimeRequirement, app.id);
    }
  }

  return groups;
}

export function buildMergePhases(apps: ApplicationProfile[]): MergePhase[] {
  const assessments: MergeAssessment[] = [];
  for (let i = 0; i < apps.length; i += 1) {
    for (let j = i + 1; j < apps.length; j += 1) {
      const assessment = evaluateMergePair(apps[i], apps[j]);
      if (assessment.decision === 'merge') {
        assessments.push(assessment);
      }
    }
  }

  assessments.sort((left, right) => left.riskScore - right.riskScore);

  const selected = new Set<string>();
  const phases: MergePhase[] = [];
  for (const assessment of assessments) {
    const [a, b] = assessment.pair;
    if (selected.has(a) || selected.has(b)) continue;
    selected.add(a);
    selected.add(b);
    phases.push({
      phase: phases.length + 1,
      assessment
    });
  }

  return phases;
}
