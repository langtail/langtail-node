"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
import zod from "zod";
import { AiLoading } from "./AiLoading";
import { ChatCompletionAssistantMessageParam } from "openai/resources";
import { useAIStream } from "../../../src/react/useAIStream/index";

const aiDataSchema = zod.object({
  id: zod.string(),
  choices: zod.array(
    zod.object({
      finish_reason: zod.string(),
      message: zod.object({
        content: zod.string().nullable(),
        role: zod.enum(["user", "assistant", "tool"]),
        tool_calls: zod
          .array(
            zod.object({
              function: zod.object({
                name: zod.string(),
                arguments: zod.string(),
              }),
              id: zod.string(),
              type: zod.string(),
            }),
          )
          .optional(),
      }),
    }),
  ),
});

type AIData = zod.infer<typeof aiDataSchema>;

const UserMessage = ({ text }: { text: string | null }) => {
  return <div className={styles.userMessage}>{text}</div>;
};

const AssistantMessage = ({ text }: { text: string | null }) => {
  return (
    <div className={styles.assistantMessage}>
      <Markdown>{text}</Markdown>
    </div>
  );
};

const Message = ({ role, content }: ChatMessage) => {
  switch (role) {
    case "user":
      return <UserMessage text={content} />;
    case "assistant":
      return <AssistantMessage text={content} />;
    default:
      return null;
  }
};

type ChatProps = {
  functionCallHandler?: (
    toolCall: ChatCompletionAssistantMessageParam,
  ) => Promise<ChatMessage[] | undefined>;
};

export type ChatMessage = AIData["choices"][number]["message"] & {
  deltaPlaceholder?: boolean;
};

const Chat = ({ functionCallHandler }: ChatProps) => {
  const [userInput, setUserInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [generatingResponse, setGeneratingResponse] = useState<boolean>(false);
  const messageRef = useRef<ChatMessage[]>([]);
  const [inputDisabled, setInputDisabled] = useState(false);

  const handleRunCompleted = () => {
    setInputDisabled(false);
    setGeneratingResponse(false);
  };

  const { invoke } = useAIStream(
    (localMessages: ChatMessage[]) =>
      fetch(`/api/langtail`, {
        method: "POST",
        body: JSON.stringify({ messages: localMessages }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => res.body),
    {
      onText: (delta) => {
        appendDeltaToTheLastMessage(delta);
      },
      onToolCall: (toolCall) => {
        functionCallHandler?.(toolCall).then((toolMessages) => {
          if (toolMessages) {
            const messages = appendMessages([
              {
                ...toolCall,
                content: "", // NOTE: ensure that the message insn't duplicated due to onText chunk streaming
              },
              ...toolMessages,
            ]);
            invoke(messages);
          }
        });
      },
      onStart: () => {
        setGeneratingResponse(true);
        setInputDisabled(true);
      },
      onEnd: handleRunCompleted,
    },
  );

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const appendMessages = (newMessages: ChatMessage[]) => {
    messageRef.current = [...messageRef.current, ...newMessages];
    setMessages([...messageRef.current]);

    return messageRef.current;
  };

  const appendDeltaToTheLastMessage = (messageDelta) => {
    const maybeDetlaLastMessage =
      messageRef.current[messageRef.current.length - 1];
    // NOTE: when appending a delta, ensure that there is a message for it prepared
    if (!maybeDetlaLastMessage.deltaPlaceholder) {
      messageRef.current = [
        ...messageRef.current,
        {
          role: "assistant",
          content: "",
          deltaPlaceholder: true,
        },
      ];
    }

    const lastMessage = messageRef.current[messageRef.current.length - 1];
    lastMessage.content += messageDelta;
    setMessages([...messageRef.current]);
    return messageRef.current;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() || inputDisabled) return;

    invoke(appendMessages([{ role: "user" as const, content: userInput }]));

    setUserInput("");
    scrollToBottom();
  };

  return (
    <div className={styles.chatContainer}>
      <div className={styles.messages}>
        {messages
          .filter((msg) => msg.content)
          .map((msg, index) => (
            <Message key={index} role={msg.role} content={msg.content} />
          ))}
        {generatingResponse && <AiLoading />}
        <div ref={messagesEndRef} />
      </div>
      <form
        onSubmit={handleSubmit}
        className={`${styles.inputForm} ${styles.clearfix}`}
      >
        <input
          type="text"
          className={styles.input}
          value={userInput}
          onChange={(e) => setUserInput(e.target.value)}
          placeholder="Enter your question"
        />
        <button
          type="submit"
          className={styles.button}
          disabled={inputDisabled}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
