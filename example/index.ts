import { defineCourse } from "teach-kit";

export default defineCourse({
  title: "Hyperlane Protocol Study",
  description:
    "Follow a message from one chain to another. Understand who transports it, who verifies it, and where application authorization begins.",
  lessons: [
    {
      id: "message-lifecycle",
      title: "Protocol model and message lifecycle",
      description: "Separate transport, verification, and application authorization.",
    },
    {
      id: "mailbox",
      title: "Mailbox and message identity",
      description: "Understand sending, receiving, and why one message must not execute twice.",
    },
    {
      id: "security",
      title: "Configurable security and trust assumptions",
      description: "Examine the acceptance rules chosen by each receiving application.",
    },
    {
      id: "delivery",
      title: "Asynchronous delivery and failure boundaries",
      description: "Explore retries, delivery incentives, and recovery responsibilities.",
    },
  ],
});
