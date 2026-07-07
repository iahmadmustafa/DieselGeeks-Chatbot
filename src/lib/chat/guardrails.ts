import type { UIMessage } from "ai";

import {
  getChatMaxHistoryMessages,
  getChatMaxMessageLength,
} from "@/lib/env/read-env";

function getTextFromMessage(message: UIMessage): string {
  return message.parts
    .filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("");
}

export function getLastUserMessageText(messages: UIMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message.role === "user") {
      return getTextFromMessage(message);
    }
  }

  return "";
}

export function validateChatMessages(messages: UIMessage[]): string | null {
  if (messages.length === 0) {
    return "At least one message is required";
  }

  const lastUserText = getLastUserMessageText(messages);
  if (!lastUserText.trim()) {
    return "Last user message must include text";
  }

  const maxLength = getChatMaxMessageLength();
  if (lastUserText.length > maxLength) {
    return `Message exceeds maximum length of ${maxLength} characters`;
  }

  return null;
}

export function trimChatHistory<T extends UIMessage>(messages: T[]): T[] {
  const maxMessages = getChatMaxHistoryMessages();
  if (messages.length <= maxMessages) {
    return messages;
  }

  return messages.slice(-maxMessages);
}

export function previewText(text: string, maxLength = 200): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  return `${trimmed.slice(0, maxLength)}…`;
}

export function isValidSessionId(sessionId: string): boolean {
  return /^[a-zA-Z0-9_-]{8,64}$/.test(sessionId);
}
