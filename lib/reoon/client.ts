/**
 * Reoon Email Verifier API Client
 *
 * Documentation: https://www.reoon.com/articles/api-documentation-of-reoon-email-verifier/
 */

const REOON_API_BASE = 'https://emailverifier.reoon.com/api/v1';

export interface ReoonVerificationResult {
  email: string;
  status: 'valid' | 'invalid' | 'disposable' | 'spamtrap';
  username: string;
  domain: string;
  is_valid_syntax: boolean;
  is_disposable: boolean;
  is_role_account: boolean;
  mx_accepts_mail: boolean;
  is_spamtrap: boolean;
  is_free_email: boolean;
  mx_records: string[];
  verification_mode: 'quick' | 'power';
  // Power mode only
  overall_score?: number;
  is_safe_to_send?: boolean;
  can_connect_smtp?: boolean;
  has_inbox_full?: boolean;
  is_catch_all?: boolean;
  is_deliverable?: boolean;
  is_disabled?: boolean;
}

export interface ReoonBulkTaskResponse {
  status: 'success' | 'error';
  task_id?: string;
  count_submitted?: number;
  count_duplicates_removed?: number;
  count_rejected_emails?: number;
  count_processing?: number;
  reason?: string;
}

export interface ReoonTaskStatusResponse {
  task_id: string;
  name: string;
  status: 'waiting' | 'running' | 'completed' | 'file_not_found' | 'file_loading_error';
  count_total: number;
  count_checked: number;
  progress_percentage: number;
  results?: Record<string, ReoonVerificationResult>;
}

export class ReoonClient {
  private apiKey: string;

  constructor(apiKey: string) {
    if (!apiKey) {
      throw new Error('Reoon API key is required');
    }
    this.apiKey = apiKey;
  }

  /**
   * Verify a single email address
   * @param email Email to verify
   * @param mode 'quick' for basic checks, 'power' for full verification
   */
  async verifySingle(
    email: string,
    mode: 'quick' | 'power' = 'power'
  ): Promise<ReoonVerificationResult> {
    const url = `${REOON_API_BASE}/verify/single`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reoon-Apikey': this.apiKey,
      },
      body: JSON.stringify({
        email,
        mode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Reoon API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Create a bulk verification task
   * @param emails Array of emails to verify
   * @param taskName Optional name for the task
   */
  async createBulkTask(
    emails: string[],
    taskName?: string
  ): Promise<ReoonBulkTaskResponse> {
    const url = `${REOON_API_BASE}/verify/bulk`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Reoon-Apikey': this.apiKey,
      },
      body: JSON.stringify({
        emails,
        name: taskName,
        mode: 'power',
      }),
    });

    if (!response.ok) {
      throw new Error(`Reoon API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get the status of a bulk verification task
   * @param taskId Task ID returned from createBulkTask
   */
  async getTaskStatus(taskId: string): Promise<ReoonTaskStatusResponse> {
    const url = `${REOON_API_BASE}/task/${taskId}`;
    const response = await fetch(url, {
      headers: {
        'X-Reoon-Apikey': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Reoon API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Poll a task until completion
   * @param taskId Task ID to poll
   * @param intervalMs Polling interval in milliseconds
   * @param maxWaitMs Maximum wait time before timeout
   */
  async waitForTask(
    taskId: string,
    intervalMs: number = 5000,
    maxWaitMs: number = 300000
  ): Promise<ReoonTaskStatusResponse> {
    const startTime = Date.now();

    while (true) {
      const status = await this.getTaskStatus(taskId);

      if (status.status === 'completed') {
        return status;
      }

      if (status.status === 'file_not_found' || status.status === 'file_loading_error') {
        throw new Error(`Task failed with status: ${status.status}`);
      }

      if (Date.now() - startTime > maxWaitMs) {
        throw new Error('Task timeout');
      }

      await new Promise((resolve) => setTimeout(resolve, intervalMs));
    }
  }

  /**
   * Verify multiple emails in bulk and wait for results
   * @param emails Array of emails to verify
   * @param taskName Optional task name
   */
  async verifyBulk(
    emails: string[],
    taskName?: string
  ): Promise<Record<string, ReoonVerificationResult>> {
    const createResponse = await this.createBulkTask(emails, taskName);

    if (createResponse.status !== 'success' || !createResponse.task_id) {
      throw new Error(
        `Failed to create bulk task: ${createResponse.reason || 'Unknown error'}`
      );
    }

    const result = await this.waitForTask(createResponse.task_id);
    return result.results || {};
  }
}

/**
 * Create a Reoon client instance
 */
export function createReoonClient(apiKey?: string): ReoonClient {
  const key = apiKey || process.env.REOON_API_KEY;
  if (!key) {
    throw new Error('REOON_API_KEY environment variable is required');
  }
  return new ReoonClient(key);
}
