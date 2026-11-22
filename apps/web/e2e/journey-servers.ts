const isolated = process.env.E2E_ISOLATED === 'true';

export const apiPort = isolated ? 3200 : 3000;
export const webPort = isolated ? 5273 : 5173;
