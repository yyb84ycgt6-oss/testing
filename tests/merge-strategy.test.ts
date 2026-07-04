import { describe, expect, it } from 'vitest';
import { buildMergePhases, evaluateMergePair, groupCandidates, type ApplicationProfile } from '../src/merge-strategy.js';

function app(overrides: Partial<ApplicationProfile> & Pick<ApplicationProfile, 'id'>): ApplicationProfile {
  return {
    id: overrides.id,
    corePurpose: overrides.corePurpose ?? 'analytics',
    userFlow: overrides.userFlow ?? 'ingest->analyze->report',
    authModel: overrides.authModel ?? 'oauth2',
    dataModel: overrides.dataModel ?? 'tenant-doc',
    releaseCadence: overrides.releaseCadence ?? 'weekly',
    reliabilityTier: overrides.reliabilityTier ?? 'high',
    domain: overrides.domain ?? 'security',
    dependencies: overrides.dependencies ?? ['api', 'queue'],
    owners: overrides.owners ?? ['team-a'],
    runtimeRequirements: overrides.runtimeRequirements ?? ['node'],
    sharedLogicRatio: overrides.sharedLogicRatio ?? 0.8,
    roadmapOverlapRatio: overrides.roadmapOverlapRatio ?? 0.8,
    failureIsolationRequired: overrides.failureIsolationRequired ?? false
  };
}

describe('merge strategy', () => {
  it('blocks merges for incompatible auth/data/release/reliability models', () => {
    const result = evaluateMergePair(
      app({ id: 'a', authModel: 'oauth2', dataModel: 'tenant-doc' }),
      app({ id: 'b', authModel: 'saml', dataModel: 'event-stream' })
    );

    expect(result.decision).toBe('integrate-via-api');
    expect(result.reasons).toContain('different auth model');
    expect(result.reasons).toContain('different data model');
  });

  it('enforces 70% shared logic and roadmap threshold', () => {
    const result = evaluateMergePair(
      app({ id: 'a', sharedLogicRatio: 0.69 }),
      app({ id: 'b', roadmapOverlapRatio: 0.65 })
    );

    expect(result.decision).toBe('integrate-via-api');
    expect(result.reasons).toContain('shared logic is below 70%');
    expect(result.reasons).toContain('roadmap overlap is below 70%');
  });

  it('keeps apps separate when failure isolation is required', () => {
    const result = evaluateMergePair(
      app({ id: 'a', failureIsolationRequired: true }),
      app({ id: 'b' })
    );

    expect(result.decision).toBe('keep-separate');
    expect(result.reasons).toContain('failure blast radius must stay isolated');
  });

  it('includes copy-first rollback metadata for mergeable pairs', () => {
    const result = evaluateMergePair(app({ id: 'a' }), app({ id: 'b', owners: ['team-a', 'team-b'] }));

    expect(result.decision).toBe('merge');
    expect(result.preMergeCopies).toEqual(['copy:a', 'copy:b']);
    expect(result.rollbackPath).toContain('restore copies');
    expect(result.successMetrics.length).toBeGreaterThan(0);
  });

  it('groups candidates by domain, dependencies, owners, and runtime requirements', () => {
    const groups = groupCandidates([
      app({ id: 'a', domain: 'security', dependencies: ['api', 'queue'], owners: ['team-a'], runtimeRequirements: ['node'] }),
      app({ id: 'b', domain: 'security', dependencies: ['api'], owners: ['team-b'], runtimeRequirements: ['node', 'gpu'] }),
      app({ id: 'c', domain: 'billing', dependencies: ['db'], owners: ['team-a'], runtimeRequirements: ['python'] })
    ]);

    expect(groups.byDomain.security).toEqual(['a', 'b']);
    expect(groups.byDependency.api).toEqual(['a', 'b']);
    expect(groups.byOwner['team-a']).toEqual(['a', 'c']);
    expect(groups.byRuntimeRequirement.node).toEqual(['a', 'b']);
  });

  it('builds phased merges with lowest-risk pair first', () => {
    const phases = buildMergePhases([
      app({ id: 'a', dependencies: ['api'], owners: ['team-a'] }),
      app({ id: 'b', dependencies: ['api'], owners: ['team-a'] }),
      app({ id: 'c', dependencies: ['api', 'queue', 'cache'], owners: ['team-c'], runtimeRequirements: ['node', 'gpu'] }),
      app({ id: 'd', dependencies: ['api', 'queue', 'cache', 'etl'], owners: ['team-d'], runtimeRequirements: ['python'] })
    ]);

    expect(phases.length).toBeGreaterThan(0);
    expect(phases[0].assessment.pair).toEqual(['a', 'b']);
    expect(phases[0].assessment.preMergeCopies).toEqual(['copy:a', 'copy:b']);
  });
});
