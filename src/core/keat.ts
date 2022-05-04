import { mapValues } from "lodash";
import { DEFAULT_HASH } from "./hash";
import { AfterEvalHook, Plugin } from "../plugins/plugin";
import { normalizeVariateRule, preprocessRule } from "./rules";
import type {
  AudienceFn,
  Config,
  HashFn,
  KeatInit,
  PhasedConfig,
  RawFeatures,
  User,
} from "./types";

export class Keat<TFeatures extends RawFeatures> {
  static create<TFeatures extends RawFeatures>(
    init: KeatInit<TFeatures>
  ): Keat<TFeatures> {
    return new Keat(init);
  }

  #userIdentifier: keyof User;
  #features: TFeatures;
  #audiences: Record<string, AudienceFn>;
  #config!: Record<string, PhasedConfig>;
  #hashFn: HashFn;
  #plugins: Plugin[];
  #initialized: Promise<void>;

  constructor(init: KeatInit<TFeatures>) {
    this.#userIdentifier = init.userIdentifier ?? "id";
    this.#features = init.features;
    this.#audiences = init.audiences ?? {};
    this.#hashFn = init.hashFn ?? DEFAULT_HASH;
    this.#plugins = init.plugins ?? [];
    this.#setConfig(init.config ?? {});
    this.#initialized = this.#initialize();
  }

  async #initialize(): Promise<void> {
    for (const plugin of this.#plugins) {
      await plugin.onPluginInit?.(
        {
          audiences: this.#audiences,
          features: this.#features,
          userIdentifier: this.#userIdentifier,
        },
        {
          setConfig: (newConfig) => this.#setConfig(newConfig),
        }
      );
    }
  }

  #setConfig(value: Config) {
    this.#config = mapValues(value, (r, feature) => {
      const isMultiVariate = this.#features[feature].length > 2;
      const rule = normalizeVariateRule(r, isMultiVariate);
      return preprocessRule(rule);
    });
    this.#plugins.forEach((p) => p.onConfigChange?.(value));
  }

  get ready(): Promise<void> {
    return this.#initialized;
  }

  eval<TName extends keyof TFeatures>(
    name: TName,
    user?: User
  ): TFeatures[TName][number] {
    let usr = user;
    let result: unknown;
    let afterEval: AfterEvalHook[] = [];

    this.#plugins.forEach((plugin) => {
      const callback = plugin.onEval?.(
        { name: name as string, user, userIdentifier: this.#userIdentifier },
        {
          setResult: (newResult) => (result = newResult),
          setUser: (newUser) => (usr = newUser as User),
        }
      );
      if (callback) afterEval.push(callback);
    });

    if (!result) {
      result = this.#doEval(name as string, usr);
    }

    afterEval.forEach((cb) => cb({ result }));
    return result;
  }

  #doEval<TName extends keyof TFeatures>(
    name: TName,
    user?: User
  ): TFeatures[TName][number] {
    const variants = this.#features[name];
    if (!variants) return undefined;
    const config = this.#config[name as string];
    if (!config) return variants[variants.length - 1];
    const { audience, rollout, fallback } = config;

    if (user && audience) {
      for (const [index, value] of audience.entries()) {
        if (value === true) return variants[index];
        if (value === false) continue;
        const match = value.some((a) => this.#audiences[a]?.(user));
        if (match) return variants[index];
      }
    }

    if (user && rollout) {
      const percentage = this.#hashFn(
        user,
        name as string,
        this.#userIdentifier
      );
      for (const [index, value] of rollout.entries()) {
        if (value === false) continue;
        if (percentage <= value) return variants[index];
      }
    }

    return variants[fallback];
  }
}