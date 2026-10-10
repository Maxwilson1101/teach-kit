## One interface on each chain

A Mailbox is the protocol entry point for sending and receiving messages. It does not make two chains behave like one synchronous application.

:::callout{kind="note" title="Read the fields as a boundary"}
The origin domain and sender identify the remote source. The destination domain and recipient identify the intended receiving environment.
:::

## Message identity and duplicate execution

Messages need stable identities so the receiving flow can distinguish a new delivery from a repeated attempt. Applications must also reason about their own business-level duplicate requests.

| Question | Protocol concern | Application concern |
| --- | --- | --- |
| Was this message already delivered? | Message identity and delivery tracking | Do not confuse a transport retry with a new instruction |
| Is the remote sender allowed? | Carry the source fields | Validate the expected domain and application |
| Is this operation legal now? | Invoke the recipient after verification | Enforce business state and permissions |

## A short review

:::details{title="Does receiving a message establish every permission?"}
No. Protocol verification and application authorization remain separate responsibilities.
:::

The next planned lesson examines configurable security. It is intentionally not linked until its Markdown body exists.
