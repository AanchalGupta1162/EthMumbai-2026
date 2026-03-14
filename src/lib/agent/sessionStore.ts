// src/lib/agent/sessionStore.ts
//
// In-memory per-user/per-chat session state for multi-channel support.
// Keyed by session ID: browser tab for web, chat ID for Telegram/WhatsApp.
// Replace with Redis or a database for production use.

import type { TripPolicy } from "./runAgent";

export interface ChatMessage {
  role: "user" | "agent";
  content: string;
  timestamp: number;
}

export interface Session {
  id: string;
  policy: TripPolicy | null;
  history: ChatMessage[];
  createdAt: number;
  lastActiveAt: number;
}

const sessions = new Map<string, Session>();

/** Max session age before auto-cleanup (1 hour) */
const MAX_AGE_MS = 60 * 60 * 1000;

export function getSession(id: string): Session {
  let session = sessions.get(id);
  if (!session) {
    session = {
      id,
      policy: null,
      history: [],
      createdAt: Date.now(),
      lastActiveAt: Date.now(),
    };
    sessions.set(id, session);
  }
  session.lastActiveAt = Date.now();
  return session;
}

export function updatePolicy(id: string, policy: Partial<TripPolicy>): void {
  const session = getSession(id);
  session.policy = session.policy
    ? { ...session.policy, ...policy }
    : (policy as TripPolicy);
}

export function addMessage(id: string, role: ChatMessage["role"], content: string): void {
  const session = getSession(id);
  session.history.push({ role, content, timestamp: Date.now() });
}

export function deleteSession(id: string): void {
  sessions.delete(id);
}

/** Purge stale sessions older than MAX_AGE_MS */
export function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.lastActiveAt > MAX_AGE_MS) {
      sessions.delete(id);
    }
  }
}
