import jsan from "jsan";
import { BaseObservable, Observable, Plugin, WritableObservable } from "micro-observables";
import { PersistConfiguration, PersistOptions } from "./types";

const storageMetaKey = "micro-observables-persist:meta";

interface StorageMeta {
  keys: Set<string>;
}

interface RestoredState {
  [key: string]: string;
}

interface PersistOptionsInternal extends PersistOptions {
  _persistRestoring: boolean
}

export class PersistPlugin implements Plugin {
  private _config: PersistConfiguration;
  private _meta: StorageMeta = { keys: new Set() };
  private _restoredState: RestoredState | null = null
  private _observablesToRestore: { [key: string]: WritableObservable<any> } = {}
  
  constructor(config: PersistConfiguration) {
    this._config = config;
  }

  async restore(): Promise<void> {
    const { storage } = this._config;

    const serializedMeta = await storage.getItem(storageMetaKey);
    const meta = (serializedMeta ? jsan.parse(serializedMeta) : { keys: new Set() }) as StorageMeta;

    const restoredState: RestoredState = {}
    for (const key of meta.keys) {
      const serializedValue = await storage.getItem(key);
      if (serializedValue !== null) {
        restoredState[key] = serializedValue;
      }
    }

    this._meta = meta;
    this._restoredState = restoredState;
    
    for (const key of Object.keys(this._observablesToRestore)) {
      this.restoreValueToObservable(key, this._observablesToRestore[key])
    }
    this._observablesToRestore = {}
  }

  onCreate(observable: BaseObservable<any>) {
    if (observable instanceof WritableObservable) {
      const key = keyForObservable(observable);
      if (key) {
        if (!this._restoredState) {
          this._observablesToRestore[key] = observable
        } else {
          this.restoreValueToObservable(key, observable)
        }
      }
    }
  }

  onChange(observable: BaseObservable<any>, val: any) {
    if (observable instanceof WritableObservable) {
      const key = keyForObservable(observable);
      if (key) {
        const { toJson, _persistRestoring } = observable.options<PersistOptionsInternal>();
        if (!_persistRestoring) {
          const json = toJson ? toJson(val) : val;
          const serialized = jsan.stringify(json, undefined, undefined, true);
          this.saveValueToStorage(key, serialized);
        }
      }
    }
  }

  private restoreValueToObservable(key: string, observable: WritableObservable<any>) {
    if (this._restoredState && this._restoredState[key] !== undefined) {
      const { fromJson } = observable.options<PersistOptions>();
      const json = jsan.parse(this._restoredState[key]);
      const value = fromJson ? fromJson(json) : json
      
      try {
        observable.withOptions<PersistOptionsInternal>({ _persistRestoring: true })
        observable.set(value);
      } finally {
        observable.withOptions<PersistOptionsInternal>({ _persistRestoring: false })
      }
      
      delete this._restoredState[key];  
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
