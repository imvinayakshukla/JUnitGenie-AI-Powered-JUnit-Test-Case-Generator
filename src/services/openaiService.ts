import { OpenAI } from 'openai';
import * as vscode from 'vscode';
import { TestGenerationConfig, ChatMessage, AzureOpenAIConfig } from '../types';

export class OpenAIService {
    private openai: OpenAI | null = null;
    private isAzure: boolean = false;

    constructor() {
        this.initializeClient();
    }

    private initializeClient(): void {
        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const useAzure = config.get<boolean>('azureOpenai.enabled') || false;

        if (useAzure) {
            this.initializeAzureClient(config);
        } else {
            this.initializeOpenAIClient(config);
        }
    }

    private initializeOpenAIClient(config: vscode.WorkspaceConfiguration): void {
        const apiKey = config.get<string>('openai.apiKey');

        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
            this.isAzure = false;
        }
    }

    private initializeAzureClient(config: vscode.WorkspaceConfiguration): void {
        const apiKey = config.get<string>('azureOpenai.apiKey');
        const endpoint = config.get<string>('azureOpenai.endpoint');
        const deploymentName = config.get<string>('azureOpenai.deploymentName');
        const apiVersion = config.get<string>('azureOpenai.apiVersion') || '2024-02-15-preview';

        if (!apiKey || !endpoint || !deploymentName) {
            vscode.window.showErrorMessage(
                'Azure OpenAI configuration incomplete. Please set API key, endpoint, and deployment name in settings.'
            );
            return;
        }

        // Normalize endpoint URL
        let normalizedEndpoint = endpoint.trim();
        if (!normalizedEndpoint.startsWith('https://')) {
            normalizedEndpoint = 'https://' + normalizedEndpoint;
        }
        if (!normalizedEndpoint.endsWith('/')) {
            normalizedEndpoint += '/';
        }

        try {
            this.openai = new OpenAI({
                apiKey,
                baseURL: `${normalizedEndpoint}openai/deployments/${deploymentName}`,
                defaultQuery: { 'api-version': apiVersion },
                defaultHeaders: {
                    'api-key': apiKey,
                },
            });
            this.isAzure = true;
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to initialize Azure OpenAI client: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }

    private getModelName(): string {
        const config = vscode.workspace.getConfiguration('junit-test-generator');
        
        if (this.isAzure) {
            // For Azure OpenAI, we actually don't need to specify the model name in the API call
            // since it's determined by the deployment, but we return the deployment name for logging
            const deploymentName = config.get<string>('azureOpenai.deploymentName');
            if (!deploymentName) {
                throw new Error('Azure OpenAI deployment name not configured');
            }
            return deploymentName;
        } else {
            // For regular OpenAI, use the model name
            return config.get<string>('openai.model') || 'gpt-4';
        }
    }

    async generateTests(javaCode: string, className?: string, conversationHistory?: ChatMessage[]): Promise<string> {
        if (!this.openai) {
            const providerName = this.isAzure ? 'Azure OpenAI' : 'OpenAI';
            throw new Error(`${providerName} API key not configured. Please set it in the extension settings.`);
        }

        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const model = this.getModelName();
        const framework = config.get<string>('testFramework') || 'junit5';
        const maxTokens = config.get<number>('openai.maxTokens') || 2000;
        const temperature = config.get<number>('openai.temperature') || 0.3;

        const systemPrompt = this.getSystemPrompt(framework);
        const userPrompt = this.getUserPrompt(javaCode, framework, className);

        // Build conversation history for context
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: "system", content: systemPrompt }
        ];

        // Add conversation history if available (for error correction)
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        // Add current request
        messages.push({ role: "user", content: userPrompt });

        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            });

            const generatedContent = response.choices[0]?.message?.content || 'No response generated';
            
            // Validate that the response contains actual test code
            if (this.isValidTestResponse(generatedContent)) {
                return this.cleanTestResponse(generatedContent);
            } else {
                // If response doesn't look like test code, try again with more explicit prompt
                const fallbackPrompt = `RESPOND WITH JAVA CODE ONLY. NO TEXT.

Java class to test:
${javaCode}

Your response must start exactly like this:
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class ClassNameTest {
    @Test
    void test...`;
                
                const fallbackResponse = await this.openai.chat.completions.create({
                    model,
                    messages: [
                        { role: "system", content: "Output only raw Java code. No explanations. No markdown. Start with 'import'." },
                        { role: "user", content: fallbackPrompt }
                    ],
                    temperature: 0.0,
                    max_tokens: maxTokens
                });
                
                return this.cleanTestResponse(fallbackResponse.choices[0]?.message?.content || 'Failed to generate test code');
            }
        } catch (error) {
            if (error instanceof Error) {
                const providerName = this.isAzure ? 'Azure OpenAI' : 'OpenAI';
                throw new Error(`${providerName} API error: ${error.message}`);
            }
            throw new Error('Unknown error occurred while generating tests');
        }
    }

    async fixTestsWithError(originalCode: string, generatedTests: string, errorMessage: string, conversationHistory?: ChatMessage[]): Promise<string> {
        if (!this.openai) {
            const providerName = this.isAzure ? 'Azure OpenAI' : 'OpenAI';
            throw new Error(`${providerName} API key not configured. Please set it in the extension settings.`);
        }

        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const model = this.getModelName();
        const framework = config.get<string>('testFramework') || 'junit5';
        const maxTokens = config.get<number>('openai.maxTokens') || 2000;
        const temperature = config.get<number>('openai.temperature') || 0.3;

        const systemPrompt = this.getErrorFixSystemPrompt(framework);
        const userPrompt = this.getErrorFixUserPrompt(originalCode, generatedTests, errorMessage, framework);

        // Build conversation history
        const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
            { role: "system", content: systemPrompt }
        ];

        // Add previous conversation for context
        if (conversationHistory && conversationHistory.length > 0) {
            conversationHistory.forEach(msg => {
                if (msg.role === 'user' || msg.role === 'assistant') {
                    messages.push({
                        role: msg.role,
                        content: msg.content
                    });
                }
            });
        }

        messages.push({ role: "user", content: userPrompt });

        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages,
                temperature,
                max_tokens: maxTokens
            });

            return response.choices[0]?.message?.content || 'No response generated';
        } catch (error) {
            if (error instanceof Error) {
                const providerName = this.isAzure ? 'Azure OpenAI' : 'OpenAI';
                throw new Error(`${providerName} API error: ${error.message}`);
            }
            throw new Error('Unknown error occurred while fixing tests');
        }
    }

    private getSystemPrompt(framework: string): string {
        return `You are a professional JUnit test generator. Your response must be ONLY valid Java code that compiles and runs.

STRICT OUTPUT RULES:
- Start immediately with "import" statements
- No explanatory text before or after the code
- No markdown formatting (no \`\`\`)
- No comments about what you're doing
- No "Here's the test" or similar phrases
- Pure Java code only

GENERATE: Complete ${framework === 'junit5' ? 'JUnit 5' : 'JUnit 4'} test class with:
- All required imports
- Class named [OriginalClassName]Test  
- @${framework === 'junit5' ? 'Test' : 'Test'} annotated methods
- Comprehensive test coverage (happy path, edge cases, exceptions)
- Proper assertions
- Setup methods if needed

EXAMPLE START:
import org.junit.jupiter.api.Test;
import static org.junit.jupiter.api.Assertions.*;

class DemoTest {`;
    }

    private getUserPrompt(javaCode: string, framework: string, className?: string): string {
        const testAnnotation = framework === 'junit5' ? '@Test' : '@Test';
        const assertionsImport = framework === 'junit5' ? 'import static org.junit.jupiter.api.Assertions.*;' : 'import static org.junit.Assert.*;';
        
        return `Write ${framework === 'junit5' ? 'JUnit 5' : 'JUnit 4'} tests for this Java class. Start with imports:

${javaCode}

Required format:
${assertionsImport}
import org.junit.${framework === 'junit5' ? 'jupiter.api.' : ''}Test;

class [ClassName]Test {
    ${testAnnotation}
    void testMethodName() {
        // test code
    }
}`;
    }

    private getErrorFixSystemPrompt(framework: string): string {
        return `You are a JUnit test code fixer. Return ONLY corrected Java code.

RULES:
- Fix compilation/runtime errors in test code
- Return complete, working test class
- Start with import statements
- No explanations, only code
- Use ${framework === 'junit5' ? 'JUnit 5' : 'JUnit 4'} syntax

OUTPUT ONLY JAVA CODE.`;
    }

    private getErrorFixUserPrompt(originalCode: string, generatedTests: string, errorMessage: string, framework: string): string {
        return `Fix this ${framework === 'junit5' ? 'JUnit 5' : 'JUnit 4'} test code that has errors:

ORIGINAL CLASS:
${originalCode}

BROKEN TEST CODE:
${generatedTests}

ERROR:
${errorMessage}

Return the corrected test code starting with imports:`;
    }

    private isValidTestResponse(response: string): boolean {
        const trimmed = response.trim();
        
        // Must start with import or package
        if (!/^\s*(import|package)/i.test(trimmed)) {
            return false;
        }
        
        // Check for required JUnit patterns
        const requiredPatterns = [
            /import.*junit/i,           // JUnit import
            /@Test/,                    // Test annotation
            /class\s+\w+Test/i,         // Test class name
            /void\s+test\w+/i,          // Test method
            /assert\w+/i                // Assertion
        ];
        
        const foundPatterns = requiredPatterns.filter(pattern => pattern.test(response)).length;
        
        // Check for unwanted text patterns
        const unwantedPatterns = [
            /^(Here|This|I|The|Let|Now)/i,      // Explanatory starts
            /```/,                               // Markdown
            /explanation/i,                      // Explanation text
            /example/i,                          // Example text
            /generate/i,                         // Generate text
            /create/i                            // Create text
        ];
        
        const hasUnwantedText = unwantedPatterns.some(pattern => pattern.test(response));
        
        return foundPatterns >= 4 && !hasUnwantedText && response.length > 300;
    }

    private cleanTestResponse(response: string): string {
        let cleaned = response.trim();
        
        // Remove markdown code blocks
        cleaned = cleaned.replace(/```java\s*/gi, '');
        cleaned = cleaned.replace(/```\s*/g, '');
        
        // Remove any leading non-code text before first import/package
        const codeStartPatterns = [
            /^[\s\S]*?(import\s)/i,
            /^[\s\S]*?(package\s)/i
        ];
        
        for (const pattern of codeStartPatterns) {
            const match = cleaned.match(pattern);
            if (match) {
                cleaned = match[1] + cleaned.substring(match.index! + match[0].length);
                break;
            }
        }
        
        // Remove any trailing explanatory text after the last }
        const lines = cleaned.split('\n');
        let lastBraceIndex = -1;
        
        for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i].trim();
            if (line === '}' && i > 0) {
                // Check if this is likely the end of the class
                const prevLines = lines.slice(Math.max(0, i-3), i).join(' ');
                if (/test|class|method|\{/.test(prevLines)) {
                    lastBraceIndex = i;
                    break;
                }
            }
        }
        
        if (lastBraceIndex >= 0) {
            cleaned = lines.slice(0, lastBraceIndex + 1).join('\n');
        }
        
        // Remove any lines that look like explanations
        const cleanedLines = cleaned.split('\n').filter(line => {
            const trimmedLine = line.trim();
            const explanationPatterns = [
                /^(This|Here|The|I|Let|Now|You|We)\s/i,
                /^(Note|Remember|Important|Please)/i,
                /explanation/i,
                /example/i
            ];
            return !explanationPatterns.some(pattern => pattern.test(trimmedLine));
        });
        
        return cleanedLines.join('\n').trim();
    }

    public refreshApiKey(): void {
        this.initializeClient();
    }

    public getServiceStatus(): { isConfigured: boolean; provider: string; model?: string } {
        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const useAzure = config.get<boolean>('azureOpenai.enabled') || false;

        if (useAzure) {
            const apiKey = config.get<string>('azureOpenai.apiKey');
            const endpoint = config.get<string>('azureOpenai.endpoint');
            const deploymentName = config.get<string>('azureOpenai.deploymentName');
            
            return {
                isConfigured: !!(apiKey && endpoint && deploymentName && this.openai),
                provider: 'Azure OpenAI',
                model: deploymentName
            };
        } else {
            const apiKey = config.get<string>('openai.apiKey');
            const model = config.get<string>('openai.model') || 'gpt-4';
            
            return {
                isConfigured: !!(apiKey && this.openai),
                provider: 'OpenAI',
                model
            };
        }
    }
}
