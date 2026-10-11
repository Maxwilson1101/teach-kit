import { defineCourse } from "teach-kit";

export default defineCourse({
  title: "Hyperlane 协议学习",
  description:
    "跟随一条消息从一条链抵达另一条链，理解谁负责传输、谁负责验证，以及应用授权从哪里开始。",
  lessons: [
    {
      id: "message-lifecycle",
      title: "协议模型与消息生命周期",
      description: "区分消息传输、验证和应用授权。",
    },
    {
      id: "mailbox",
      title: "Mailbox 与消息身份",
      description: "理解消息的发送、接收，以及同一消息为何不能执行两次。",
    },
    {
      id: "rendering",
      title: "渲染示例：公式、代码与图表",
      description: "检查公式、代码高亮与 Mermaid 图表在当前主题下的呈现。",
    },
    {
      id: "security",
      title: "可配置的安全机制与信任假设",
      description: "考察每个接收应用选择的消息接收规则。",
    },
    {
      id: "delivery",
      title: "异步交付与失败边界",
      description: "探索重试、交付激励和恢复责任。",
    },
  ],
});
