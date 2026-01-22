import { WebPlugin } from '@capacitor/core';
import type { AgoraScreenSharePlugin } from './definitions';

export class AgoraScreenShareWeb extends WebPlugin implements AgoraScreenSharePlugin {
  
  async startScreenShare(): Promise<{ status: string }> {
    console.warn('Screen share is only available on Native Android.');
    return { status: 'not_implemented' };
  }

  async stopScreenShare(): Promise<void> {
    console.log('Stopping screen share (Web placeholder)');
  }
}