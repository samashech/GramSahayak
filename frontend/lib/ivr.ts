import type { IvrStep } from './types';

// Contract section 7: an IvrStep's `stage` is where the call now is; this is the input it waits for
// and therefore the `stage` the phone sends next.
export type IvrInput = 'language' | 'category' | 'speech' | 'goodbye' | 'none';

export function awaitedInput(stage: IvrStep['stage'] | undefined): IvrInput {
  switch (stage) {
    case 'greeting': return 'language';
    case 'language': return 'category';
    case 'category': return 'speech';
    case 'answer': return 'speech'; // voice agent: the caller may ask again; hanging up sends goodbye
    default: return 'none';
  }
}

export const acceptsDigits = (stage: IvrStep['stage'] | undefined) => {
  const next = awaitedInput(stage);
  return next === 'language' || next === 'category';
};

// Label for the webhook drawer: the stage the phone sent (what CloudTalk would send).
export function webhookLabel(log: IvrStep['webhookLog']): string {
  const req = (log?.request ?? {}) as Record<string, unknown>;
  if (typeof req.stage === 'string') return req.stage;
  if (req.event === 'hangup') return 'goodbye';
  if (req.recording_url !== undefined || req.text !== undefined) return 'speech';
  return 'incoming';
}
