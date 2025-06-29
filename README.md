# JUnitGenie- AI Powered JUnit Test Case Generator

An AI-powered VS Code extension that generates comprehensive JUnit test cases for your Java code using OpenAI's GPT models.

## Features

- 🧪 **Smart Test Generation**: Generate comprehensive JUnit 4 and JUnit 5 test cases
- 🎯 **Context-Aware**: Automatically detects active Java files and loads them for testing
- 🔧 **Easy Integration**: Right-click context menu integration for Java files
- 💾 **Save & Open**: Automatically save generated tests and open them in the editor
- 🛡️ **Error Handling**: Robust error handling with helpful error messages


## 🆕 **NEW: Automatic File Content Loading**

The extension now **automatically copies and pastes** the content of Java files when you right-click on them:

### **How it works:**
1. **Right-click any Java file** in the Explorer or Editor
2. Select **"Generate JUnit Tests (AI Chat)"**
3. **File content is automatically loaded** into the input area
4. **Notification shows** which file was loaded
5. **Click "Generate Tests"** to create test cases immediately

### **Smart Features:**
- ✅ **Validates Java syntax** before loading
- ✅ **Detects test files** and warns if you select a test file instead of source
- ✅ **Auto-resizes input area** to fit the loaded content
- ✅ **Shows file name** in the UI for confirmation
- ✅ **Fallback to active editor** if no file is right-clicked

---


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

## ✅ Refactored Structure Created

Your JUnit Test Generator extension has been successfully refactored for production with the following structure:

```
junit-test-generator/
├── src/                              # TypeScript source files
│   ├── extension.ts                  # Main extension entry point
│   ├── providers/
│   │   └── testGeneratorProvider.ts  # Webview provider
│   ├── services/
│   │   └── openaiService.ts          # OpenAI API service
│   ├── utils/
│   │   └── javaParser.ts             # Java code parsing utilities
│   └── types/
│       └── index.ts                  # TypeScript type definitions
├── resources/                        # Static resources
│   ├── webview/
│   │   ├── index.html               # Webview HTML
│   │   ├── main.css                 # Webview styles
│   │   └── main.js                  # Webview JavaScript
│   └── icons/                       # Extension icons (ready for custom icons)
├── test/                            # Test files
│   ├── suite/
│   │   ├── extension.test.ts        # Unit tests
│   │   └── index.ts                 # Test suite index
│   └── runTest.ts                   # Test runner
├── dist/                            # Compiled output
│   ├── extension.js                 # Compiled extension (561 KiB)
│   └── extension.js.map             # Source map
├── package.json                     # Updated with production settings
├── tsconfig.json                    # TypeScript configuration
├── webpack.config.js                # Webpack build configuration
├── .eslintrc.json                   # ESLint configuration
├── .vscodeignore                    # Files to exclude from package
└── README.md                        # Updated documentation
```

