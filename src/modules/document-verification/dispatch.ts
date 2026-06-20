/** Fire-and-forget OCR / verification jobs — never block upload responses. */
export const dispatchVerificationJob = (task: () => Promise<void>, context: string): void => {
  void task().catch(err => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[doc-verify] ${context} failed:`, msg);
  });
};
