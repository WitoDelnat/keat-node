import { NormalizedRule, Plugin, User } from "../core";

type AudiencesPluginOptions = Record<string, AudienceFn>;
type AudienceFn = (user?: User) => boolean | undefined;

export const useAudiences = (options: AudiencesPluginOptions): Plugin => {
  const audiences = options;
  let featureMap: Record<string, unknown[]> = {};
  let audienceRules: Record<string, false | Array<string[] | boolean>>;

  return {
    onPluginInit({ features }) {
      featureMap = features;
    },
    onConfigChange(config) {
      audienceRules = Object.fromEntries(
        Object.entries(config).map(([feature, rule]) => {
          return [feature, preprocessAudiences(rule)];
        })
      );
    },
    onEval({ user, feature, result }, { setResult }) {
      if (result || !user) return;
      const variates = featureMap[feature];
      const rule = audienceRules[feature];
      if (!variates || !rule) return;

      for (const [index, value] of rule.entries()) {
        if (value === true) return setResult(variates[index]);
        if (value === false) continue;
        const match = value.some((a) => {
          try {
            return audiences[a]?.(user);
          } catch {
            return false;
          }
        });
        if (match) return setResult(variates[index]);
      }
    },
  };
};

function preprocessAudiences(rule: NormalizedRule[]) {
  const audienceRule = rule.map((p) => {
    if (typeof p === "boolean") return p;
    const arr = p.filter((v): v is string => typeof v === "string");
    return arr.length === 0 ? false : arr;
  });
  const skipAudiencePhase = audienceRule.every((p) => p === false);
  return skipAudiencePhase ? false : audienceRule;
}
