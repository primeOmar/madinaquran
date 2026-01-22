export interface AgoraScreenSharePlugin {
  /**
   * Triggers the Android Screen Share permission and starts the foreground service.
   * Returns a status if permission was granted.
   */
  startScreenShare(): Promise<{ status: string }>;

  /**
   * Stops the screen sharing session and kills the foreground service.
   */
  stopScreenShare(): Promise<void>;
}