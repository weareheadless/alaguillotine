import type { Models } from "appwrite";

export interface MessageDocument extends Models.Document {
  text: string;
  author_id: string | null;
  author_name: string;
  amount_paid: number;
  is_shadowbanned: boolean;
  created_at: string;
}

export interface FeedMessage {
  $id: string;
  text: string;
  author_id: string | null;
  author_name: string;
  amount_paid: number;
  is_shadowbanned: boolean;
  created_at: string;
  parent_id: string | null;
}

export interface SubmitFreeResponse {
  success: boolean;
  error?: string;
}

export interface SubmitCommentResponse {
  success: boolean;
  error?: string;
}

export interface SubmitPaidResponse {
  success: boolean;
  error?: string;
  transactionSignature?: string;
}

export interface CounterData {
  total: number;
}
