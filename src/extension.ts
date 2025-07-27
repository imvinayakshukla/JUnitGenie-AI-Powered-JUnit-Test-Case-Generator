import * as vscode from 'vscode';
import { TestGeneratorProvider } from './providers/testGeneratorProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('JUnit Test Generator extension is now active');

    const provider = new TestGeneratorProvider(context);

    // Register command for generating tests
    const generateTestsCommand = vscode.commands.registerCommand(
        'junit-test-generator.startChat',
        (uri?: vscode.Uri) => provider.showTestGeneratorPanel(uri)
    );

    // Register command to refresh API key (useful when user changes settings)
    const refreshApiKeyCommand = vscode.commands.registerCommand(
        'junit-test-generator.refreshApiKey',
        () => {
            provider.refreshApiKey();
            vscode.window.showInformationMessage('AI API key refreshed');
        }
    );

    // Register command to check service status
    const checkStatusCommand = vscode.commands.registerCommand(
        'junit-test-generator.checkStatus',
        () => provider.checkServiceStatus()
    );

    // Add configuration change listener to refresh API key when changed
    const configurationChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('junit-test-generator.openai.apiKey') ||
            event.affectsConfiguration('junit-test-generator.azureOpenai.apiKey') ||
            event.affectsConfiguration('junit-test-generator.azureOpenai.enabled')) {
            provider.refreshApiKey();
            vscode.window.showInformationMessage('AI API configuration updated');
        }
    });

    // Subscribe to disposables
    context.subscriptions.push(
        generateTestsCommand,
        refreshApiKeyCommand,
        checkStatusCommand,
        configurationChangeListener
    );

    // Show welcome message on first activation
    const isFirstActivation = context.globalState.get('junit-test-generator.firstActivation', true);
    if (isFirstActivation) {
        vscode.window.showInformationMessage(
            'JUnit Test Generator is ready! Right-click on Java files to generate tests.',
            'Get Started',
            'Configure API Key'
        ).then(selection => {
            if (selection === 'Get Started') {
                vscode.commands.executeCommand('junit-test-generator.startChat');
            } else if (selection === 'Configure API Key') {
                // Show both OpenAI and Azure OpenAI settings
                vscode.commands.executeCommand('workbench.action.openSettings', 'junit-test-generator');
            }
        });
        
        context.globalState.update('junit-test-generator.firstActivation', false);
    }
}

export function deactivate() {
    console.log('JUnit Test Generator extension is now deactivated');
}
