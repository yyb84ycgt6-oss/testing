# 4) Universal Action Model

All modules must follow one action lifecycle:
1. **Input**: validated request (schema + type checks)
2. **Policy Check**: auth, risk, and rule evaluation
3. **Execution**: run task/job/agent workflow
4. **Output**: result, confidence, logs, and recommended next actions
5. **Persistent Trace**: immutable audit record with actor, time, action, and outcome

### Required Action Envelope
- `action_id`
- `actor_id`
- `domain`
- `input_payload`
- `policy_decision`
- `execution_ref`
- `status`
- `output_payload`
- `confidence`
- `audit_ref`
- `created_at` / `completed_at`
