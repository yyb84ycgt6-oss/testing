export interface PhaseGateThresholds {
  startupLatencyMsMax: number;
  ramWorkingSetMbMax: number;
  compressionRatioMax: number;
  auditCoverageMin: number;
  integrityPassRateMin: number;
}

export interface PhaseGateMetrics {
  startupLatencyMs: number;
  ramWorkingSetMb: number;
  compressionRatio: number;
  auditCoverage: number;
  integrityPassRate: number;
}

export interface PhaseGateEvaluation {
  passed: boolean;
  failures: string[];
}

export function evaluatePhaseGates(metrics: PhaseGateMetrics, thresholds: PhaseGateThresholds): PhaseGateEvaluation {
  const failures: string[] = [];

  if (metrics.startupLatencyMs > thresholds.startupLatencyMsMax) failures.push('startupLatencyMs');
  if (metrics.ramWorkingSetMb > thresholds.ramWorkingSetMbMax) failures.push('ramWorkingSetMb');
  if (metrics.compressionRatio > thresholds.compressionRatioMax) failures.push('compressionRatio');
  if (metrics.auditCoverage < thresholds.auditCoverageMin) failures.push('auditCoverage');
  if (metrics.integrityPassRate < thresholds.integrityPassRateMin) failures.push('integrityPassRate');

  return {
    passed: failures.length === 0,
    failures
  };
}
