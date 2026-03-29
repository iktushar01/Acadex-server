export interface IUpsertNoticePayload {
  content: string;
  updatedBy: string;
}

export interface IToggleNoticePayload {
  isActive: boolean;
  updatedBy: string;
}
