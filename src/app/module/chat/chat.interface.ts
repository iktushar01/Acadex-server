export interface IGroupMessageSender {
  id: string;
  name: string;
  image: string | null;
}

export interface IGroupMessageView {
  id: string;
  classroomId: string;
  content: string;
  createdAt: Date;
  sender: IGroupMessageSender;
}

export interface ISendMessagePayload {
  userId: string;
  classroomId: string;
  content: string;
}

export interface IGetMessagesPayload {
  userId: string;
  classroomId: string;
  cursor?: string;
  limit?: number;
}

export interface IGetMessagesResult {
  messages: IGroupMessageView[];
  hasMore: boolean;
  nextCursor: string | null;
}

export interface IDeleteMessagePayload {
  userId: string;
  messageId: string;
}

export interface IDeleteMessageResult {
  id: string;
  classroomId: string;
}
