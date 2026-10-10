## Transport is not verification

Hyperlane is a cross-chain messaging protocol. An application on one chain sends a message; an application on another chain decides whether to accept it and what to do with it.

:::callout{kind="note" title="The essential distinction"}
**A relayer transports a message. A security module verifies it.** Transporting a message does not grant authority to decide whether the message is authentic.
:::

A token bridge is one possible application of this messaging layer. The protocol does not move a token object between chains: applications change local state in response to messages.

## Follow one message

![Message delivery roles](assets/message-flow.svg)

1. The sending application asks its local Mailbox to dispatch a message.
2. A relayer observes the source chain and collects the required verification material.
3. The relayer submits the message to the destination Mailbox.
4. The destination Mailbox asks the selected security module to verify the message.
5. After verification, the receiving application checks authorization and applies its business rules.

| Participant | Responsibility | Boundary |
| --- | --- | --- |
| Sending application | Create a business instruction | Cannot execute a destination transaction directly |
| Relayer | Carry the message and verification material | Does not choose the receiving application's trust rules |
| Security module | Evaluate the selected acceptance rules | Does not automatically authorize every business operation |
| Receiving application | Interpret the message and update state | Must protect its own entry point and permissions |

## Two different questions

::::tabs
:::tab{title="Transport"}
The relayer brings the message and verification material to the destination chain. Other participants may also submit a valid message.
:::
:::tab{title="Verification"}
The receiving application chooses the acceptance rules.
:::
::::

Permissionless submission does not imply unconditional delivery. A message can remain undelivered if nobody is willing or able to submit it.

:::callout{kind="warning" title="Sending success is not receiving success"}
The source and destination actions normally occur in separate transactions. A destination failure does not automatically undo a confirmed source transaction.
:::

## Authenticity is not authorization

An attacker can send a real message on the source chain. Proving that this message was sent does not prove that its requested business operation is permitted.

::::columns
:::column
### Protocol acceptance

The selected security module checks the message against its trust assumptions. The strength of this check depends on the actual module, configuration, and implementation.
:::
:::column
### Application authorization

The receiving application checks the local caller, the remote domain and sender, and the requested state transition. These checks remain necessary even for an authentic message.
:::
::::

## Check your understanding

Try answering before opening each explanation.

:::details{title="Who is the sender when a wallet calls a sending application?"}
The sending application, not the user's wallet.
:::

:::details{title="Does a destination failure roll back the source transaction?"}
No. Cross-chain execution is not one atomic transaction. Recovery or compensation must be designed by the application.
:::

:::details{title="Why might a verified message still be rejected?"}
The remote sender may not be authorized, or the requested operation may violate a business rule.
:::

:::callout{kind="tip" title="What to remember"}
Keep three responsibilities separate: **transport**, **verification**, and **application authorization**.
:::

## Further reading

- [Hyperlane protocol overview](https://docs.hyperlane.xyz/docs/protocol/protocol-overview)
- [Mailbox documentation](https://docs.hyperlane.xyz/docs/protocol/core/mailbox)

These notes are an introductory model, not a protocol specification. Check the deployed configuration and the matching source version before making security claims.
