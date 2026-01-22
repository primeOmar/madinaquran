import { registerPlugin } from '@capacitor/core';
import type { AgoraScreenSharePlugin } from './definitions';

const AgoraScreenShare = registerPlugin<AgoraScreenSharePlugin>('AgoraScreenShare', {
  web: () => import('./web').then((m) => new m.AgoraScreenShareWeb()),
});

export * from './definitions';
export { AgoraScreenShare };