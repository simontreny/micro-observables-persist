export interface PersistOptions {
  key?: string;
  persistKey?: string;
  persisted?: boolean;
  toJson?: (val: any) => any;
  fromJson?: (json: any) => any;
}
