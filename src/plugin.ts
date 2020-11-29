import jsan from "jsan";
import { BaseObservable, Observable, Plugin, WritableObservable } from "micro-observables";
import { PersistOptions } from "./options";
import { Storage } from "./storage";

const storageMetaKey = "micro-observables-persist:meta";

interface Configuration {
  storage: Storage;
  // verbose?: boolean;
  // saveDebounce?: number;
}

interface StorageMeta {
  keys: Set<string>;
}

interface LoadedState {
  [key: string]: string;
}

export class PersistPlugin implements Plugin {
  private _config: Configuration;
  private _meta: StorageMeta = { keys: new Set() };
  private _loadedState: LoadedState = {};

  private constructor(config: Configuration) {
    this._config = config;
  }

  static async init(config: Configuration): Promise<PersistPlugin> {
    const plugin = new PersistPlugin(config);
    await plugin.loadStateFromStorage();
    return plugin;
  }

  onCreate(observable: BaseObservable<any>) {
    if (observable instanceof WritableObservable) {
      const key = keyForObservable(observable);
      if (key && this._loadedState[key] !== undefined) {
        const { fromJson } = observable.options<PersistOptions>();
        const json = jsan.parse(this._loadedState[key]);
        observable.set(fromJson ? fromJson(json) : json);
        delete this._loadedState[key];
      }
    }
  }

  onChange(observable: BaseObservable<any>, val: any) {
    if (observable instanceof WritableObservable) {
      const key = keyForObservable(observable);
      if (key) {
        const { toJson } = observable.options<PersistOptions>();
        const json = toJson ? toJson(val) : val;
        const serialized = jsan.stringify(json, undefined, undefined, true);
        this.saveValueToStorage(key, serialized);
      }
    }
  }

  private async loadStateFromStorage(): Promise<void> {
    const { storage } = this._config;

    const serializedMeta = await storage.getItem(storageMetaKey);
    if (serializedMeta !== null) {
      this._meta = jsan.parse(serializedMeta) as StorageMeta;
    }

    for (const key of this._meta.keys) {
      const serializedValue = await storage.getItem(key);
      if (serializedValue !== null) {
        this._loadedState[key] = serializedValue;
      }
    }
  }

  private async saveValueToStorage(key: string, value: string): Promise<void> {
    const { storage } = this._config;

    await storage.setItem(key, value);

    if (!this._meta.keys.has(key)) {
      this._meta.keys.add(key);
      await storage.setItem(storageMetaKey, jsan.stringify(this._meta, undefined, undefined, true));
    }
  }
}

function keyForObservable(observable: Observable<any>): string | null {
  const options = observable.options<PersistOptions>();
  if (options.persistKey) {
    return options.persistKey;
  } else if (options.key && options.persisted) {
    return options.key;
  } else {
    return null;
  }
}
