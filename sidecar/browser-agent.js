/**
 * Browser Agent Integration (V2 - Database Config)
 *
 * Modular browser automation using LLM-powered agents for:
 *
 * ATS Automation:
 * - Account creation on ATS platforms
 * - Login automation when sessions expire
 * - Form filling fallback when Simplify fails
 *
 * CRM Automation:
 * - LinkedIn message sending
 * - Contact information extraction/enrichment
 * - Cold email automation (future)
 *
 * Reuses the centralized LLM config from user_config table.
 * Supports any OpenAI-compatible LLM provider:
 * - NVIDIA NIM (free tier: 40 req/min) - set llm_provider='openai' or 'local'
 * - OpenAI GPT-4 - set llm_provider='openai'
 * - Anthropic Claude - set llm_provider='anthropic'
 * - Google Gemini - set llm_provider='gemini'
 * - Local LLMs (Ollama, LM Studio, etc.) - set llm_provider='local'
 */

/**
 * Initialize browser agent with database config
 * Uses the same LLM config as draft generation, scoring, etc.
 *
 * @param {Object} config - UserConfig from database
 * @param {string} config.llm_provider - 'openai' | 'anthropic' | 'gemini' | 'local'
 * @param {string} config.llm_endpoint - API endpoint URL
 * @param {string} config.llm_api_key - API key (optional for local LLMs)
 * @param {string} config.llm_model - Model name
 */
async function createBrowserAgent(config) {
    const {
        llm_provider = 'openai',
        llm_endpoint,
        llm_api_key,
        llm_model,
        browser_agent_max_tokens,
        browser_agent_temperature,
        browser_agent_action_timeout
    } = config;

    if (!llm_endpoint) {
        throw new Error('LLM endpoint not configured. Please set up LLM in Settings.');
    }

    const maxTokens = browser_agent_max_tokens || 4096;
    const temperature = browser_agent_temperature !== undefined ? browser_agent_temperature : 0.1;
    const actionTimeout = browser_agent_action_timeout || 5000;

    return {
        /**
         * Attempt login to platform
         * @param {Object} page - Playwright page
         * @param {string} email
         * @param {string} password
         */
        async login(page, email, password) {
            const url = page.url();

            const prompt = `You are a browser automation agent. Your task is to log in to this platform.

Credentials:
- Email: ${email}
- Password: ${password}

Current URL: ${url}

Analyze the page and provide step-by-step login instructions. Return a JSON array of actions:

[
  { "action": "fill", "selector": "input[type='email']", "value": "${email}", "description": "Fill email" },
  { "action": "fill", "selector": "input[type='password']", "value": "${password}", "description": "Fill password" },
  { "action": "click", "selector": "button[type='submit']", "description": "Click login button" }
]

Return ONLY valid JSON array, no markdown formatting.`;

            const actions = await callLLM({
                provider: llm_provider,
                endpoint: llm_endpoint,
                apiKey: llm_api_key,
                model: llm_model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a browser automation expert. Return only valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                maxTokens,
                temperature
            });

            const parsedActions = JSON.parse(actions);
            for (const action of parsedActions) {
                await executeAction(page, action, { email, password }, actionTimeout);
            }

            return { success: true, actions: parsedActions };
        },

        /**
         * Create account on ATS platform
         * @param {Object} page - Playwright page
         * @param {Object} userData - User credentials and info
         */
        async createAccount(page, userData) {
            const url = page.url();

            const prompt = `You are a browser automation agent. Your task is to create a new account on this ATS platform.

User Information:
- Email: ${userData.email}
- Password: ${userData.password}
- First Name: ${userData.firstName}
- Last Name: ${userData.lastName}
- Phone: ${userData.phone || 'N/A'}

Current URL: ${url}

Analyze the page and provide step-by-step account creation instructions. Return a JSON array of actions:

[
  { "action": "fill", "selector": "input[name='email']", "value": "${userData.email}", "description": "Fill email" },
  { "action": "fill", "selector": "input[name='firstName']", "value": "${userData.firstName}", "description": "Fill first name" },
  { "action": "fill", "selector": "input[name='lastName']", "value": "${userData.lastName}", "description": "Fill last name" },
  { "action": "fill", "selector": "input[type='password']", "value": "${userData.password}", "description": "Fill password" },
  { "action": "click", "selector": "button[type='submit']", "description": "Submit registration" }
]

Return ONLY valid JSON array, no markdown formatting.`;

            const actions = await callLLM({
                provider: llm_provider,
                endpoint: llm_endpoint,
                apiKey: llm_api_key,
                model: llm_model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a browser automation expert. Return only valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                maxTokens,
                temperature
            });

            const parsedActions = JSON.parse(actions);
            for (const action of parsedActions) {
                await executeAction(page, action, userData, actionTimeout);
            }

            return { success: true, actions: parsedActions };
        },

        /**
         * Wait for and process email verification link
         * @param {Object} page - Playwright page
         * @param {string} email - Email address to monitor
         * @param {Function} checkEmailFn - Async function that returns verification link or null
         * @param {number} maxWaitMs - Maximum time to wait (default: 120000 = 2 min)
         */
        async waitForEmailVerification(page, email, checkEmailFn, maxWaitMs = 120000) {
            const startTime = Date.now();
            const pollIntervalMs = 5000; // Check every 5 seconds

            while (Date.now() - startTime < maxWaitMs) {
                // Check for verification link in email
                const verificationLink = await checkEmailFn(email);

                if (verificationLink) {
                    // Navigate to verification link
                    await page.goto(verificationLink, { waitUntil: 'domcontentloaded', timeout: 30000 });
                    await page.waitForTimeout(2000); // Wait for verification to process
                    return { success: true, verificationLink };
                }

                // Wait before next poll
                await page.waitForTimeout(pollIntervalMs);
            }

            throw new Error(`Email verification link not received after ${maxWaitMs / 1000} seconds`);
        },

        /**
         * Fill job application form (fallback when Simplify fails)
         * @param {Object} page - Playwright page
         * @param {Object} applicationData - Resume data
         */
        async fillApplication(page, applicationData) {
            const html = await page.content();

            const prompt = `You are a browser automation agent. Fill out this job application form.

Application Data:
${JSON.stringify(applicationData, null, 2)}

Analyze the HTML and identify form fields. Return a JSON array of actions to fill the application:

[
  { "action": "fill", "selector": "input[name='firstName']", "value": "...", "description": "..." },
  { "action": "select", "selector": "select[name='yearsExperience']", "value": "3-5", "description": "..." },
  { "action": "click", "selector": "input[type='checkbox'][name='authorized']", "description": "..." }
]

Return ONLY valid JSON array.`;

            const actions = await callLLM({
                provider: llm_provider,
                endpoint: llm_endpoint,
                apiKey: llm_api_key,
                model: llm_model,
                messages: [
                    {
                        role: 'system',
                        content: 'You are a form-filling expert. Return only valid JSON arrays.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                maxTokens,
                temperature
            });

            const parsedActions = JSON.parse(actions);
            for (const action of parsedActions) {
                await executeAction(page, action, applicationData, actionTimeout);
            }

            return { success: true, actions: parsedActions };
        }
    };
}

/**
 * Execute a single browser action
 */
async function executeAction(page, action, context, timeout = 5000) {
    try {
        switch (action.action) {
            case 'click':
                await page.click(action.selector, { timeout });
                break;

            case 'fill':
                // Interpolate context values if needed
                let value = action.value;
                if (value.startsWith('${') && value.endsWith('}')) {
                    const key = value.slice(2, -1);
                    value = context[key] || value;
                }
                await page.fill(action.selector, value, { timeout });
                break;

            case 'select':
                await page.selectOption(action.selector, action.value, { timeout });
                break;

            case 'wait':
                await page.waitForSelector(action.selector, { timeout: timeout * 2 });
                break;

            case 'upload':
                const filePath = context[action.fileKey] || action.filePath;
                await page.setInputFiles(action.selector, filePath, { timeout });
                break;

            default:
                console.warn(`Unknown action: ${action.action}`);
        }

        // Small delay between actions for stability
        await page.waitForTimeout(500);

    } catch (error) {
        console.error(`Failed to execute action: ${action.description}`, error.message);
        throw error;
    }
}

/**
 * Call LLM with provider-specific formatting
 * Matches the buildProviderHeaders and buildProviderRequest from app/lib/llm.ts
 */
async function callLLM({ provider, endpoint, apiKey, model, messages, maxTokens, temperature }) {
    // Build headers based on provider
    const headers = {
        'Content-Type': 'application/json',
    };

    if (provider === 'anthropic') {
        headers['x-api-key'] = apiKey;
        headers['anthropic-version'] = '2023-06-01';
    } else if (provider === 'local' && !apiKey) {
        // Local LLMs may not need auth
    } else {
        headers['Authorization'] = `Bearer ${apiKey}`;
    }

    // Build request body based on provider
    let requestBody;
    if (provider === 'anthropic') {
        // Anthropic format
        requestBody = {
            model: model || 'claude-3-5-sonnet-20241022',
            system: messages.find(m => m.role === 'system')?.content || '',
            messages: messages.filter(m => m.role !== 'system'),
            max_tokens: maxTokens,
            temperature
        };
    } else {
        // OpenAI-compatible format (openai, gemini, local)
        requestBody = {
            model: model || 'gpt-4o-mini',
            messages,
            max_tokens: maxTokens,
            temperature
        };
    }

    const response = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`LLM API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Extract response based on provider
    if (provider === 'anthropic') {
        if (data.content && data.content[0]?.text) {
            return data.content[0].text;
        }
    } else {
        if (data.choices && data.choices[0]?.message?.content) {
            return data.choices[0].message.content;
        }
    }

    throw new Error('Unexpected LLM response format');
}

module.exports = {
    createBrowserAgent
};
