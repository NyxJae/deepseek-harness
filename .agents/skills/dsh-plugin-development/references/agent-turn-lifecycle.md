# Agent turn lifecycle reference

Read this reference when a Host plugin owns an Agent turn, `followup()`, Session event listeners, per-conversation queues, cancellation, or an `AgentHandle`.

## Ownership rule

An outer wait threshold is not proof that the Agent turn ended. Do not resolve the conversation task, delete active-turn state, release a dispatcher/lease, or dispose the Agent handle merely because a timer fired.

Keep ownership until one of these is observable:

- the matching `turn/end` for the active turn;
- an explicit cancellation has completed and the Agent/followup path is quiescent;
- plugin disposal has cancelled or settled the owned work and suppresses later delivery.

Use an identity or generation check when clearing mutable active state. A stale completion must not clear a newer turn.

## Timeout layers

Keep clocks separate:

- provider/API/tool timeout: bounds one external operation;
- inactivity timeout: detects an Agent with no activity;
- queue/lease wait timeout: decides whether a follower may acquire ownership;
- acknowledgement timeout: classifies platform delivery;
- shutdown drain timeout: bounds teardown.

Do not convert one clock into another. An inactivity threshold should observe activity from model/tool/session events and long-running tool heartbeats. `0` must be explicitly normalized as unlimited when that is the contract. If an absolute safety ceiling exists, cancellation must be followed by quiescence or an explicit unknown state; never return from a race and silently continue the old Agent.

## Event and cancellation fences

At the Session event boundary, require a safe sequence strictly after the active turn's `startSeq`, and match the active turn number. Buffer or reconcile valid events observed while cancellation is pending if cancellation fails. Ignore stale events after a successful cancellation or a newer generation starts.

Only a real matching `turn/end` may produce a completed-turn diagnostic or final reply. Partial assistant text must not be treated as a completed response.

## Followup and disposal

Track the original `Agent.followup()` promise, not only a shutdown/cancellation wrapper. Attach rejection handling immediately. During disposal:

1. stop new input and queue admission;
2. cancel active turns and queued waiters;
3. await accepted followups, cancellation promises, and active turn tasks;
4. remove Session listeners and typing loops;
5. dispose Agent handles and connection resources;
6. clear active state only after no delivery is allowed.

A queued task that wakes during disposal must re-check the shutdown state before creating active ownership.

## Delivery and diagnostics

Separate Agent completion from platform delivery. Use one stable idempotency key for the final reply and classify `accepted`, `failed`, and `uncertain` independently. Record bounded diagnostic codes without reply bodies, credentials, tokens, or authorization headers. Recovery may re-deliver an already-produced message, but must not re-run the Agent solely because delivery is uncertain.

## Required evidence

Use a real Loader or assembled plugin seam plus deterministic fakes to cover:

- inactivity threshold followed by late `assistant/message` and `turn/end`;
- same-conversation queue serialization and no overlapping Agent work;
- explicit stop, cancellation failure, stale events, and numeric turn-id reuse;
- dispose with queued input and unresolved followup;
- duplicate external message ids;
- final delivery accepted, failed, uncertain, and thrown outcomes;
- strict event sequence rejection and credential-safe diagnostics.
