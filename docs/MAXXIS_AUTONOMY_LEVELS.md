# Maxxis Autonomy Levels

Every Maxxis capability declares exactly one maximum level:

| Level | Allowed behavior | User boundary |
| --- | --- | --- |
| `READ` | Retrieve authorized facts. | No state change. |
| `SUGGEST` | Explain facts and recommend a non-binding option. | User decides and acts. |
| `PREPARE` | Build an editable draft or pending intent. | Nothing is sent, charged or committed. |
| `CONFIRM` | Present exact target, content, cost and consequences. | Explicit fresh confirmation is mandatory. |
| `EXECUTE` | Perform the confirmed state change. | Only the narrowly approved action may run. |

Capabilities may not silently jump levels. `EXECUTE` requires authenticated authorization, server validation, idempotency, rate limiting, privacy-safe observability, rollback or compensation, and explicit product approval. Confirmation cannot be inferred from chat, old consent or a generated recommendation. Gemini may route/explain deterministic backend results but cannot invent authorization, targets, amounts or successful execution.

