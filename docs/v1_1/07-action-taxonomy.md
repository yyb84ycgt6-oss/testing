# 7) Action Taxonomy

All modules use the same action taxonomy:
- `inventory.read`
- `inventory.register`
- `asset.read`
- `asset.write`
- `profile.read`
- `profile.write`
- `file.import`
- `file.export`
- `file.save`
- `cloud.sync`
- `bluetooth.pair`
- `wifi.connect`
- `workflow.create`
- `workflow.execute`
- `session.read`
- `session.execute`
- `job.queue`
- `job.cancel`
- `audit.read`
- `export.create`

Action naming rule:
- `<module>.<capability>.<verb>`
- Examples:
  - `pc.session.execute`
  - `flipper.profile.write`
  - `openclaw.operation.execute`
