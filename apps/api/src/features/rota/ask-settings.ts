export interface AskSettings {
  pingIntervalMs: number;
  questionsPerTenMinutes: number;
  questionsPerDay: number;
}

export const defaultAskSettings: AskSettings = {
  pingIntervalMs: 15_000,
  questionsPerTenMinutes: 10,
  questionsPerDay: 50,
};
