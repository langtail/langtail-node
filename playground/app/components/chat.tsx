"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./chat.module.css";
import Markdown from "react-markdown";
import zod from "zod";
import { AiLoading } from "./AiLoading";
import {
  ChatCompletionAssistantMessageParam,
  ChatCompletionMessageToolCall,
} from "openai/resources";
import { useChatStream } from "../../../src/react/useChatStream";

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
    toolCall: ChatCompletionMessageToolCall,
    message: ChatCompletionAssistantMessageParam,
  ) => Promise<string> | string | undefined;
  onStart?: () => void;
};

export type ChatMessage = AIData["choices"][number]["message"] & {
  deltaPlaceholder?: boolean;
};

const Chat = ({ functionCallHandler, onStart }: ChatProps) => {
  const [userInput, setUserInput] = useState("");

  const { isLoading, messages, send } = useChatStream({
    fetcher: (localMessages) =>
      fetch(`/api/langtail`, {
        method: "POST",
        body: JSON.stringify({ messages: localMessages }),
        headers: {
          "Content-Type": "application/json",
        },
      }).then((res) => res.body),
    onToolCall: (toolCall, message) =>
      functionCallHandler?.(toolCall, message) ?? "Data not available",
    onStart: () => {
      onStart?.();
    },
  });

  // automatically scroll to bottom of chat
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!userInput.trim() || isLoading) return;

    const nextMessages = [{ role: "user" as const, content: userInput }];

    send(nextMessages);

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
        {isLoading && <AiLoading />}
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
        <button type="submit" className={styles.button} disabled={isLoading}>
          Send
        </button>
      </form>
    </div>
  );
};

export default Chat;
