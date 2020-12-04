export interface PersistOptions {
  key?: string;
  persistKey?: string;
  persisted?: boolean;
  toJson?: (val: any) => any;
  fromJson?: (json: any) => any;
}

export interface PersistConfiguration {
  storage: PersistStorage;
  // verbose?: boolean;
  // saveDebounce?: number;
}

export interface PersistStorage {
  getItem(key: string): Promise<string | null> | string | null;
  setItem(key: string, value: string): Promise<void> | void;
}