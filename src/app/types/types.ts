export type Message = {
  sender: 'user' | 'other';
  text: string;
};

export type Conversation = Message[];