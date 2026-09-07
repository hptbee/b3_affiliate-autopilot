import { SocialPublishError, type PublishFailureOutcome } from '@social-autopilot/core';
import { isFacebookGraphError } from './client.js';

export function mapFacebookError(error: unknown): SocialPublishError {
  if (error instanceof SocialPublishError) {
    return error;
  }

  if (!isFacebookGraphError(error)) {
    const message = error instanceof Error ? error.message : 'Unknown Facebook publish error';
    if (/timeout|timed out|network/i.test(message)) {
      return new SocialPublishError(message, 'uncertain');
    }
    return new SocialPublishError(message, 'failed');
  }

  const graphError = error.facebookError;
  const code = graphError?.code;
  const subcode = graphError?.error_subcode;
  const message = graphError?.message ?? error.message;
  const outcome = classifyFacebookError(error.status, code, subcode);

  return new SocialPublishError(message, outcome, {
    facebookCode: code,
    facebookSubcode: subcode,
    httpStatus: error.status,
  });
}

function classifyFacebookError(
  status?: number,
  code?: number,
  subcode?: number,
): PublishFailureOutcome {
  if (status === 429 || code === 4 || code === 17 || code === 32) {
    return 'failed';
  }

  if (status && status >= 500) {
    return 'uncertain';
  }

  if (code === 190 || code === 102 || code === 10 || code === 200 || code === 294) {
    return 'dead';
  }

  if (subcode === 460 || subcode === 463 || subcode === 467) {
    return 'dead';
  }

  if (status && status >= 400 && status < 500) {
    return 'dead';
  }

  return 'failed';
}
