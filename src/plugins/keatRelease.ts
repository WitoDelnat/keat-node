import { Plugin } from "../core/plugin";

export const keatRelease = (appId: string): Plugin => {
  const fetchConfig = async (url: string) => {
    let timeout = 100;
    for (let i = 0; i < 3; i++) {
      try {
        const response = await fetch(url);

        if (!response.ok) throw new Error("fetch failed");

        const remoteConfig = await response.json();
        return remoteConfig;
      } catch (err) {
        timeout = timeout * 2;
        await pause(timeout);
      }
    }
  };

  return {
    onPluginInit: async (_ctx, { setConfig }) => {
      const url = `https://sync.keat.cloud/${appId}`;
      const remoteConfig = await fetchConfig(url);
      setConfig(remoteConfig);
    },
  };
};

function pause(ms: number): Promise<void> {
  return new Promise<void>((resolve) => setTimeout(resolve, ms));
}