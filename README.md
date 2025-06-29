# JUnitGenie- AI Powered JUnit Test Case Generator

An AI-powered VS Code extension that generates comprehensive JUnit test cases for your Java code using OpenAI's GPT models.

## Features

- 🧪 **Smart Test Generation**: Generate comprehensive JUnit 4 and JUnit 5 test cases
- 🎯 **Context-Aware**: Automatically detects active Java files and loads them for testing
- 🔧 **Easy Integration**: Right-click context menu integration for Java files
- 💾 **Save & Open**: Automatically save generated tests and open them in the editor
- 🛡️ **Error Handling**: Robust error handling with helpful error messages

## Prerequisites

*   An OpenAI API key.

## Usage

1.  **Install the Extension:**
    *   Package the extension by running `vsce package` in the terminal.
    *   Install the generated `.vsix` file in VS Code via the Extensions view (`...` > "Install from VSIX...").
2.  **Configure the API Key:**
    *   Go to VS Code Settings (File > Preferences > Settings).
    *   Search for "JUnit Test Generator".
    *   Enter your OpenAI API key in the "Openai: Api Key" field.
3.  **Generate Tests:**
    *   Open a Java file in VS Code.
    *   Right-click in the editor and select "Generate JUnit Tests (AI Chat)".
    *   A new panel will open with the chat interface.
    *   The code from your active editor will be pre-filled.
    *   Click "Generate" to get your JUnit tests.

## Development

1.  Clone the repository.
2.  Run `npm install` to install the dependencies && `npm run compile ` && `npm run package `
3.  Configure your OpenAI API key in the settings as described above.
4.  Press `F5` to open a new Extension Development Host window.
5.  Open a Java file and right-click to start the chat.
