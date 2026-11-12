export interface LoadBuildEnvResult {
  loaded: boolean;
  envPath: string;
  keysLoaded: string[];
}

export function loadBuildEnv(
  cwd?: string,
  options?: { override?: boolean }
): LoadBuildEnvResult;
