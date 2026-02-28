export interface ListItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export type ListType = 'shopping' | 'todo' | 'other';

export interface UserList {
  _id?: string;
  name: string;
  listType: ListType;
  ownerId: string;
  authorizedUsers: string[];
  items: ListItem[];
  shareToken: string;
  createdAt: string;
}

export interface CreateListRequest {
  name: string;
  listType: ListType;
  ownerId: string;
}

export interface AddItemRequest {
  text: string;
}

export interface UpdateItemRequest {
  text: string;
}

export interface UpdateListRequest {
  name: string;
  listType: ListType;
}

export interface JoinListRequest {
  userId: string;
}
