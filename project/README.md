# VoiceFlow Project

## Overview
VoiceFlow is a text-to-speech application that allows users to convert text into natural, clear speech. It includes features for voice settings, recording voice samples, and extracting text from images using OCR.

## Features
- Text-to-speech functionality with customizable voice settings.
- Record and save voice samples for comparison with TTS output.
- Extract text from images using OCR technology.
- User-friendly interface with quick example texts for demonstration.

## Getting Started

### Prerequisites
- Node.js (version 14 or higher)
- npm (Node Package Manager)

### Installation
1. Clone the repository:
   ```
   git clone <repository-url>
   ```
2. Navigate to the project directory:
   ```
   cd project
   ```
3. Install the dependencies:
   ```
   npm install
   ```

### Running the Application
To start the development server, run:
```
npm start
```
This will launch the application in your default web browser at `http://localhost:3000`.

### Linting
To lint the codebase, run:
```
npm run lint
```

## Project Structure
```
project
├── src
│   ├── App.tsx          # Main application component
│   └── index.tsx       # Entry point of the React application
├── public
│   └── index.html       # Main HTML file
├── package.json          # npm configuration file
├── tsconfig.json         # TypeScript configuration file
├── .eslintrc.json        # ESLint configuration file
├── .eslintignore         # Files and directories to ignore for ESLint
└── README.md             # Project documentation
```

## Contributing
Contributions are welcome! Please open an issue or submit a pull request for any improvements or bug fixes.

## License
This project is licensed under the MIT License. See the LICENSE file for more details.