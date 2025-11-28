export interface UserDetails {
  name: string;
  email: string;
  phone: string;
  company: string;
  interest: string;
}

export interface Message {
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export enum AppState {
  FORM = 'FORM',
  CONSULTATION = 'CONSULTATION',
  PROPOSAL_GENERATION = 'PROPOSAL_GENERATION',
  PROPOSAL_VIEW = 'PROPOSAL_VIEW',
  TERMINATED = 'TERMINATED'
}