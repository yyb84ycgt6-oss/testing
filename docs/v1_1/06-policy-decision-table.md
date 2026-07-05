# 6) Policy Decision Table

| Action Class | Example Permission | Default Policy | Additional Gate |
| --- | --- | --- | --- |
| View inventory | `*.read` | Allow by role | Classification filter |
| Create workflow | `workflow.create` | Allow by role | Schema validation |
| Execute low-risk workflow | `*.execute` | Conditional allow | Target scope check |
| Execute high-risk workflow | `*.execute` | Deny until approved | Owner/Security approval |
| Export artifact | `asset.export` | Conditional allow | Classification + audit tag |
| Register cloud target | `flipper.cloud.write` | Deny until approved | Secret handling + target validation |
| Pair Bluetooth device | `flipper.bluetooth.pair` | Conditional allow | Trust policy + audit trace |
| Connect to Wi-Fi profile | `flipper.wifi.connect` | Conditional allow | Approved profile + environment policy |
| Modify device/profile state | `*.write` | Deny until approved | Risk review + trace requirement |
| Cross-module action chain | `workflow.execute` | Deny until approved | Policy simulation + approval |
