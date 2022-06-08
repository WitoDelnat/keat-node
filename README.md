# Keat

Progressive and type-safe feature flags.

An easy way to increase your deployment frequency and reduce stress of releases.

[The library has just been released and I'm looking for your advice!](https://github.com/WitoDelnat/keat/issues/4)

## Key Features

- 🚀 Progressive rollouts, 🎯 targeted audiences and 📅 scheduled features.
- 🛠 Remote configuration without vendor lock-in.
- 💙 Amazing TypeScript support.
- 💡 Framework agnostic with React adaptor included.
- 🌳 Lightweight core with tree shakeable plugins.
- 🧪 Bi- and multivariates of any type.

You can also find the introductory blog-post [here](https://www.witodelnat.eu/blog/2022/introducing-keat).

## Getting started

Start by adding Keat to your codebase:

```bash
npm install keat
```

After installing Keat, you define your first **features** together with rules.

```typescript
import { keatCore } from "keat";

const { variation } = keatCore({
  features: {
    recommendations: true,
  } as const,
});

variation("recommendations") === true;
```

By default the rule can either be `true` or `false`, respectively to enable or disable it.
This is not very useful so let's continue by adding **plugins** to supercharge Keat.

### Enable features for particular users

Enabling features for particular users allows you to use trunk-based development, testing in production and preview releases for your adventurous users.

To do this you use the `audience` plugin.
This plugin takes each `string` of a rule and enables the feature when a matching function responds truthy.

```typescript
import { keatCore, audiences } from "keat";

const { variation } = keatCore({
  features: {
    recommendations: "staff",
  } as const,
  plugins: [
    audiences({
      staff: (user) => user.email?.endsWith("example.io"),
    }),
  ],
});

variation("recommendations", { email: "dev@example.io" }) === true;
variation("recommendations", { email: "jef@gmail.com" }) === false;
```

### Enable features for a percentage of users

Enabling features for a percentage of users allows canary and A/B testing.
By releasing to small and gradually increasing amount of users you gain confidence in stability and scalability.

To do this you use the `rollouts` plugin.
This plugin takes the first `number` of a rule and enables the feature for a percentage of users equal to that amount.

```typescript
import { keatCore, audiences, rollouts } from "keat";

const { variation } = keatCore({
  features: {
    recommendations: { or: ["staff", 25] },
  } as const,
  plugins: [
    audiences({
      staff: (user) => user.email?.endsWith("example.io"),
    }),
    rollouts(),
  ],
});

variation("recommendations", { email: "dev@example.io" }) === true;
variation("recommendations", { email: randomEmail() }); // `true` for 25% of users.
```

You might wonder how multiple plugins relate to each other.
Plugins are evaluated in FIFO order, so in this example the audiences are checked before the rollouts.
The evaluation short-circuits whenever a plugin sets a result.
When none is set the default behavior is used instead.

### Toggle features remotely

Toggling features is the bread and butter of any feature management tool.

Keat uses **configuration** to toggle features.

The format is a basic JSON object that maps the feature to its updated rule:

```json
{
  "recommendations": { "or": ["staff", 50] }
}
```

The plain format combined with custom plugins means possibilities are endless:

- Serve from Cloud Object Storage or embed it within your API.
- Use CloudFlare at edge or tools like Firebase Remote configuration.
- Open a WebSocket or use server-sent events to stream changes in real-time.

Or you can use the build-in `remoteConfig` to fetch it from an endpoint:

```typescript
import { keatCore, remoteConfig, audiences, rollouts } from "keat";

const { variation } = keatCore({
  features: {
    recommendations: false,
  } as const,
  plugins: [
    remoteConfig("http://example.io/config", { interval: 300 }),
    audiences({
      staff: (user) => user.email?.endsWith("example.io"),
    }),
    rollouts(),
  ],
});
```

## Examples

### Public landing page

Website without login or stable identity where you can still preview and A/B test optimal engagement.

Consider embedding **configuration** at build time since modern CI can rebuild it within a minute or two.
Environment variables favour operational simplicity over propagation speed.
You can get all the benefits of feature flags without the burden of infrastructure so nothing prevents you from getting started today!

```typescript
import {
  keatCore,
  fromEnv,
  localConfig,
  anonymous,
  audiences,
  schedule,
  rollouts,
} from "keat";
import featureJson from "./features.json";

export const keat = keatCore({
  features: {
    search: 30,
    halloweenDesign: { OR: ["preview", "2022-10-20"] },
  } as const,
  plugins: [
    localConfig({
      ...featureJson,
      search: fromEnv(process.env["TOGGLE_SEARCH"]),
    }),
    anonymous({ persist: true }),
    audiences({
      preview: () => {
        const queryString = window.location.search;
        const params = new URLSearchParams(queryString);
        return params.has("preview");
      },
    }),
    schedule(),
    rollouts(),
  ],
});
```

### Microservice with NodeJs

Keat works both in the browser and on NodeJs. Use it to measure performance optimizations, gradually migrate to a new integration or degrade your services when there is trouble on the horizon.

Keat is not restricted traditional boolean flags. Use bi- or multi-variates of any type to be more expressive in your feature flags. Keat will also properly infer the return type of your variates so you get immediate feedback on your usage.

```typescript
import { keatCore, rollouts } from "keat";

export const keat = keatCore({
  features: {
    enableJitCache: 50,
    notificationService: {
      variates: ["modern", "legacy"],
      when: 5,
    },
    rateLimit: {
      variates: [
        {
          level: "default",
          average: 1000,
          burst: 2000
        },
        {
          level: "degraded",
          average: 500,
          burst: 800,
        },
        {
          level: "disaster",
          average: 100,
          burst: 150,
        },
      ],
      when: [false, true, false],
    },
  } as const,
  plugins: [rollouts()],
});

keat.variation("notificationService", { id: requestId });
ReturnType<typeof keat.variation("rateLimit")> = { level: string; average: number; burst: number};
```

### SaaS application with React

Modern web application where developers can test in production, gather feedback through early previews and progressively rollout to maximise the chance of success.

Your remote configuration might be slow for a variety of reasons (e.g. viewer has slow 3G).
With **feature display** you can optimize individual boundaries instead of blocking your whole application.
It will feel familiar if you've worked with `font-display` before ([Playground](https://font-display.glitch.me/), [MDN Docs](https://developer.mozilla.org/en-US/docs/Web/CSS/@font-face/font-display)).

```tsx
import { keatReact, audiences, remoteConfig, rollouts } from "keat";

const { useKeat, FeatureBoundary } = keatReact({
  features: {
    search: false,
    redesign: false,
    sortAlgorithm: {
      variates: ["quicksort", "insertionSort", "heapsort"],
    },
  } as const,
  plugins: [
    remoteConfig("https://example.io/slowConfig", { interval: 300 }),
    audiences({
      staff: (user) => user.email?.endsWith("example.io"),
      preview: (user) => user.preview,
    }),
    rollouts(),
  ],
});

export function App() {
  const { variation } = useKeat();

  return (
    <div>
      <h1>Keat</h1>

      <FeatureBoundary name="redesign" fallback={<p>Your old design</p>}>
        <p>Your new design</p>
      </FeatureBoundary>

      <FeatureBoundary
        name="search"
        display="block"
        invisible={<SearchSkeleton />}
      >
        <Search />
      </FeatureBoundary>

      <SortedList data={[1, 3, 4]} algorithm={variation("sortAlgorithm")} />
    </div>
  );
}
```

## Plugins

### Build-in plugins

Rules:

- **audiences** takes all `strings` and enables the feature when its matching function responds truthy.
- **rollouts** takes the first `number` and enables the feature for a percentage of users equal to that amount.
- **schedule** takes all `string`-formatted dates and enables the feature when a date is in the past.

Configurations:

- **localConfig** fetches your configuration from a local JSON file or environment variables.
- **remoteConfig** fetches your configuration from a remote endpoint, which allows decoupling deploy from release.
- **customConfig** fetches your configuration with a customizable fetch.

Miscellaneous:

- **cache** adds simple caching to your evaluations which improve performance.
- **anonymous** adds a generated, stable identity, which allows reliable rollout results.

### Custom plugins

Plugins are plain old JavaScript objects with a simple interface that hooks
into the lifecycle of Keat. Checkout [the common plugin interface on GitHub](https://github.com/WitoDelnat/keat/blob/main/src/core/plugin.ts) to get a full view on the available context and API.

Here is a simple example of a plugin that cycles to the next variate each second:

```typescript
const cycle: Plugin = () => {
  let counter = 0;

  return {
    onPluginInit() {
      setInterval(() => counter++, 1000);
    },
    onEval({ variates }, { setResult }) {
      setResult(variates[counter % variates.length]);
    },
  };
};
```

## License

MIT
