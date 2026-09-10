# UML to Code Converter

A modern, responsive web application designed to bridge the gap between software design and implementation. This tool acts as a full-featured UML class diagram editor and an automatic code generator.

## 🚀 Features

- **Interactive Class Editor**: Manually define classes, attributes (with access modifiers and types), methods, and relationships like inheritance and composition.
- **Dynamic UML Diagram**: An interactive SVG-based canvas that automatically renders your UML class diagram based on the defined data model.
- **Multi-language Code Generation**: Live output panel that instantly generates boilerplate code for your UML model in **Java, C++, Python, C#, and TypeScript**.
- **AI-Powered Generation**: Describe a system in plain English (e.g., "Create a banking system..."), and the built-in Gemini API integration will automatically generate the complete UML model and corresponding code.
- **Import/Export Capabilities**: Import models from raw PlantUML syntax, JSON files, or reverse-engineer existing source code files. Copy or download the generated code easily.
- **Real-time Synchronization**: Any changes made in the editor, diagram, or through imports are instantly reflected across all views.

## 🛠️ Tech Stack

- **Frontend**: React, Vite, Vanilla CSS
- **Backend / Proxy**: Node.js
- **AI Integration**: Google Gemini API

## ⚙️ Setup and Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/puregreyhat/uml-to-code.git
   cd uml-to-code
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Setup:**
   Create a `.env` file in the root directory and add your Gemini API key:
   ```env
   GEMINI_API_KEY=your_api_key_here
   GEMINI_MODEL=gemini-1.5-flash
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev:api
   npm run dev
   ```
   *Note: The `dev:api` script runs the backend proxy for the Gemini API alongside the Vite frontend server.*

5. **Open your browser** and navigate to `http://localhost:5173` to start converting!
