/**
 * API Service for communicating with the Go backend
 * Uses HTTPClient with automatic retry logic and request/response interceptors
 */

import httpClient from './httpClient';

/**
 * Send Lumens (XLM) to a recipient using the Go backend
 * Automatically retries on network errors with exponential backoff
 * @param {string} recipient - The recipient's Stellar address
 * @param {string} amount - The amount to send (as string)
 * @returns {Promise<{message: string, hash: string}>}
 */
export async function sendLumens(recipient, amount) {
  const result = await httpClient.post('/api/send', {
    recipient,
    amount: amount.toString(),
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to send lumens');
  }

  return result.data;
}

/**
 * Check if the Go backend is running
 * Uses health check endpoint with retry capability
 * @returns {Promise<boolean>}
 */
export async function checkBackendHealth() {
  const result = await httpClient.get('/api/health');

  if (!result.success) {
    console.warn('Backend health check failed:', result.error);
    return false;
  }

  const data = result.data;
  return data && typeof data.status === 'string' && data.status.toLowerCase() === 'ok';
}

export default {
  sendLumens,
  checkBackendHealth,
};

