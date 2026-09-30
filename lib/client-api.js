export async function apiRequest(url, options = {}) {
  let response;
  try {
    response = await fetch(url, { cache: 'no-store', ...options });
  } catch {
    throw new Error('Unable to connect. Please try again.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  if (data === null || typeof data !== 'object') {
    throw new Error('The server returned an unexpected response. Please try again.');
  }
  if (!response.ok) {
    const error = new Error(data?.error || 'Unable to complete the request. Please try again.');
    error.status = response.status;
    throw error;
  }
  return data;
}
