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
            vscode.window.showInformationMessage('OpenAI API key refreshed');
        }
    );

    // Add configuration change listener to refresh API key when changed
    const configurationChangeListener = vscode.workspace.onDidChangeConfiguration(event => {
        if (event.affectsConfiguration('junit-test-generator.openai.apiKey')) {
            vscode.window.showInformationMessage('OpenAI API key configuration updated');
        }
    });

    // Subscribe to disposables
    context.subscriptions.push(
        generateTestsCommand,
        refreshApiKeyCommand,
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
                vscode.commands.executeCommand('workbench.action.openSettings', 'junit-test-generator.openai.apiKey');
            }
        });
        
        context.globalState.update('junit-test-generator.firstActivation', false);
    }
}

export function deactivate() {
    console.log('JUnit Test Generator extension is now deactivated');
}
