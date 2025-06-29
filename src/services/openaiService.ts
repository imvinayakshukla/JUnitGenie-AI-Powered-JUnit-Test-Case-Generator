import { OpenAI } from 'openai';
import * as vscode from 'vscode';
import { TestGenerationConfig } from '../types';

export class OpenAIService {
    private openai: OpenAI | null = null;

    constructor() {
        this.initializeClient();
    }

    private initializeClient(): void {
        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const apiKey = config.get<string>('openai.apiKey');

        if (apiKey) {
            this.openai = new OpenAI({ apiKey });
        }
    }

    async generateTests(javaCode: string, className?: string): Promise<string> {
        if (!this.openai) {
            throw new Error('OpenAI API key not configured. Please set it in the extension settings.');
        }

        const config = vscode.workspace.getConfiguration('junit-test-generator');
        const model = config.get<string>('openai.model') || 'gpt-4';
        const framework = config.get<string>('testFramework') || 'junit5';
        const maxTokens = config.get<number>('openai.maxTokens') || 2000;
        const temperature = config.get<number>('openai.temperature') || 0.3;

        const systemPrompt = this.getSystemPrompt(framework);
        const userPrompt = this.getUserPrompt(javaCode, framework, className);

        try {
            const response = await this.openai.chat.completions.create({
                model,
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: userPrompt }
                ],
                temperature,
                max_tokens: maxTokens
            });

            return response.choices[0]?.message?.content || 'No response generated';
        } catch (error) {
            if (error instanceof Error) {
                throw new Error(`OpenAI API error: ${error.message}`);
            }
            throw new Error('Unknown error occurred while generating tests');
        }
    }

    private getSystemPrompt(framework: string): string {
        return `You are an expert Java developer specializing in unit testing with ${framework.toUpperCase()}.

Your task is to generate comprehensive, well-structured unit test cases that follow best practices:

1. **Test Structure**: Create properly organized test classes with descriptive names
2. **Test Methods**: Use clear, descriptive test method names following the pattern: should_ExpectedBehavior_When_StateUnderTest
3. **Test Coverage**: Include tests for:
   - Happy path scenarios
   - Edge cases and boundary conditions
   - Error handling and exception cases
   - Null/empty input validation
4. **Assertions**: Use appropriate ${framework === 'junit5' ? 'JUnit 5' : 'JUnit 4'} assertions
5. **Test Data**: Create realistic test data and use proper setup/teardown when needed
6. **Mocking**: Use Mockito for dependencies when appropriate
7. **Documentation**: Add brief comments explaining complex test scenarios

Generate complete, compilable test code that can be run immediately.`;
    }

    private getUserPrompt(javaCode: string, framework: string, className?: string): string {
        const frameworkVersion = framework === 'junit5' ? 'JUnit 5' : 'JUnit 4';
        const classInfo = className ? ` for the ${className} class` : '';
        
        return `Generate comprehensive ${frameworkVersion} unit tests${classInfo} for the following Java code:

\`\`\`java
${javaCode}
\`\`\`

Requirements:
- Use ${frameworkVersion} annotations and assertions
- Include package declaration and necessary imports
- Create tests for all public methods
- Handle edge cases and error scenarios
- Use descriptive test method names
- Add setup/teardown methods if needed
- Mock external dependencies appropriately

Provide only the complete test class code without explanations.`;
    }

    public refreshApiKey(): void {
        this.initializeClient();
    }
}
