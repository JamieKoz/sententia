import type { OnboardingAnswers, Title } from "../types";

export interface GroupRoomCreateResponse {
  roomCode: string;
  participantId: string;
  shareUrl: string;
}

export interface GroupRoomJoinResponse {
  participantId: string;
  roomCode: string;
  deck: Title[];
}

export interface GroupRoomStatus {
  roomCode: string;
  participantsReady: number;
  participantsTotal: number;
  maxParticipants: number;
  readyToReveal: boolean;
  revealed: boolean;
  overlapTitleIds: string[];
  participantFinalPicks: Array<{
    participantId: string;
    titleId?: string;
  }>;
  participantCompromisePicks: Array<{
    participantId: string;
    titleId?: string;
  }>;
  participantCompromiseRequests: Array<{
    participantId: string;
    requested: boolean;
  }>;
  compromiseRequested: boolean;
  sharedCompromiseId?: string;
  compromiseMatched: boolean;
}

export interface GroupRoomRevealResponse {
  roomCode: string;
  overlapTitleIds: string[];
}

export interface GroupRoomFinalPickResponse {
  participantFinalPicks: Array<{
    participantId: string;
    titleId?: string;
  }>;
}

export interface GroupRoomCompromisePickResponse {
  participantCompromisePicks: Array<{
    participantId: string;
    titleId?: string;
  }>;
  participantCompromiseRequests: Array<{
    participantId: string;
    requested: boolean;
  }>;
  compromiseRequested: boolean;
  compromiseReady: number;
  sharedCompromiseId?: string;
  compromiseMatched: boolean;
}

export interface GroupRoomCompromiseStartResponse {
  participantCompromiseRequests: Array<{
    participantId: string;
    requested: boolean;
  }>;
  compromiseRequested: boolean;
}

export async function createGroupRoom(input: {
  answers: OnboardingAnswers;
  watchRegion: string;
}): Promise<GroupRoomCreateResponse & { deck: Title[] }> {
  const response = await fetch("/api/group/rooms", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input)
  });
  return parseJsonResponse<GroupRoomCreateResponse & { deck: Title[] }>(response);
}

export async function joinGroupRoom(roomCode: string, participantId?: string): Promise<GroupRoomJoinResponse> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/join`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(participantId ? { participantId } : {})
  });
  return parseJsonResponse<GroupRoomJoinResponse>(response);
}

export async function submitGroupShortlist(
  roomCode: string,
  participantId: string,
  shortlist: string[]
): Promise<{ participantsReady: number; participantsTotal: number }> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/submit`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId, shortlist })
  });
  return parseJsonResponse<{ participantsReady: number; participantsTotal: number }>(response);
}

export async function getGroupRoomStatus(roomCode: string, participantId?: string): Promise<GroupRoomStatus> {
  const query = participantId ? `?participantId=${encodeURIComponent(participantId)}` : "";
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/status${query}`);
  return parseJsonResponse<GroupRoomStatus>(response);
}

export async function revealGroupRoom(roomCode: string, participantId: string): Promise<GroupRoomRevealResponse> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/reveal`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId })
  });
  return parseJsonResponse<GroupRoomRevealResponse>(response);
}

export async function submitGroupFinalPick(
  roomCode: string,
  participantId: string,
  winnerId: string
): Promise<GroupRoomFinalPickResponse> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/final-pick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId, winnerId })
  });
  return parseJsonResponse<GroupRoomFinalPickResponse>(response);
}

export async function submitGroupCompromisePick(
  roomCode: string,
  participantId: string,
  winnerId: string
): Promise<GroupRoomCompromisePickResponse> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/compromise-pick`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId, winnerId })
  });
  return parseJsonResponse<GroupRoomCompromisePickResponse>(response);
}

export async function startGroupCompromiseShowdown(
  roomCode: string,
  participantId: string
): Promise<GroupRoomCompromiseStartResponse> {
  const response = await fetch(`/api/group/rooms/${encodeURIComponent(roomCode)}/compromise-start`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ participantId })
  });
  return parseJsonResponse<GroupRoomCompromiseStartResponse>(response);
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  if (response.ok) {
    return (await response.json()) as T;
  }

  let message = `Request failed with status ${response.status}`;
  try {
    const body = (await response.json()) as { error?: string };
    if (body.error) message = body.error;
  } catch {
    /* ignore JSON parsing */
  }
  throw new Error(message);
}
